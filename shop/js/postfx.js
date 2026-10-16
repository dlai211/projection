/**
 * postfx.js — the compositor: bloom, grade, and the output transform.
 *
 * The order is not negotiable:
 *
 *   RenderPass -> UnrealBloomPass -> grade -> OutputPass
 *
 * `OutputPass` is what applies the tone map and the sRGB encode, and it has to
 * be last. Anything after it is working in display space and will look wrong;
 * anything before it is working in linear HDR, which is where bloom wants to be.
 *
 * The one thing that catches everybody: three.js SKIPS tone mapping whenever it
 * renders into a render target, and the composer's buffers are render targets.
 * So the composer's contents are LINEAR and un-tone-mapped, and UnrealBloomPass
 * is thresholding against linear luminance. A neon panel at sRGB #ff5a3c sits at
 * a linear luminance of about 0.22 — nowhere near a 0.85 default threshold — so
 * nothing blooms and you conclude the pass is broken. The threshold in config is
 * therefore a linear number well below 1, and the emissive intensities on the
 * sign materials are in the 1.5 to 6 range to clear it.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY } from './config.js';

/**
 * The grade. Runs in linear space, before the output transform, so the lift and
 * the contrast are operating on scene-referred values rather than on pixels.
 *
 * Deliberately no film grain: it fights clean cel shading, and a scene this
 * stylised does not want photographic noise on it.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: QUALITY.grade.vignette },
    uAberration: { value: QUALITY.grade.aberration },
    uLift: { value: new THREE.Vector3(0.006, 0.010, 0.026) },
    uContrast: { value: QUALITY.grade.contrast },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uAberration;
    uniform vec3 uLift;
    uniform float uContrast;

    varying vec2 vUv;

    void main() {
      vec2 centre = vUv - 0.5;
      float radius = length( centre );

      // A little lateral chromatic aberration towards the edges only. Applying
      // it across the whole frame just makes everything look out of focus.
      vec2 offset = centre * radius * uAberration * 0.01;
      vec3 color = vec3(
        texture2D( tDiffuse, vUv + offset ).r,
        texture2D( tDiffuse, vUv ).g,
        texture2D( tDiffuse, vUv - offset ).b
      );

      // Lift the blacks towards blue rather than leaving them neutral: a night
      // frame with pure black shadows reads as a hole, not as darkness.
      color += uLift * ( 1.0 - smoothstep( 0.0, 0.35, dot( color, vec3( 0.333 ) ) ) );

      color = ( color - 0.5 ) * uContrast + 0.5;

      float vignette = smoothstep( 0.92, 0.28, radius );
      color *= mix( 1.0, vignette, uVignette );

      gl_FragColor = vec4( max( color, 0.0 ), 1.0 );
    }
  `,
};

export function buildPostFX(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());

  // The composer's own buffers are NOT multisampled, whatever `antialias: true`
  // was passed to the renderer — that only affects the default framebuffer. Ask
  // for samples on the target or the composed image comes out jaggier than the
  // uncompressed one, which is a genuinely confusing thing to look at.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: QUALITY.msaaSamples,
  });

  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.pixelRatioCap));

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    // The mip chain starts here and halves five times, so passing half the
    // canvas means the whole blur lives at a quarter of the pixels.
    new THREE.Vector2(size.x * QUALITY.bloom.resolution, size.y * QUALITY.bloom.resolution),
    QUALITY.bloom.strength,
    QUALITY.bloom.radius,
    QUALITY.bloom.threshold,
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  function setSize(width, height) {
    composer.setSize(width, height);
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    bloom.setSize(buffer.x * QUALITY.bloom.resolution, buffer.y * QUALITY.bloom.resolution);
  }

  return { composer, bloom, grade, setSize };
}
