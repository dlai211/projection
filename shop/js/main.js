/**
 * main.js — bootstrap and the render loop.
 *
 * This is the only module that touches the DOM, and it is deliberately short:
 * every other module hands back a finished object or a `{ update }`, and this
 * file wires them together and drives them. Imports run one way — system modules
 * (toon, lights, textures) know nothing about ground, store or props.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { CAMERA, MOTION, QUALITY, BASE, PALETTE, LIGHTS, LAYERS, PLAN } from './config.js';
import { toon, roundedBox, addOutline, countScene } from './toon.js';
import { buildLights } from './lights.js';
import { buildGround } from './ground.js';
import { buildStore } from './store.js';
import { buildInterior } from './interior.js';
import { buildPostFX } from './postfx.js';
import { buildReflection } from './reflection.js';
import { buildWeather } from './weather.js';
import { buildProps } from './props.js';
import { buildService } from './service.js';
import { buildAnim } from './anim.js';
import { buildAudio } from './audio.js';

const DEG = Math.PI / 180;

/* --------------------------------------------------------------- renderer */

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.pixelRatioCap));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LIGHTS.exposure;
// No shadow maps anywhere. See lights.js for why.
renderer.shadowMap.enabled = false;

/* ------------------------------------------------------------------ scene */

const scene = new THREE.Scene();

/** Everything on the plinth lives under here, so passes can toggle it wholesale. */
const world = new THREE.Group();
world.name = 'world';
scene.add(world);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);

// The main camera sees both layers. The reflection camera in reflection.js is
// restricted to LAYERS.DEFAULT, which is how anything on NO_REFLECT — the sky,
// the road itself, the rain — stays out of the wet-road mirror.
camera.layers.enable(LAYERS.NO_REFLECT);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = CAMERA.damping;
controls.minDistance = CAMERA.minDistance;
controls.maxDistance = CAMERA.maxDistance;
controls.minPolarAngle = CAMERA.minPolarAngle;
// Never quite down to the slab's underside: the bottom of a model is where
// "unfinished" shows.
controls.maxPolarAngle = CAMERA.maxPolarAngle;
controls.enablePan = true;
controls.zoomSpeed = 0.8;
controls.rotateSpeed = 0.65;

const rig = buildLights(scene);

/* ------------------------------------------------- Phase 1 test strip ---- */

/**
 * Temporary. A strip of the shapes that stress the cel-shading pipeline in
 * different ways — it is how the contour line gets eyeballed on a rounded box,
 * a hard-edged box, a thin tube and a camera-facing plane before any real
 * geometry is built on top of it. Removed once the model itself exists.
 */
