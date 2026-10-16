/**
 * weather.js — rain, splashes, drips, runoff on the glass, and steam.
 *
 * All of it runs on the GPU with no per-frame JavaScript: every drop's position
 * is a pure function of its own seed and the clock, evaluated in the vertex
 * shader. Four thousand streaks is two draw calls and no CPU at all; four
 * thousand meshes would be fatal, and that gap is the whole argument for doing
 * it this way.
 *
 * Two things here are doing more work than they look like they should:
 *
 *   - Rain is TWO layers, near and far, with different speeds and sizes. The
 *     parallax between them is what makes rain read as volume. One layer reads
 *     as a texture laid over the camera.
 *
 *   - Rain must be UNLIT. A lit streak picks up the toon bands and stops looking
 *     like water; it also gets shaded by lights it is nowhere near. These are
 *     plain additive shaders that no light touches.
 */

import * as THREE from 'three';
import { WEATHER, PALETTE, LAYERS } from './config.js';
import { softDot } from './textures.js';

/* ----------------------------------------------------------------- rain -- */

const RAIN_VERTEX = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aSpeed;
  attribute float aLength;
  attribute float aAlpha;

  uniform float uTime;
  uniform vec3 uBox;
  uniform vec3 uCentre;
  uniform vec2 uWind;
  uniform float uWidth;
  uniform float uFadeFar;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vFade;

  void main() {
    vUv = uv;

    // Fall, then wrap. The seed fixes each drop's column and phase for good.
    float span = uBox.y * 2.0;
    float y = mod( aSeed.y * span - uTime * aSpeed, span ) - uBox.y;

    vec3 world = vec3(
      ( aSeed.x - 0.5 ) * uBox.x * 2.0,
      y,
      ( aSeed.z - 0.5 ) * uBox.z * 2.0
    ) + uCentre;

    // Wind shears the column: drops lower down have drifted further. Without
    // this the rain falls in perfectly straight vertical lines, which reads as
    // a screensaver rather than as weather.
    world.xz += uWind * ( uBox.y - y ) * 0.05;

    vec3 up = vec3( 0.0, 1.0, 0.0 );
    vec3 toCamera = normalize( cameraPosition - world );
    vec3 right = normalize( cross( up, toCamera ) );
    vec3 fall = normalize( vec3( uWind.x, -1.0, uWind.y ) );

    vec3 offset = right * ( position.x * uWidth ) + fall * ( position.y * aLength );
    vec4 mvPosition = viewMatrix * vec4( world + offset, 1.0 );

    vAlpha = aAlpha;

    // Fade the far edge of the box, or the rain stops at a visible wall, and
    // fade anything very close to the camera so it does not smear the frame.
    float dist = length( mvPosition.xyz );
    vFade = smoothstep( uFadeFar, uFadeFar * 0.5, dist ) * smoothstep( 0.5, 2.2, dist );

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vFade;

  void main() {
    // Round the ends of the streak, or every drop is a rectangle.
    float along = smoothstep( 0.0, 0.32, vUv.y ) * smoothstep( 1.0, 0.55, vUv.y );
    float across = smoothstep( 0.0, 0.45, vUv.x ) * smoothstep( 1.0, 0.55, vUv.x );

    float alpha = along * across * vAlpha * vFade * uOpacity;
    if ( alpha < 0.004 ) discard;

    gl_FragColor = vec4( uColor, alpha );
  }
`;

function rainLayer(count, { length, width, opacity, speed, color }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);

  const seeds = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const lengths = new Float32Array(count);
  const alphas = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    speeds[i] = speed.min + Math.random() * (speed.max - speed.min);
    lengths[i] = length * (0.7 + Math.random() * 0.6);
    alphas[i] = 0.55 + Math.random() * 0.45;
  }

  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  geometry.setAttribute('aLength', new THREE.InstancedBufferAttribute(lengths, 1));
  geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(alphas, 1));
  geometry.instanceCount = count;
  // It follows the camera, so it must never be culled as a whole.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBox: { value: new THREE.Vector3(WEATHER.rain.box.x, WEATHER.rain.box.y, WEATHER.rain.box.z) },
      uCentre: { value: new THREE.Vector3() },
      uWind: { value: new THREE.Vector2(WEATHER.wind.x, WEATHER.wind.z) },
      uWidth: { value: width },
      uFadeFar: { value: WEATHER.rain.fade.far },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.name = 'rain';
  mesh.layers.set(LAYERS.NO_REFLECT);
  return mesh;
}

/* -------------------------------------------------------------- splash -- */

/**
 * Expanding rings where drops land. These matter more than the falling drops
 * do: they are what puts the rain ON the ground rather than in front of it.
 */
const SPLASH_VERTEX = /* glsl */ `
  attribute vec3 aPlace;
  attribute float aPhase;

  uniform float uTime;
  uniform float uLife;
  uniform float uRadius;

  varying float vLife;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    float t = fract( uTime / uLife + aPhase );
    vLife = t;

    float scale = uRadius * ( 0.25 + t * 1.5 );
    vec3 world = aPlace + vec3( position.x * scale, 0.0, position.y * scale );

    // A ring, not a disc: push the quad outward from its own centre.
    gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
  }
