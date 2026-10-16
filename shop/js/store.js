/**
 * store.js — the building: shell, roof, glazing, signs, awning, automatic doors.
 *
 * The shop is the only genuinely bright thing in the frame, and everything else
 * in the scene exists to make it look brighter than it is. Three consequences
 * shape this file:
 *
 *   - The walls are PANELS, not a solid box. Two of the four faces are opened up
 *     for glazing and the corner is cut away for the door, so a solid shell would
 *     simply wall off the lit interior that the whole project is about. Each
 *     street face is built as: a pier at each end, a low sill under the glass, a
 *     header over it.
 *
 *   - It has TWO signs, not one. A Japanese corner shop has a long fascia sign
 *     above the glass and a pole sign at the corner, and it is the pole sign that
 *     carries from a distance — and that makes the corner read as a corner.
 *
 *   - The glazing is barely there. Glass at 25% opacity, with a black outline
 *     hull behind it, would paint the interior out. It gets no contour at all,
 *     almost no tint, and no depth write. What reads as "window" is the fresnel
 *     sheen at grazing angles, which is what reads as glass at night anyway.
 */

import * as THREE from 'three';
import { STORE, PALETTE, INTERIOR, OUTLINE, LEVELS, FIXTURES } from './config.js';
import { toon, roundedBox, addOutline } from './toon.js';
import { concrete } from './textures.js';
import { fasciaSign, pylonSign, poster } from './signage.js';
import { glassRunoff } from './weather.js';

const SOUTH = STORE.z1;
const WEST = STORE.x0;
const CHAMFER = STORE.chamfer;
const T = 0.2; // wall thickness

/** Where the 45 degree cut meets each face. */
const CHAMFER_A = { x: WEST, z: SOUTH - CHAMFER };
const CHAMFER_B = { x: WEST + CHAMFER, z: SOUTH };

/* ---------------------------------------------------------------- glass -- */

const GLASS_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 world = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = world.xyz;
    vWorldNormal = normalize( mat3( modelMatrix ) * normal );
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Fresnel only: nearly invisible head on, bright at a glancing angle. This is
 * what makes a shop window read as glass at night, and it costs one draw call
 * and no lighting.
 */
const GLASS_FRAGMENT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  uniform vec3 uTint;
  uniform vec3 uSheen;
  uniform float uBase;
  uniform float uPower;

  void main() {
    vec3 viewDir = normalize( cameraPosition - vWorldPosition );
    float facing = abs( dot( normalize( vWorldNormal ), viewDir ) );
    float fresnel = pow( 1.0 - facing, uPower );

    vec3 color = uSheen * fresnel + uTint * uBase;
    gl_FragColor = vec4( color, clamp( uBase + fresnel * 0.9, 0.0, 1.0 ) );
  }