function buildTestStrip() {
  const strip = new THREE.Group();
  strip.name = 'testStrip';

  const slab = new THREE.Mesh(
    roundedBox(BASE.size, BASE.depth, BASE.size, BASE.chamfer),
    toon({ color: PALETTE.concrete }),
  );
  slab.position.y = -BASE.depth / 2;
  slab.name = 'testSlab';
  strip.add(slab);
  addOutline(slab, { thickness: 0.0021, color: 0x0d0f18 });

  // A neutral backdrop, so the contour line can actually be judged. Dark ink on
  // a dark night sky is invisible, and "the outline is secretly broken" and "the
  // outline is fine but there is nothing to see it against" look identical.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 5),
    toon({ color: 0x9aa3b4, side: THREE.DoubleSide }),
  );
  backdrop.position.set(0, 2.4, -2.6);
  backdrop.name = 'testBackdrop';
  backdrop.userData.noOutline = true;
  strip.add(backdrop);

  const swatch = (geometry, x, z, height, color) => {
    const mesh = new THREE.Mesh(geometry, toon({ color }));
    mesh.position.set(x, height / 2, z);
    mesh.name = `test:${x}`;
    strip.add(mesh);
    return mesh;
  };

  // Hard-edged box: the case where a naive hull tears open at every corner.
  addOutline(swatch(roundedBox(1, 1.4, 1, 0.004), -5, 0, 1.4, 0x9aa6bd), { thickness: 0.0021 });

  // Rounded box: what most of the model will actually be built from.
  addOutline(swatch(roundedBox(1.2, 1.0, 1.2, 0.06), -3, 0, 1.0, 0xc2cbd9), { thickness: 0.0021 });

  // Cylinder: smooth normals, so the hull should be clean.
  addOutline(swatch(new THREE.CylinderGeometry(0.35, 0.42, 1.6, 20), -1, 0, 1.6, 0x8fa0bb), {
    thickness: 0.0021,
  });

  // Sphere: the easy case, as a control.
  addOutline(swatch(new THREE.SphereGeometry(0.6, 24, 16), 1, 0, 1.2, 0xb7c1d2), {
    thickness: 0.0021,
  });

  // Thin tube: where an outline self-intersects and turns the object into a
  // black blob, so it gets no contour at all and relies on a dark material.
  swatch(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), 3, 0, 2.2, 0x2b3141);

  // Camera-facing flat plane: cannot be outlined by a hull at all — the offset
  // is along view depth, giving a smear. Excluded on purpose.
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    toon({ color: 0xd9e2f0, emissive: 0x66512a, emissiveIntensity: 2.4, side: THREE.DoubleSide }),
  );
  plane.position.set(5, 0.8, 0);
  plane.name = 'test:flatPlane';
  plane.userData.noOutline = true;
  strip.add(plane);

  return strip;
}

const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

world.add(buildGround());
const store = buildStore();
world.add(store.group);
world.add(buildInterior(store.interior).group);
if (DEBUG) world.add(buildTestStrip());

/* --------------------------------------------------------------- camera -- */

const startPosition = new THREE.Vector3(CAMERA.start.x, CAMERA.start.y, CAMERA.start.z);
const startTarget = new THREE.Vector3(CAMERA.target.x, CAMERA.target.y, CAMERA.target.z);

/** The intro starts further out and level, then eases in and settles. */
const introFrom = startTarget
  .clone()
  .add(startPosition.clone().sub(startTarget).multiplyScalar(MOTION.intro.from))
  .add(new THREE.Vector3(0, 3.2, 0));

camera.position.copy(introFrom);
controls.target.copy(startTarget);
controls.update();

let introElapsed = 0;
let introRunning = true;

function endIntro() {
  if (!introRunning) return;
  introRunning = false;
  controls.enabled = true;
}

// Any touch of the model cancels the opening move rather than fighting it.
for (const type of ['pointerdown', 'wheel', 'touchstart']) {
  canvas.addEventListener(type, endIntro, { passive: true, once: true });
}

/* --------------------------------------------------------------- resize -- */

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);

  const aspect = width / height;
  camera.aspect = aspect;

  // A tall, narrow window (a snapped half-screen laptop) would crop the sides
  // off the model with a fixed vertical fov, so open it up until the horizontal
  // fov is wide enough to hold the whole base.
  const horizontal = 2 * Math.atan(Math.tan(CAMERA.fov * DEG * 0.5) * aspect) / DEG;
  camera.fov = horizontal < CAMERA.minHorizontalFov
    ? Math.min(70, 2 * Math.atan(Math.tan(CAMERA.minHorizontalFov * DEG * 0.5) / aspect) / DEG)
    : CAMERA.fov;

  camera.updateProjectionMatrix();
}

const props = buildProps();
world.add(props.group);

// The delivery yard behind the shop.
const service = buildService({ z0: -7 });
world.add(service.group);

const reflection = buildReflection(renderer, scene);
world.add(reflection.wetLayer);

const weather = buildWeather({
  roadRects: PLAN.roads,
  dripPoints: store.dripPoints,
  runoffPanes: store.runoffPanes,
  steamOrigin: store.steamOrigin,
});
world.add(weather.group);

const audio = buildAudio();
const audioPanel = document.getElementById('audio');

// Audio cannot start without a gesture, and the first click anywhere is it.
for (const type of ['pointerdown', 'keydown']) {
  window.addEventListener(type, () => audio.start(), { once: true, passive: true });
}

