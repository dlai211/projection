/**
 * reflection.js — the wet road.
 *
 * MeshToonMaterial has no environment reflection and no roughness, so there is
 * no way to get a wet road out of the toon pipeline itself. That is not a
 * limitation to work around, it is the architecture: the road is TWO coplanar
 * layers.
 *
 *   Layer A, in ground.js — ordinary toon asphalt, banded and fogged exactly
 *   like everything else, so the road belongs to the same world.
 *
 *   Layer B, here — a single additive quad that samples a planar reflection and
 *   adds it on top. Additive rather than alpha, because a wet road at night does
 *   not REPLACE the asphalt with a mirror, it ADDS reflected light to a nearly
 *   black surface. It is also far more forgiving: with alpha you would have to
 *   worry about the reflection punching a hole through the asphalt texture.
 *
 * The reflection itself is rendered manually at the top of the frame, outside
 * the composer, rather than from a mesh's onBeforeRender. Firing mid-pass means
 * toggling visibility while the composer holds a buffer bound, and that is a
 * whole family of state-leak bugs avoided by simply doing it in order.
 */

import * as THREE from 'three';
import { WEATHER, QUALITY, LAYERS, PALETTE, LEVELS } from './config.js';
import { puddleMask } from './textures.js';

/** The bias matrix that takes clip space into 0..1 texture space. */
const BIAS = new THREE.Matrix4().set(
  0.5, 0.0, 0.0, 0.5,
  0.0, 0.5, 0.0, 0.5,
  0.0, 0.0, 0.5, 0.5,
  0.0, 0.0, 0.0, 1.0,
);

/** The world plane the road reflects about. */
const PLANE_Y = LEVELS.road + 0.002;