`;

const SPLASH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;

  varying float vLife;
  varying vec2 vUv;

  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    // A thin expanding ring, fading as it grows.
    float ring = smoothstep( 0.62, 0.86, d ) * smoothstep( 1.0, 0.9, d );
    float alpha = ring * ( 1.0 - vLife ) * 0.5;
    if ( alpha < 0.004 ) discard;
    gl_FragColor = vec4( uColor, alpha );
  }
`;

function splashLayer(rects) {
  const count = WEATHER.splash.count;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('uv', quad.attributes.uv);

  const places = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const totalArea = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

  for (let i = 0; i < count; i++) {
    let pick = Math.random() * totalArea;
    let chosen = rects[0];
    for (const rect of rects) {
      const area = (rect.x1 - rect.x0) * (rect.z1 - rect.z0);
      if (pick <= area) { chosen = rect; break; }
      pick -= area;
    }
    places[i * 3] = chosen.x0 + Math.random() * (chosen.x1 - chosen.x0);
    places[i * 3 + 1] = -0.124;
    places[i * 3 + 2] = chosen.z0 + Math.random() * (chosen.z1 - chosen.z0);
    phases[i] = Math.random();
  }

  geometry.setAttribute('aPlace', new THREE.InstancedBufferAttribute(places, 3));
  geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geometry.instanceCount = count;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLife: { value: WEATHER.splash.life },
      uRadius: { value: WEATHER.splash.radius },
      uColor: { value: new THREE.Color(0xd6e6ff) },
    },
    vertexShader: SPLASH_VERTEX,
    fragmentShader: SPLASH_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.name = 'splash';
  mesh.layers.set(LAYERS.NO_REFLECT);
  return mesh;
}

/* --------------------------------------------------------------- drips -- */

/**
 * Drips off the awning edge, from fixed points rather than from the sky. These
 * are worth more than their cost because they tie the building to the weather:
 * rain coming off the roof is what says the roof is wet.
 */
function buildDrips(points) {
  const group = new THREE.Group();
  group.name = 'drips';
  const material = new THREE.MeshBasicMaterial({
    color: 0xd8e8ff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  for (let i = 0; i < points.length; i++) {
    const drop = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.1), material);
    drop.position.copy(points[i]);
    drop.userData.phase = Math.random();
    drop.userData.speed = 0.9 + Math.random() * 0.5;
    drop.layers.set(LAYERS.NO_REFLECT);
    group.add(drop);
  }

  function update(elapsed, camera) {
    for (const drop of group.children) {
      const t = (elapsed * drop.userData.speed + drop.userData.phase) % 1;
      drop.position.y = points[group.children.indexOf(drop)].y - t * WEATHER.drip.fall;
      drop.scale.y = 1 + t * 1.6;
      drop.material.opacity = 0.5 * (1 - t * 0.7);
      drop.quaternion.copy(camera.quaternion);
    }
  }

  return { group, update };
}

/* -------------------------------------------------------- glass runoff -- */

/**
 * Rain running down the shop windows. A scrolling procedural streak texture on
 * a plane just outside the glass.
 *
 * The streaks have to run at different speeds and have thinner tails than
 * heads, or it reads as a texture scrolling past rather than as water finding
 * its way down a pane.
 */
