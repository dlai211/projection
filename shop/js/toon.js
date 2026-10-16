/**
 * toon.js — the cel-shading look, in one place.
 *
 * Three jobs:
 *   1. one shared gradient ramp, so every surface in the diorama bands at the
 *      same places;
 *   2. a material factory, so nothing anywhere else in the project calls
 *      `new MeshToonMaterial` and drifts off the palette;
 *   3. the contour line — an inverted-hull child mesh.
 *
 * It is a *system* module: it owns resources other modules consume. Imports run
 * one way only (everyone imports toon.js; toon.js imports nothing of ours).
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OUTLINE } from './config.js';

/* ------------------------------------------------------------ gradient ramp */

/**
 * Four bands, lowest value lifted well off black.
 *
 * The ramp is 64 texels tall and LINEARLY filtered, which is the whole trick.
 * `gradientmap_pars_fragment` samples it with a bare `texture2D` — no
 * derivative-aware filtering — so a NearestFiltered ramp gives a literally hard
 * step that shimmers and stair-steps along the terminator as the camera orbits.
 * MSAA does not help: the aliasing is in the shading, not the geometry. Spreading
 * each of the four steps over 16 texels and letting linear filtering soften only
 * the one-texel boundary gives crisp bands that do not crawl.
 *
 * This is a ramp, not colour, so it must stay in the default NoColorSpace.
 */
const RAMP_STOPS = [0.44, 0.62, 0.82, 1.0];
const RAMP_TEXELS = 64;

function buildRamp() {
  const data = new Uint8Array(RAMP_TEXELS * 4);
  const per = RAMP_TEXELS / RAMP_STOPS.length;

  for (let i = 0; i < RAMP_TEXELS; i++) {
    const value = RAMP_STOPS[Math.min(RAMP_STOPS.length - 1, Math.floor(i / per))];
    const byte = Math.round(value * 255);
    data[i * 4 + 0] = byte;
    data[i * 4 + 1] = byte;
    data[i * 4 + 2] = byte;
    data[i * 4 + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, 1, RAMP_TEXELS, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** One ramp for the whole scene, created once. */
export const ramp = buildRamp();

/* --------------------------------------------------------------- materials */

/**
 * The only way to make a lit surface in this project.
 *
 * `emissive` is how anything that looks like it is glowing is done — a light
 * box, a sign face, a fridge interior. Emissive is flat and unbanded on
 * purpose: neon has no shading, and it is what feeds the bloom pass.
 */
export function toon({
  color = 0xffffff,
  map = null,
  emissive = 0x000000,
  emissiveIntensity = 1,
  emissiveMap = null,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
  vertexColors = false,
  depthWrite = true,
  fog = true,
} = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    map,
    gradientMap: ramp,
    emissive,
    emissiveIntensity,
    emissiveMap,
    transparent,
    opacity,
    side,
    vertexColors,
    depthWrite,
    fog,
  });
  material.userData.isToon = true;
  return material;
}

/**
 * An unlit surface: rain, decals, glass highlights, anything additive. Not a
 * toon material at all, so nothing bands.
 */
export function flat({
  color = 0xffffff,
  map = null,
  transparent = true,
  opacity = 1,
  blending = THREE.NormalBlending,
  depthWrite = false,
  side = THREE.FrontSide,
  fog = false,
} = {}) {
  const material = new THREE.MeshBasicMaterial({
    color,
    map,
    transparent,
    opacity,
    blending,
    depthWrite,
    side,
    fog,
  });
  material.userData.isFlat = true;
  return material;
}

/* ---------------------------------------------------------------- geometry */

/**
 * A box with a 2–4 mm fillet and real dimensions.
 *
 * This matters more than it sounds. Nothing real has a razor edge, and at this
 * scale the fillet is most of the difference between "3D model" and "miniature":
 * it catches the key light along every edge and draws the shape. It costs about
 * 12 triangles for a plain box versus ~150 for a rounded one, which is by a wide
 * margin the best triangle spend in the project.
 *
 * It also takes the real size as arguments rather than a unit cube and a scale
 * vector, which is not a style preference: outline thickness is offset in view
 * space through the normal matrix, so a non-uniform `mesh.scale` skews the
 * offset and the line varies in weight by axis. Build at final size, never
 * scale an outlined object.
 */
export function roundedBox(width, height, depth, radius = 0.004) {
  const smallest = Math.min(width, height, depth);
  return new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, smallest * 0.24));
}