`;

function glassMaterial(power = 3.2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color(PALETTE.glass) },
      uSheen: { value: new THREE.Color(0xbfe0ff) },
      uBase: { value: 0.06 },
      uPower: { value: power },
    },
    vertexShader: GLASS_VERTEX,
    fragmentShader: GLASS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/* ----------------------------------------------------------------- shell -- */

export function buildStore() {
  const group = new THREE.Group();
  group.name = 'store';

  const walls = toon({ color: PALETTE.wall, map: concrete() });
  const trim = toon({ color: PALETTE.wallShade, map: concrete() });
  const sash = toon({ color: PALETTE.mullion });
  const height = STORE.wall;
  const width = STORE.x1 - STORE.x0;
  const depth = STORE.z1 - STORE.z0;
  const midX = (STORE.x0 + STORE.x1) / 2;
  const midZ = (STORE.z0 + STORE.z1) / 2;

  const panel = (w, h, d, x, y, z, material = walls, name = 'wall', rotY = 0) => {
    const mesh = new THREE.Mesh(roundedBox(w, h, d, 0.012), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  const sillY = STORE.glassSill;
  const topY = STORE.glassTop;
  const headerH = height - topY;

  /* Openings, shared between the walls and the glazing that fills them. */
  const southGlassFrom = CHAMFER_B.x;
  const southGlassTo = STORE.x1 - 0.6;
  const westGlassTo = STORE.z0 + 3.6;

  /* ------------------------------------------------------------ the box -- */

  // Back and east: solid, no openings.
  const wallBack = panel(width, height, T, midX, height / 2, STORE.z0 + T / 2, walls, 'wallBack');
  panel(T, height, depth, STORE.x1 - T / 2, height / 2, midZ, walls, 'wallEast');

  // West face: solid at the back, then sill + header around the window.
  const westSolidTo = westGlassTo;
  const westSolidLen = westSolidTo - STORE.z0;
  panel(T, height, westSolidLen, WEST + T / 2, height / 2, STORE.z0 + westSolidLen / 2, walls, 'wallWestBack');
  const westGlassLen = CHAMFER_A.z - westGlassTo;
  const westGlassMid = westGlassTo + westGlassLen / 2;
  panel(T, sillY, westGlassLen, WEST + T / 2, sillY / 2, westGlassMid, trim, 'wallWestSill');
  panel(T, headerH, westGlassLen, WEST + T / 2, topY + headerH / 2, westGlassMid, walls, 'wallWestHeader');

  // South face: the long window run, with a pier at the east end.
  const southGlassLen = southGlassTo - southGlassFrom;
  const southGlassMid = (southGlassFrom + southGlassTo) / 2;
  const southPierLen = STORE.x1 - southGlassTo;
  panel(southPierLen, height, T, southGlassTo + southPierLen / 2, height / 2, SOUTH - T / 2, walls, 'wallSouthPier');
  panel(southGlassLen, sillY, T, southGlassMid, sillY / 2, SOUTH - T / 2, trim, 'wallSouthSill');
  panel(southGlassLen, headerH, T, southGlassMid, topY + headerH / 2, SOUTH - T / 2, walls, 'wallSouthHeader');

  // The corner, cut off at 45 degrees: a pier either side of the doorway and a
  // header over it, so the entrance is a real hole.
  const chamferFace = Math.hypot(CHAMFER, CHAMFER);
  const doorW = STORE.doorWidth;
  const doorH = STORE.doorHeight;
  const pier = (chamferFace - doorW) / 2;

  const chamferGroup = new THREE.Group();
  chamferGroup.name = 'chamfer';
  chamferGroup.position.set((CHAMFER_A.x + CHAMFER_B.x) / 2, 0, (CHAMFER_A.z + CHAMFER_B.z) / 2);
  chamferGroup.rotation.y = -Math.PI / 4;

  const chamferPiece = (w, h, x, y, material = walls, name = 'chamferPier') => {
    const mesh = new THREE.Mesh(roundedBox(w, h, T, 0.012), material);
    mesh.position.set(x, y, 0);
    mesh.name = name;
    chamferGroup.add(mesh);
    return mesh;
  };
  const chamferPiers = [
    chamferPiece(pier, height, -(doorW + pier) / 2, height / 2),
    chamferPiece(pier, height, (doorW + pier) / 2, height / 2),
    chamferPiece(doorW, height - doorH, 0, doorH + (height - doorH) / 2, trim, 'chamferHeader'),
  ];
  for (const piece of chamferPiers) addOutline(piece, { thickness: OUTLINE.hero, color: 0x0d0f18 });
  group.add(chamferGroup);

  // The main silhouette gets a contour. The individual panels do not — their own
  // rounded edges already catch the key light, and a line on every panel joint
  // turns the wall into a grid.
  addOutline(wallBack, { thickness: OUTLINE.hero, color: 0x0d0f18 });

  /* --------------------------------------------------------- roof plant -- */

  const roofY = height;
  panel(width, 0.16, depth, midX, roofY + 0.08, midZ, trim, 'roofDeck');

  const parapet = STORE.parapet;
  const parapets = [
    { w: width, d: 0.14, x: midX, z: STORE.z0 + 0.07 },
    { w: width, d: 0.14, x: midX, z: STORE.z1 - 0.07 },
    { w: 0.14, d: depth, x: STORE.x0 + 0.07, z: midZ },
    { w: 0.14, d: depth, x: STORE.x1 - 0.07, z: midZ },
  ];
  for (const p of parapets) panel(p.w, parapet, p.d, p.x, roofY + 0.16 + parapet / 2, p.z, walls, 'parapet');

  // The default view is a three-quarter aerial, so the roof is fully in shot and
  // an empty one reads as unfinished.
  const metal = toon({ color: PALETTE.metal });
  const darkMetal = toon({ color: PALETTE.darkMetal });
  const plant = [
    { w: 1.5, h: 0.9, d: 1.1, x: midX - 2.4, z: midZ - 2.2, m: metal },
    { w: 1.2, h: 0.75, d: 1.0, x: midX + 0.4, z: midZ - 2.6, m: metal },
    { w: 0.9, h: 1.35, d: 0.9, x: midX + 2.6, z: midZ + 1.4, m: darkMetal },
    { w: 1.1, h: 0.34, d: 1.1, x: midX - 1.4, z: midZ + 2.3, m: darkMetal },
  ];
  for (const item of plant) {
    const mesh = panel(item.w, item.h, item.d, item.x, roofY + 0.16 + item.h / 2, item.z, item.m, 'roofPlant');
    addOutline(mesh, { thickness: OUTLINE.detail, color: 0x0d0f18 });
  }
  for (const dx of [-0.5, 0, 0.5]) {
    const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), metal);
    upright.position.set(midX - 1.4 + dx, roofY + 0.16 + 0.5 + 0.275, midZ + 2.9);
    group.add(upright);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), metal);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(midX - 1.4, roofY + 0.16 + 1.05, midZ + 2.9);
  group.add(rail);

  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, roofY + 0.2, 8), darkMetal);
  drain.position.set(STORE.x1 - 0.3, (roofY + 0.2) / 2, STORE.z0 + 0.3);
  group.add(drain);

  /* ---------------------------------------------------------- glazing -- */

  const glass = glassMaterial();
  const glassHeight = topY - sillY;

  const addGlazing = (w, x, z, rotY = 0) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, glassHeight), glass);
    pane.position.set(x, sillY + glassHeight / 2, z);
    pane.rotation.y = rotY;
    pane.name = 'glazing';
    pane.userData.noOutline = true;
    group.add(pane);
  };
  // Sits in the middle of the wall thickness, so it is flush with the opening
  // rather than recessed behind it.
  const runoffPanes = [];

  addGlazing(southGlassLen, southGlassMid, SOUTH - T / 2);
  addGlazing(westGlassLen, WEST + T / 2, westGlassMid, Math.PI / 2);

  // Rain running down the outside of each pane.
  const southRunoff = glassRunoff(southGlassLen, glassHeight);
  southRunoff.position.set(southGlassMid, sillY + glassHeight / 2, SOUTH - 0.05);
  runoffPanes.push(southRunoff);
  group.add(southRunoff);

  const westRunoff = glassRunoff(westGlassLen, glassHeight);
  westRunoff.position.set(WEST + 0.05, sillY + glassHeight / 2, westGlassMid);
  westRunoff.rotation.y = Math.PI / 2;
  runoffPanes.push(westRunoff);
  group.add(westRunoff);

  // Aluminium sills, heads and mullions. This is what actually frames a window,
  // and it is also why the glass itself needs no contour: the frame is real
  // geometry and takes the outline instead.
  const addFrame = (w, x, z, rotY = 0) => {
    for (const y of [sillY, topY]) {
      const bar = new THREE.Mesh(roundedBox(w, 0.14, 0.16, 0.02), sash);
      bar.position.set(x, y, z);
      bar.rotation.y = rotY;
      bar.name = 'sash';
      addOutline(bar, { thickness: OUTLINE.detail, color: 0x0d0f18 });
      group.add(bar);
    }
  };
  addFrame(southGlassLen + 0.15, southGlassMid, SOUTH - T + 0.02);
  addFrame(westGlassLen + 0.15, WEST + T - 0.02, westGlassMid, Math.PI / 2);

  const bays = (len) => Math.max(1, Math.round(len / 1.75));
  for (let i = 1; i < bays(southGlassLen); i++) {
    const x = southGlassFrom + (southGlassLen * i) / bays(southGlassLen);
    const m = new THREE.Mesh(roundedBox(STORE.mullion, glassHeight, 0.14, 0.01), sash);
    m.position.set(x, sillY + glassHeight / 2, SOUTH - T + 0.02);
    m.name = 'mullion';
    addOutline(m, { thickness: OUTLINE.detail, color: 0x0d0f18 });
    group.add(m);
  }
  for (let i = 1; i < bays(westGlassLen); i++) {
    const z = westGlassTo + (westGlassLen * i) / bays(westGlassLen);
    const m = new THREE.Mesh(roundedBox(0.14, glassHeight, STORE.mullion, 0.01), sash);
    m.position.set(WEST + T - 0.02, sillY + glassHeight / 2, z);
    m.name = 'mullion';
    addOutline(m, { thickness: OUTLINE.detail, color: 0x0d0f18 });
    group.add(m);
  }

  /* ----------------------------------------------------- automatic door -- */

  const doorGroup = new THREE.Group();
  doorGroup.name = 'doorway';
  doorGroup.position.copy(chamferGroup.position);
  doorGroup.rotation.y = -Math.PI / 4;

  // There used to be a solid plane here, filling the whole opening, dark grey
  // with a warm self-illumination — which is to say an opaque yellow-brown
  // panel across the entrance. The doorway has to be a HOLE: the only things in
  // it now are the two glass leaves and their frames.

  // Light, clear glass, so the shop stays legible through the entrance. The
  // fresnel power is high, which keeps the panes almost invisible head-on and
  // only catches a sheen at a glancing angle.
  const leafMaterial = glassMaterial(4.2);
  leafMaterial.uniforms.uBase.value = 0.04;
  const doorLeaves = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(roundedBox(doorW / 2 - 0.03, doorH - 0.06, 0.035, 0.008), leafMaterial);
    leaf.position.set((side * doorW) / 4, doorH / 2, 0.02);
    leaf.name = side < 0 ? 'doorLeafLeft' : 'doorLeafRight';
    leaf.userData.noOutline = true;
    leaf.userData.closedX = leaf.position.x;
    leaf.userData.openX = (side * doorW) / 4 + (side * doorW) / 2.05;
    doorGroup.add(leaf);
    doorLeaves.push(leaf);

    // Dark aluminium framing on all four sides of each leaf. This is what makes
    // the glass read as a door rather than as a hole.
    const halves = [
      { w: 0.055, h: doorH - 0.06, d: 0.05, x: side * (doorW / 2 - 0.045), y: doorH / 2, z: 0.02 },
      { w: 0.055, h: doorH - 0.06, d: 0.05, x: side * 0.045, y: doorH / 2, z: 0.02 },
      { w: doorW / 2 - 0.03, h: 0.06, d: 0.05, x: (side * doorW) / 4, y: 0.05, z: 0.02 },
      { w: doorW / 2 - 0.03, h: 0.06, d: 0.05, x: (side * doorW) / 4, y: doorH - 0.05, z: 0.02 },
    ];
    for (const bar of halves) {
      const frame = new THREE.Mesh(roundedBox(bar.w, bar.h, bar.d, 0.008), sash);
      frame.position.set(bar.x, bar.y, bar.z);
      frame.name = 'doorFrame';
      frame.userData.noOutline = true;
      doorGroup.add(frame);
    }

    // The white waistline stripe every Japanese automatic door has, which is
    // also what stops the glass disappearing entirely against the interior.
    const stripe = new THREE.Mesh(
      roundedBox(doorW / 2 - 0.09, 0.09, 0.04, 0.006),
      toon({ color: 0xf0f4fa, emissive: 0xf0f4fa, emissiveIntensity: 0.16 }),
    );
    stripe.position.set((side * doorW) / 4, 1.02, 0.045);
    stripe.userData.noOutline = true;
    doorGroup.add(stripe);
  }
  group.add(doorGroup);

  /* ------------------------------------------------------------- awning -- */

  const awningWidth = southGlassLen + 0.8;
  const awningDepth = STORE.awning.depth;
  const awning = new THREE.Group();
  awning.name = 'awning';

  const canopy = new THREE.Mesh(
    roundedBox(awningWidth, 0.09, awningDepth, 0.02),
    toon({ color: 0x39404f, map: concrete() }),
  );
  canopy.position.set(southGlassMid, topY + 0.52, SOUTH + awningDepth / 2 - 0.1);
  canopy.name = 'canopy';
  addOutline(canopy, { thickness: OUTLINE.hero, color: 0x0d0f18 });
  awning.add(canopy);

  // The strip light under the eave: what lights the mat, and what throws the
  // shop's warmth out onto the wet pavement.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(awningWidth - 0.6, 0.07, 0.1),
    toon({ color: 0xffffff, emissive: 0xffdfb0, emissiveIntensity: 1.2 }),
  );
  strip.position.set(southGlassMid, topY + 0.4, SOUTH + awningDepth - 0.34);
  strip.name = 'eaveLight';
  strip.userData.noOutline = true;
  awning.add(strip);

  // Thin tie rods back to the wall, so the canopy is visibly cantilevered and
  // the pavement underneath it stays clear.
  for (const dx of [-awningWidth / 2 + 0.45, 0, awningWidth / 2 - 0.45]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, awningDepth * 1.14, 6), sash);
    rod.rotation.x = Math.PI / 3.1;
    rod.position.set(southGlassMid + dx, topY + 0.36, SOUTH + awningDepth * 0.48);
    rod.userData.noOutline = true;
    awning.add(rod);
  }
  // A brighter leading edge, which is what makes a canopy read at night.
  const lip = new THREE.Mesh(
    roundedBox(awningWidth, 0.1, 0.06, 0.015),
    toon({ color: PALETTE.signWhite, emissive: PALETTE.signGlow, emissiveIntensity: 0.5 }),
  );
  lip.position.set(southGlassMid, topY + 0.5, SOUTH + awningDepth - 0.14);
  lip.userData.noOutline = true;
  awning.add(lip);
  group.add(awning);

  /* -------------------------------------------------------- entrance mat -- */

  /**
   * The mat is a rubber mat, not a hole.
   *
   * At 0x3b4250 under a dark-blue multiplier map it came out at almost exactly
   * black, so the first thing in front of the shop's door was a flat black
   * wedge on the pavement — which I misread as a shadow for two rounds. Two
   * stops lighter, and barely, so it still reads as dark rubber.
   */
  const mat = new THREE.Mesh(
    roundedBox(STORE.mat.w, 0.03, STORE.mat.d, 0.012),
    // No concrete map: it is a rubber mat, and multiplying a dark blue-grey by
    // a dark grey multiplier is how it got to black in the first place. A
    // whisper of emissive, because the entrance is under the eaves where none
    // of the scene's real lights reach.
    toon({ color: 0x8b94a6, emissive: 0x272d3a, emissiveIntensity: 0.6 }),
  );
  mat.position.set(CHAMFER_A.x + CHAMFER / 2 - 0.7, LEVELS.mat - 0.015, CHAMFER_A.z + CHAMFER / 2 + 1.0);
  mat.rotation.y = -Math.PI / 4;
  mat.name = 'entranceMat';
  mat.userData.noOutline = true;
  group.add(mat);

  /* --------------------------------------------------------------- floor -- */

  /**
   * The shop floor, cut to the shape of the building.
   *
   * It used to be a plane one wall-thickness smaller than the building on every
   * side — a RECTANGLE. The building's corner is cut off at 45 degrees, so a
   * triangle of floor 1.8 m across passed straight through the chamfer and lay
   * on the pavement in front of the automatic doors, reading as a blown-out
   * white apron with a hard straight edge. It has been in every render this
   * project has ever produced, including the ones already reviewed, and no
   * coordinate check could have found it: every number in this file was right.
   */
  const innerX0 = STORE.x0 + T;
  const innerX1 = STORE.x1 - T;
  const innerZ0 = STORE.z0 + T;
  const innerZ1 = STORE.z1 - T;

  // The chamfer line is z = x + c. Pushing it in by one wall thickness measured
  // perpendicular to itself moves c by T * sqrt(2).
  const chamferC = CHAMFER_A.z - CHAMFER_A.x - T * Math.SQRT2;
  const chamferOnWest = innerX0 + chamferC; // where it crosses the inner west wall
  const chamferOnSouth = innerZ1 - chamferC; // where it crosses the inner south wall

  const floorShape = new THREE.Shape();
  // Shape space is (x, -z): the geometry is laid flat by rotating -90 degrees
  // about x, which sends the shape's +y to world -z.
  floorShape.moveTo(innerX0, -innerZ0);
  floorShape.lineTo(innerX1, -innerZ0);
  floorShape.lineTo(innerX1, -innerZ1);
  floorShape.lineTo(chamferOnSouth, -innerZ1);
  floorShape.lineTo(innerX0, -chamferOnWest);
  floorShape.closePath();

  const floorGeometry = new THREE.ShapeGeometry(floorShape);
  floorGeometry.rotateX(-Math.PI / 2);

  const floor = new THREE.Mesh(
    floorGeometry,
    // A touch of self-illumination: the shop floor is what actually carries the
    // interior's light back out through the glass, and without it the room reads
    // as lit but not as bright.
    toon({ color: 0xd8cfc0, emissive: PALETTE.interiorLight, emissiveIntensity: 0.3 }),
  );
  floor.position.y = 0.02;
  floor.name = 'shopFloor';
  floor.userData.noOutline = true;
  group.add(floor);

  /* ---------------------------------------------------------------- signs -- */

  const fasciaHeight = STORE.band;
  const fasciaY = height + fasciaHeight / 2;
  const fasciaMap = fasciaSign();
  const signMaterial = toon({
    color: 0xffffff,
    map: fasciaMap,
    // A WARM tint over the map, not white. Untinted white emissive is what made
    // the sign blow out to a featureless blob and take its own lettering with it.
    emissive: PALETTE.signGlow,
    emissiveMap: fasciaMap,
    // Was 1.05, which pushed the whole sign past the bloom threshold and made
    // the lettering dissolve into its own halo.
    emissiveIntensity: 0.78,
  });

  const fasciaSouth = new THREE.Mesh(new THREE.BoxGeometry(width, fasciaHeight, 0.22), signMaterial);
  fasciaSouth.position.set(midX, fasciaY, SOUTH + 0.11);
  fasciaSouth.name = 'fasciaSouth';
  group.add(fasciaSouth);

  const fasciaWest = new THREE.Mesh(new THREE.BoxGeometry(0.22, fasciaHeight, depth), signMaterial);
  fasciaWest.position.set(WEST - 0.11, fasciaY, midZ);
  fasciaWest.name = 'fasciaWest';
  group.add(fasciaWest);

  // A cap over the fascia, so the sign band is a box and not a floating plane.
  panel(width + 0.3, 0.12, depth + 0.3, midX, height + fasciaHeight + 0.06, midZ, trim, 'signCap');

  /* ---------------------------------------------------------------- pylon -- */

  const pylon = new THREE.Group();
  pylon.name = 'pylon';
  // At the EAST end of the frontage, not at the entrance. Any pole on a 2 m
  // pavement beside a glass-walled shop stands in front of something, and at
  // the corner it stood in front of the doors; here it is clear of the west
  // glazing, clear of the entrance, and reads as a counterweight on the right.
  const pylonX = STORE.x1 + 1.5;
  const pylonZ = SOUTH + 0.9;

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 5.8, 12), toon({ color: PALETTE.metal }));
  post.position.set(pylonX, 2.9, pylonZ);
  post.name = 'pylonPost';
  addOutline(post, { thickness: OUTLINE.hero, color: 0x0d0f18 });
  pylon.add(post);

  const pylonMap = pylonSign();
  const pylonMaterial = toon({
    color: 0xffffff,
    map: pylonMap,
    emissive: PALETTE.signGlow,
    emissiveMap: pylonMap,
    emissiveIntensity: 0.82,
  });
  const pylonPanel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 2.0), pylonMaterial);
  pylonPanel.position.set(pylonX, 4.7, pylonZ);
  pylonPanel.name = 'pylonPanel';
  addOutline(pylonPanel, { thickness: OUTLINE.hero, color: 0x0d0f18 });
  pylon.add(pylonPanel);

  const cap = new THREE.Mesh(roundedBox(0.2, 0.12, 2.12, 0.03), toon({ color: PALETTE.darkMetal }));
  cap.position.set(pylonX, 5.78, pylonZ);
  pylon.add(cap);
  group.add(pylon);

  /* -------------------------------------------------------------- posters -- */

  for (let i = 0; i < 3; i++) {
    const map = poster(i);
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.72),
      toon({ color: 0xffffff, map, emissive: PALETTE.signGlow, emissiveMap: map, emissiveIntensity: 0.4, side: THREE.DoubleSide }),
    );
    p.position.set(southGlassFrom + 1.2 + i * 1.6, 1.8, SOUTH - T - 0.04);
    // No rotation: a PlaneGeometry already faces +z, which is the way the street
    // looks in. Rotating it by PI showed the back face of the texture and turned
    // SALE into Ǝ⅃AS.
    p.rotation.y = 0;
    p.name = `windowPoster${i}`;
    p.userData.noOutline = true;
    group.add(p);
  }

  // Where the awning drips from, and where the oden steam rises from.
  const dripPoints = [];
  for (let i = 0; i < 7; i++) {
    dripPoints.push(new THREE.Vector3(
      southGlassMid - awningWidth / 2 + 0.5 + (i * (awningWidth - 1.0)) / 6,
      topY + 0.42,
      SOUTH + awningDepth - 0.18,
    ));
  }

  return {
    group,
    runoffPanes,
    dripPoints,
    // Directly above the oden pot inside, which is the only place steam
    // belongs. It used to be computed from the chamfer and ended up drifting
    // over the bins on the pavement outside.
    steamOrigin: new THREE.Vector3(3.6, 1.0, 1.25),
    fixtures: FIXTURES,
    door: { leaves: doorLeaves, group: doorGroup },
    signs: { fasciaSouth, fasciaWest, pylonMaterial, signMaterial },
    /** The interior module has to fit inside this. */
    interior: {
      x0: WEST + T + 0.05,
      x1: STORE.x1 - T - 0.05,
      z0: STORE.z0 + T + 0.05,
      z1: SOUTH - T - 0.05,
      height: INTERIOR.ceiling,
    },
  };
}