export function glassRunoff(width, height) {
  const size = 256;
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const context = element.getContext('2d');

  context.fillStyle = '#000000';
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 46; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 30 + Math.random() * 150;
    const thickness = 0.6 + Math.random() * 2.2;

    const gradient = context.createLinearGradient(x, y, x, y + length);
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.strokeStyle = gradient;
    context.lineWidth = thickness;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (Math.random() - 0.5) * 6, y + length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(element);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      tStreak: { value: texture },
      uTime: { value: 0 },
      uSpeed: { value: WEATHER.glass.streakSpeed },
      uOpacity: { value: WEATHER.glass.opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tStreak;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        // Two layers at different rates, so the runoff never looks like one
        // sheet sliding down the glass.
        vec2 a = vec2( vUv.x * 3.0, vUv.y * 1.6 + uTime * uSpeed );
        vec2 b = vec2( vUv.x * 5.0 + 0.37, vUv.y * 2.4 + uTime * uSpeed * 1.7 );
        float streak = texture2D( tStreak, a ).r * 0.65 + texture2D( tStreak, b ).r * 0.45;

        // Nothing runs off the top edge of the pane.
        float fade = smoothstep( 0.0, 0.22, vUv.y );
        gl_FragColor = vec4( vec3( 0.72, 0.82, 1.0 ), streak * uOpacity * fade );
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = 'glassRunoff';
  mesh.layers.set(LAYERS.NO_REFLECT);
  return mesh;
}

/* --------------------------------------------------------------- steam -- */

function buildSteam(origin) {
  const count = WEATHER.steam.count;
  const group = new THREE.Group();
  group.name = 'steam';
  const material = new THREE.MeshBasicMaterial({
    map: softDot(),
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffe8cc,
  });

  const puffs = [];
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), material);
    puff.userData.phase = Math.random();
    puff.userData.offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      0,
      (Math.random() - 0.5) * 0.4,
    );
    puff.userData.drift = (Math.random() - 0.5) * 0.12;
    puff.layers.set(LAYERS.NO_REFLECT);
    group.add(puff);
    puffs.push(puff);
  }

  function update(elapsed, camera) {
    for (const puff of puffs) {
      const t = (elapsed / WEATHER.steam.life + puff.userData.phase) % 1;
      puff.position.set(
        origin.x + puff.userData.offset.x + puff.userData.drift * t,
        origin.y + t * WEATHER.steam.rise * WEATHER.steam.life,
        origin.z + puff.userData.offset.z,
      );
      const scale = 0.3 + t * 1.4;
      puff.scale.setScalar(scale);
      const fade = Math.sin(t * Math.PI);
      puff.material.opacity = 0.16 * fade;
      puff.quaternion.copy(camera.quaternion);
    }
  }

  return { group, update };
}

/* ------------------------------------------------------------------ api -- */

export function buildWeather({ roadRects, dripPoints, runoffPanes, steamOrigin }) {
  const group = new THREE.Group();
  group.name = 'weather';

  const near = rainLayer(WEATHER.rain.near, {
    length: WEATHER.rain.streak.near * 1.5,
    width: 0.014,
    opacity: WEATHER.rain.opacity.near,
    speed: WEATHER.rain.speed.near,
    color: 0xaec8ff,
  });
  const far = rainLayer(WEATHER.rain.far, {
    length: WEATHER.rain.streak.far * 1.5,
    width: 0.01,
    opacity: WEATHER.rain.opacity.far,
    speed: WEATHER.rain.speed.far,
    color: 0x8fa8d8,
  });
  group.add(near, far);

  const splash = splashLayer(roadRects);
  group.add(splash);

  const drips = buildDrips(dripPoints);
  group.add(drips.group);

  const steam = buildSteam(steamOrigin);
  group.add(steam.group);

  for (const pane of runoffPanes) group.add(pane);

  function tick(elapsed, camera, focus) {
    near.material.uniforms.uTime.value = elapsed;
    far.material.uniforms.uTime.value = elapsed;
    splash.material.uniforms.uTime.value = elapsed;
    for (const pane of runoffPanes) pane.material.uniforms.uTime.value = elapsed;

    // The rain volume is centred between the camera and whatever it is looking
    // at, weighted towards the model. Centring it on the camera alone — which is
    // what this used to do — puts the whole shop outside the box whenever the
    // camera is out over a corner of the base, and it stops raining on the one
    // thing the scene is about.
    const anchor = focus || camera.position;
    const centre = camera.position.clone().lerp(anchor, WEATHER.rain.focusBias);
    centre.y = 0;
    near.material.uniforms.uCentre.value.copy(centre).setY(WEATHER.rain.box.y * 0.34);
    const farCentre = centre.clone().multiplyScalar(0.72);
    far.material.uniforms.uCentre.value.set(farCentre.x, WEATHER.rain.box.y * 0.34, farCentre.z);

    drips.update(elapsed, camera);
    steam.update(elapsed, camera);
  }

  return { group, tick };
}