export function buildReflection(renderer, scene) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const scale = QUALITY.reflection.scale;

  const target = new THREE.WebGLRenderTarget(
    Math.max(2, Math.floor(size.x * scale)),
    Math.max(2, Math.floor(size.y * scale)),
    {
      // Not optional: an 8-bit target clamps the emissive signage at 1.0 and the
      // neon loses all of its punch in the reflection.
      type: THREE.HalfFloatType,
      depthBuffer: true,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    },
  );

  const mirrorCamera = new THREE.PerspectiveCamera();
  // Only the default layer: the sky, the road itself, the wet layer and the rain
  // are all on NO_REFLECT, so the mirror never sees its own output.
  mirrorCamera.layers.set(LAYERS.DEFAULT);

  const textureMatrix = new THREE.Matrix4();
  const reflectorPlane = new THREE.Plane();
  const normal = new THREE.Vector3();
  const reflectorWorldPosition = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  const rotationMatrix = new THREE.Matrix4();
  const lookAtPosition = new THREE.Vector3(0, 0, -1);
  const view = new THREE.Vector3();
  const q = new THREE.Vector4();
  const clipPlane = new THREE.Vector4();
  const textureMatrixBias = BIAS.clone();
  const clearColor = new THREE.Color(PALETTE.fog);

  /**
   * Mirrors the camera about the road plane and renders the scene from it.
   * The oblique near-plane clip is copied from three's own Reflector rather than
   * derived — it is the part that stops the plinth's underside and everything
   * below the road from appearing in the mirror.
   */
  function update(camera) {
    reflectorWorldPosition.set(0, PLANE_Y, 0);
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

    rotationMatrix.extractRotation(camera.matrixWorld);
    normal.set(0, 1, 0);
    view.set(0, 0, 1).applyMatrix4(rotationMatrix);

    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);

    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);

    const targetPoint = reflectorWorldPosition.clone().sub(lookAtPosition);
    targetPoint.reflect(normal).negate();
    targetPoint.add(reflectorWorldPosition);

    mirrorCamera.position.copy(view);
    mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    mirrorCamera.lookAt(targetPoint);

    mirrorCamera.fov = camera.fov;
    mirrorCamera.aspect = camera.aspect;
    mirrorCamera.near = camera.near;
    mirrorCamera.far = camera.far;
    mirrorCamera.updateProjectionMatrix();

    textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    textureMatrix.multiply(mirrorCamera.projectionMatrix);
    textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

    // Oblique near-plane clipping, so nothing below the road is reflected.
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    reflectorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);

    clipPlane.set(
      reflectorPlane.normal.x,
      reflectorPlane.normal.y,
      reflectorPlane.normal.z,
      reflectorPlane.constant,
    );

    const projectionMatrix = mirrorCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    q.z = -1.0;
    q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    projectionMatrix.elements[2] = clipPlane.x;
    projectionMatrix.elements[6] = clipPlane.y;
    projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipPlane.w;
    projectionMatrix.elements[14] = clipPlane.w;

    const currentTarget = renderer.getRenderTarget();
    const currentXR = renderer.xr.enabled;
    const currentShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;

    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    // The mirrored sky dome would be plain wrong, so the mirror clears to the
    // fog colour instead and the far road edges blend into it.
    renderer.setClearColor(clearColor, 1);
    renderer.render(scene, mirrorCamera);

    renderer.setRenderTarget(currentTarget);
    renderer.xr.enabled = currentXR;
    renderer.shadowMap.autoUpdate = currentShadow;
  }

  /* ------------------------------------------------------------ wet layer */

  /**
   * One quad over the whole plinth, additive. It samples the reflection through
   * a puddle mask, distorts it with procedural ripples, and fades with the angle
   * of view — a grazing angle reflects far more than looking straight down.
   */
  const wetLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.ShaderMaterial({
      uniforms: {
        tReflect: { value: target.texture },
        tPuddle: { value: puddleMask() },
        textureMatrix: { value: textureMatrix },
        uPuddleScale: { value: WEATHER.puddle.scale },
        uRipple: { value: WEATHER.puddle.ripple },
        uFresnelPower: { value: WEATHER.puddle.fresnel },
        uWetness: { value: WEATHER.puddle.wetness },
        uBreathe: { value: WEATHER.puddle.breathe },
        uTime: { value: 0 },
        uBlur: { value: QUALITY.reflection.blur },
        fogColor: { value: new THREE.Color(PALETTE.fog) },
        fogDensity: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vReflectUv;
        varying vec2 vWorldXZ;
        varying vec3 vWorldPosition;

        void main() {
          vec4 world = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = world.xyz;
          vWorldXZ = world.xz;
          vReflectUv = textureMatrix * world;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tReflect;
        uniform sampler2D tPuddle;
        uniform float uPuddleScale;
        uniform float uRipple;
        uniform float uFresnelPower;
        uniform float uWetness;
        uniform float uBreathe;
        uniform float uTime;
        uniform float uBlur;

        varying vec4 vReflectUv;
        varying vec2 vWorldXZ;
        varying vec3 vWorldPosition;

        // Cheap value noise, for the ripple field.
        float hash( vec2 p ) {
          return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
        }

        void main() {
          float mask = texture2D( tPuddle, vWorldXZ * uPuddleScale ).r;

          // The mask edge swells slowly, so standing water is never quite still.
          mask *= 0.9 + 0.1 * sin( uTime * 0.09 + vWorldXZ.x * 0.2 + vWorldXZ.y * 0.13 );
          mask = smoothstep( 0.08, 0.62, mask + uBreathe * sin( uTime * 0.05 ) );

          // Expanding rings on a jittered grid. Amplitude stays small: above
          // about 0.006 in reflection-UV space this stops reading as water and
          // starts reading as a funhouse mirror.
          vec2 cell = floor( vWorldXZ * 1.6 );
          vec2 local = fract( vWorldXZ * 1.6 ) - 0.5;
          float phase = fract( uTime * 0.9 + hash( cell ) );
          float ring = sin( ( length( local ) - phase * 0.45 ) * 42.0 ) * ( 1.0 - phase );
          vec2 jitter = normalize( local + 0.001 ) * ring * uRipple;

          vec2 uv = vReflectUv.xy / max( vReflectUv.w, 0.0001 ) + jitter;

          // A few vertical taps, which is enough to fake a rough surface and
          // costs almost nothing.
          vec3 reflected = vec3( 0.0 );
          float total = 0.0;
          for ( int i = 0; i < 5; i++ ) {
            if ( float( i ) > uBlur ) break;
            float t = ( float( i ) / max( uBlur, 1.0 ) ) - 0.5;
            float w = 1.0 - abs( t ) * 1.6;
            reflected += texture2D( tReflect, uv + vec2( 0.0, t * 0.014 ) ).rgb * w;
            total += w;
          }
          reflected /= max( total, 0.0001 );

          vec3 viewDir = normalize( cameraPosition - vWorldPosition );
          float fresnel = pow( 1.0 - abs( viewDir.y ), uFresnelPower );

          gl_FragColor = vec4( reflected * mask * fresnel * uWetness, 1.0 );
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  wetLayer.rotation.x = -Math.PI / 2;
  wetLayer.position.y = LEVELS.wet;
  wetLayer.name = 'wetLayer';
  wetLayer.layers.set(LAYERS.NO_REFLECT);
  wetLayer.renderOrder = 2;

  function setSize(width, height) {
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    target.setSize(
      Math.max(2, Math.floor(buffer.x * scale)),
      Math.max(2, Math.floor(buffer.y * scale)),
    );
  }

  function tick(elapsed) {
    wetLayer.material.uniforms.uTime.value = elapsed;
  }

  return { update, tick, wetLayer, texture: target.texture, setSize, mirrorCamera };
}
