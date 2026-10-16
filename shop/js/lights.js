/**
 * lights.js — the light rig, the fog, and the sky.
 *
 * Toon shading bands once per gradient-mapped light, so two lights of similar
 * strength overlap their ramps and the flat cel look turns to mush. The budget
 * is therefore deliberately small: one weak cool key, one ambient lift, and a
 * small number of warm point lights that each clearly own their own patch of
 * ground. Everything else in the scene that *looks* like it is glowing is an
 * emissive material leaning on the bloom pass, and contributes nothing to
 * shading at all.
 *
 * There are no shadow maps. A night scene whose dominant light is interior spill
 * through glass has no meaningful shadow caster — a shadow map would cost a full
 * extra scene render to produce a hard photographic edge that a cel frame does
 * not want. Contact darkening is painted into the textures instead.
 *
 * A system module: everyone imports it, it imports nothing of ours but config.
 */

import * as THREE from 'three';
import { LIGHTS, PALETTE, LAYERS } from './config.js';

/* ------------------------------------------------------------------ sky -- */

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;

  void main() {
    vDir = normalize( position );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

/**
 * Night over a Japanese residential district is never black. There is a warm
 * smear of city light sitting on the horizon, going to deep blue-violet overhead,
 * and that gradient is the cheapest possible way to say "there is a city out
 * there". Its absence is the commonest reason a night diorama feels like it is
 * nowhere in particular.
 */
const SKY_FRAGMENT = /* glsl */ `
  varying vec3 vDir;

  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;

  void main() {
    float h = vDir.y;

    vec3 color = mix( uHorizon, uZenith, smoothstep( -0.02, 0.62, h ) );

    // City glow: a soft warm band hugging the horizon, brightest just above it.
    float band = exp( -abs( h ) * 9.5 );
    color += uGlow * band * 0.42;

    gl_FragColor = vec4( color, 1.0 );

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(PALETTE.skyZenith) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      uGlow: { value: new THREE.Color(PALETTE.cityGlow) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  // A mirrored sky dome is simply wrong, so the wet road reflects the fog
  // colour instead — set as the clear colour during the reflection pass.
  sky.layers.set(LAYERS.NO_REFLECT);
  return sky;
}

/* --------------------------------------------------------------- lights -- */

/**
 * Returns the rig so `anim.js` can drive the two that move — the doorway spill,
 * which brightens only while the doors are open, and the street lamp.
 */
export function buildLights(scene) {
  scene.background = null;
  scene.fog = new THREE.FogExp2(new THREE.Color(PALETTE.fog), LIGHTS.fogDensity);
  scene.add(buildSky());

  // The ambient lift. Ambient and hemisphere light bypass the gradient ramp
  // entirely — they arrive as plain irradiance — which is exactly what a cel
  // frame wants: a flat floor value in the shadows that never collapses the
  // bands above it.
  const ambient = new THREE.HemisphereLight(LIGHTS.ambient.sky, LIGHTS.ambient.ground, LIGHTS.ambient.intensity);
  scene.add(ambient);

  // The one gradient-mapped key, cool and weak. It exists to give the bands
  // something to step against, not to light the scene.
  const key = new THREE.DirectionalLight(LIGHTS.key.color, LIGHTS.key.intensity);
  key.position.set(LIGHTS.key.position.x, LIGHTS.key.position.y, LIGHTS.key.position.z);
  key.castShadow = false;
  scene.add(key);

  const interiorSpill = new THREE.PointLight(
    LIGHTS.interiorSpill.color,
    LIGHTS.interiorSpill.intensity,
    LIGHTS.interiorSpill.distance,
    2,
  );
  interiorSpill.position.set(
    LIGHTS.interiorSpill.position.x,
    LIGHTS.interiorSpill.position.y,
    LIGHTS.interiorSpill.position.z,
  );
  scene.add(interiorSpill);

  // Off by default: `anim.js` fades it up only while the doors are open, so the
  // shop spills a soft rectangle of warm light onto the wet road and then stops.
  const doorway = new THREE.PointLight(LIGHTS.doorway.color, 0, LIGHTS.doorway.distance, 2);
  doorway.position.set(
    LIGHTS.doorway.position.x,
    LIGHTS.doorway.position.y,
    LIGHTS.doorway.position.z,
  );
  scene.add(doorway);

  const streetLamp = new THREE.PointLight(
    LIGHTS.streetLamp.color,
    LIGHTS.streetLamp.intensity,
    LIGHTS.streetLamp.distance,
    2,
  );
  streetLamp.position.set(
    LIGHTS.streetLamp.position.x,
    LIGHTS.streetLamp.position.y,
    LIGHTS.streetLamp.position.z,
  );
  scene.add(streetLamp);

  const vending = new THREE.PointLight(
    LIGHTS.vending.color,
    LIGHTS.vending.intensity,
    LIGHTS.vending.distance,
    2,
  );
  vending.position.set(LIGHTS.vending.position.x, LIGHTS.vending.position.y, LIGHTS.vending.position.z);
  scene.add(vending);

  return { ambient, key, interiorSpill, doorway, streetLamp, vending };
}

/**
 * The colour the reflection pass clears to. It has to be the fog colour, or the
 * mirrored far edge shows a seam against the fogged geometry around it.
 */
export function reflectionClearColor() {
  return new THREE.Color(PALETTE.fog);
}