if (audioPanel) {
  const toggle = document.getElementById('audio-toggle');
  const slider = document.getElementById('audio-level');

  // The only interface on the page, and it stays out of the way: barely
  // visible until the pointer is over it.
  const sync = () => {
    audioPanel.classList.toggle('muted', !audio.enabled);
    slider.value = String(Math.round(audio.volume * 100));
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    audio.toggle();
    sync();
  });

  slider.addEventListener('input', (event) => {
    event.stopPropagation();
    audio.setVolume(Number(event.target.value) / 100);
    sync();
  });

  // Orbiting the model must not start while the pointer is on the panel.
  for (const type of ['pointerdown', 'pointerup', 'click', 'wheel', 'dblclick']) {
    audioPanel.addEventListener(type, (event) => event.stopPropagation());
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'm' || event.key === 'M') {
      audio.toggle();
      sync();
    }
  });

  sync();
}

const anim = buildAnim({ door: store.door, lights: rig, props });
anim.register(store.signs, null);

const postfx = buildPostFX(renderer, scene, camera);

function applySize() {
  resize();
  postfx.setSize(window.innerWidth, window.innerHeight);
  reflection.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', applySize);
applySize();

/* ----------------------------------------------------------------- loop -- */

const clock = new THREE.Clock();
const showCounters = DEBUG;
let frames = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  if (introRunning) {
    introElapsed += dt;
    const t = Math.min(introElapsed / MOTION.intro.duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(introFrom, startPosition, eased);
    if (t >= 1) endIntro();
  }

  // The look-at point is free to be dragged, but it is penned into a small box
  // around the model so the diorama can never be pushed off-screen and lost.
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, startTarget.x - CAMERA.panLimit, startTarget.x + CAMERA.panLimit);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, startTarget.y + CAMERA.panLimit);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, startTarget.z - CAMERA.panLimit, startTarget.z + CAMERA.panLimit);

  controls.update();

  // The mirror is rendered by hand, before the composer, and never from inside a
  // pass: toggling visibility while the composer holds a buffer bound is a
  // family of state-leak bugs avoided by simply keeping the order explicit.
  if (frames % QUALITY.reflection.updateEvery === 0) reflection.update(camera);
  reflection.tick(elapsed);
  weather.tick(elapsed, camera, controls.target);
  anim.update(elapsed, dt, camera);

  // The truck's hazards: amber, blinking, and the only thing back here that
  // moves at a rhythm quicker than the traffic signal.
  const hazardOn = Math.floor(elapsed * 1.3) % 2 === 0;
  for (const lamp of service.hazards) {
    lamp.material.emissiveIntensity = hazardOn ? 2.6 : 0.1;
  }

  postfx.composer.render(dt);

  if (showCounters && ++frames % 60 === 0) report();
}

/** `?debug=1` only. The scene itself never shows a number to anyone. */
function report() {
  const stats = countScene(world);
  console.log(
    `[shop] frame ${frames} · ${stats.meshes} meshes · ${stats.triangles} tris · ` +
      `${stats.materials} materials · ${renderer.info.render.calls} calls drawn`,
  );
}

// Draw one frame before handing over to the animation loop, so the model is
// never caught half-built behind the veil — and so a headless capture has
// something real in the buffer even if the compositor never ticks.
reflection.update(camera);
postfx.composer.render(0);
if (showCounters) report();

renderer.setAnimationLoop(frame);

/* ---------------------------------------------------------------- ready -- */

// One frame is already in the buffer by now (drawn synchronously above), so the
// veil can lift without ever showing a half-built model.
window.__shopBooted = true;
document.body.classList.add('ready');

// Remove the veil outright once it has faded, rather than trusting the
// transition to have run. If it never fires — a reduced-motion setting, a
// headless compositor, a backgrounded tab — the timer still clears it.
const veil = document.getElementById('veil');
if (veil) {
  veil.addEventListener('transitionend', () => veil.remove(), { once: true });
  setTimeout(() => veil.remove(), 2200);
}