/* ---------------------------------------------------------------- outline */

/**
 * The contour line, as an inverted hull: a back-facing copy of the mesh pushed
 * outwards along its normals, drawn in a flat ink colour.
 *
 * Two details in here are doing real work.
 *
 * The offset is applied in VIEW space through `normalMatrix`, and then scaled by
 * `pos.w`. The `pos.w` cancels the perspective divide, so the line stays a
 * constant width on screen however far away the object is — which is what makes
 * it look drawn rather than modelled, and is why `OUTLINE.hero` can be a number
 * like 0.0021 and mean "about two pixels".
 *
 * The offset direction is not the geometry's own normal but a SEPARATE set of
 * smoothed normals. With hard-edged geometry the offset follows each flat face,
 * so at every convex corner the two faces' offsets diverge and the hull tears
 * open — a gap in the line at every corner of every box. Averaging the normals
 * (merge by position, then recompute) closes the hull around the corner while
 * the visible surface keeps its hard normals for shading.
 */
const OUTLINE_VERTEX = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>

  attribute vec3 aOutlineNormal;
  uniform float uThickness;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    vec3 pushed = normalize( normalMatrix * aOutlineNormal );
    vec4 pos  = projectionMatrix * mvPosition;
    vec4 pos2 = projectionMatrix * ( mvPosition + vec4( pushed, 0.0 ) );

    // Work in NDC, on vec2, and this is the whole trick made explicit.
    //
    // Doing this as normalize( pos2 - pos ) in clip space looks equivalent and
    // is not: those are vec4s whose w differs (w is -pushed.z), so normalising
    // the whole vector scales the xyz part down to almost nothing for any
    // surface facing the camera, and the line thins away exactly where it is
    // needed most.
    //
    // The direction is pos2 - pos, not pos - pos2, because pos2 is the
    // projection of a point already pushed along the normal. three's own
    // OutlineEffect writes it the other way round only because the normal it
    // feeds in has been negated for BackSide rendering; copy the sign without
    // copying the negation and the hull shrinks inside the object instead of
    // swelling around it, and the outline silently vanishes rather than
    // looking wrong.
    vec2 dir = normalize( ( pos2.xy / pos2.w ) - ( pos.xy / pos.w ) );

    // Multiplying by w cancels the perspective divide that follows, so the line
    // is a constant width on screen however far away the object is.
    gl_Position = vec4( pos.xyz + vec3( dir, 0.0 ) * uThickness * pos.w, pos.w );

    #include <fog_vertex>
  }
`;

const OUTLINE_FRAGMENT = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>

  uniform vec3 uColor;

  void main() {
    gl_FragColor = vec4( uColor, 1.0 );

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Smoothed normals are expensive to build, so each geometry gets one. */
const smoothedNormalCache = new WeakMap();

/**
 * One averaged normal per vertex OF THE ORIGINAL GEOMETRY.
 *
 * The obvious implementation — mergeVertices, then computeVertexNormals — is
 * wrong here, and wrong in a way that is very hard to see. Merging welds a hard
 * edged box's 24 vertices down to 8, so the normals it produces are indexed by a
 * different vertex count than the geometry they are about to be attached to. The
 * buffer comes out short, the remaining vertices read past the end of it, and
 * the hull collapses into the object shifted in one direction: the outline shows
 * along a couple of edges and vanishes from the rest, which reads as a shading
 * quirk rather than as a bug.
 *
 * So accumulate face normals by position here and hand every original vertex the
 * average for wherever it happens to sit. Area weighting comes free from
 * summing the un-normalised cross products.
 */
const WELD_TOLERANCE = 1e-4;

function smoothedNormals(geometry) {
  const cached = smoothedNormalCache.get(geometry);
  if (cached) return cached;

  const position = geometry.attributes.position;
  const index = geometry.index;
  const count = position.count;
  const triangles = (index ? index.count : count) / 3;

  const keyOf = (i) =>
    `${Math.round(position.getX(i) / WELD_TOLERANCE)},` +
    `${Math.round(position.getY(i) / WELD_TOLERANCE)},` +
    `${Math.round(position.getZ(i) / WELD_TOLERANCE)}`;

  const summed = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const face = new THREE.Vector3();

  for (let t = 0; t < triangles; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1);
    c.fromBufferAttribute(position, i2);
    face.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (face.lengthSq() < 1e-20) continue;

    for (const i of [i0, i1, i2]) {
      const key = keyOf(i);
      const slot = summed.get(key);
      if (slot) {
        slot[0] += face.x;
        slot[1] += face.y;
        slot[2] += face.z;
      } else {
        summed.set(key, [face.x, face.y, face.z]);
      }
    }
  }

  const array = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const slot = summed.get(keyOf(i));
    if (slot) {
      const length = Math.hypot(slot[0], slot[1], slot[2]) || 1;
      array[i * 3] = slot[0] / length;
      array[i * 3 + 1] = slot[1] / length;
      array[i * 3 + 2] = slot[2] / length;
    } else {
      array[i * 3] = 0;
      array[i * 3 + 1] = 1;
      array[i * 3 + 2] = 0;
    }
  }

  smoothedNormalCache.set(geometry, array);
  return array;
}

/**
 * One shader program, however many materials — every outline material is built
 * from the same source text, so three.js compiles it once and they share it.
 * Only the uniform values differ. Materials are cached per (thickness, colour)
 * pair, which in practice is two or three objects, not one per mesh.
 */
const outlineMaterialCache = new Map();

function outlineMaterial(thickness, color) {
  const key = `${thickness}|${color}`;
  const cached = outlineMaterialCache.get(key);
  if (cached) return cached;

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uThickness: { value: thickness }, uColor: { value: new THREE.Color(color) } },
    ]),
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: THREE.BackSide,
    // Without this the far corner keeps pure black line art while the surfaces
    // around it fade into fog, and the whole thing comes apart at distance.
    fog: true,
    toneMapped: true,
  });
  material.userData.isOutline = true;

  outlineMaterialCache.set(key, material);
  return material;
}

/**
 * Hang a contour line off a mesh.
 *
 * Only for things with real volume. A camera-facing flat plane cannot be
 * outlined this way at all: `pos` and `pos2` differ only along view depth, so
 * the "hull" is the same-size quad pushed backwards and you get z-fighting and a
 * smear rather than a line. Posters, sign faces, road markings and glass panes
 * must get their keyline baked into their texture instead — or, better, a real
 * modelled frame around them, which is what a shop window has anyway.
 */
export function addOutline(mesh, { thickness = OUTLINE.detail, color = OUTLINE.cool } = {}) {
  if (mesh.userData.outlined) return mesh.userData.outlined;

  const geometry = mesh.geometry.clone();
  geometry.setAttribute('aOutlineNormal', new THREE.BufferAttribute(smoothedNormals(mesh.geometry), 3));

  const outline = new THREE.Mesh(geometry, outlineMaterial(thickness, color));
  outline.name = `${mesh.name || 'mesh'}:outline`;
  outline.userData.isOutline = true;
  outline.castShadow = false;
  outline.receiveShadow = false;
  // Draw before its parent so the parent's own faces win any depth tie.
  outline.renderOrder = -1;

  mesh.add(outline);
  mesh.userData.outlined = outline;
  return outline;
}

/** Convenience for a whole group, skipping anything flagged `noOutline`. */
export function addOutlines(root, options = {}) {
  const targets = [];
  root.traverse((object) => {
    if (object.isMesh && !object.userData.noOutline && !object.userData.isOutline) targets.push(object);
  });
  for (const mesh of targets) addOutline(mesh, options);
  return targets.length;
}

/* ------------------------------------------------------------------ misc */

/** Triangles and draw calls, for `?debug=1` and for the check script. */
export function countScene(root) {
  let meshes = 0;
  let triangles = 0;
  const materials = new Set();

  root.traverse((object) => {
    if (!object.isMesh && !object.isInstancedMesh) return;
    if (object.userData.isOutline) return;
    meshes += 1;
    materials.add(object.material.uuid);

    const index = object.geometry.index;
    const count = index ? index.count : object.geometry.attributes.position.count;
    const instances = object.isInstancedMesh ? object.count : 1;
    triangles += (count / 3) * instances;
  });

  return { meshes, triangles: Math.round(triangles), materials: materials.size };
}
