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

/* ----------------------------------------------------------------- views -- */

/**
 * Named camera setups, reachable as `?view=<name>`.
 *
 * These exist because "the pole is in the way" is not a fact about a coordinate,
 * it is a fact about a picture, and there was no way to look at a picture. Each
 * preset is a position and a target in metres; `fov` is optional and overrides
 * the default lens.
 *
 * A preset is NOT an orbit. The controls are switched off rather than clamped,
 * because `controls.minPolarAngle` refuses to point straight down and would
 * quietly tilt the top-down view — which is the one view where a tilt would
 * hide exactly the alignment errors it exists to find.
 */
const VIEWS = {
  /** The three-quarter view the page opens on. */
  default: {
    position: CAMERA.start,
    target: CAMERA.target,
  },
  /** Straight down on the whole 26 m base: the plan view. */
  topdown: {
    position: { x: 0, y: 32, z: 0.01 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50, // 2 * atan(13/32) is 44.2 deg; 50 leaves a margin round the plinth
  },
  /** The delivery yard, from the back-left corner, close in. */
  backyard: {
    position: { x: -12, y: 8, z: -14 },
    target: { x: 0, y: 1.5, z: -8 },
  },
  /** The junction: both crossings, the kerbs and every pole. */
  intersection: {
    position: { x: -12, y: 6, z: 12 },
    target: { x: -5, y: 1, z: 4 },
  },
  /**
   * Straight down over the junction, close.
   *
   * The plan view above covers the whole 26 m base, which puts a 45 cm crossing
   * bar at fifteen pixels — enough to see that there IS a crossing, not enough
   * to see which way its bars run. This is the same information at 100 px/m.
   * Markings are painted on the ground, so there is no perspective smear here
   * and every line is at its true plan position.
   */
  junction: {
    position: { x: -6.5, y: 19, z: 6.0 },
    target: { x: -6.5, y: 0, z: 5.99 },
    fov: 36, // 12.3 m of ground, centred so the side street's stop line is in shot
  },
  /**
   * Up the chamfer's own outward normal, standing on the pavement at eye
   * height — the view a customer has. Close in, because the things that go
   * wrong at an entrance (the threshold, the mat, the sill, what the ground
   * does where the light stops) are all within a couple of metres of the door.
   */
  entrance: {
    position: { x: -5.6, y: 1.62, z: 4.3 },
    target: { x: -3.6, y: 0.55, z: 1.6 },
  },
};

const params = new URLSearchParams(location.search);
const view = VIEWS[params.get('view')] ?? null;
const viewFov = view?.fov ?? null;

/**
 * `?still=1` freezes the clock at one moment. Two captures of the same view
 * then differ only where the model actually changed, instead of being two
 * different instants of rain — which is what makes a screenshot worth comparing
 * against the previous round's.
 */
const STILL = params.get('still') === '1';
const STILL_TIME = 6.4;

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

let introElapsed = 0;
let introRunning = !view && !STILL;

if (view) {
  // A fixed camera. `lookAt` rather than `controls.update`, so the preset lands
  // exactly where it says it does.
  camera.position.set(view.position.x, view.position.y, view.position.z);
  controls.target.set(view.target.x, view.target.y, view.target.z);
  camera.lookAt(controls.target);
  controls.enabled = false;
} else {
  camera.position.copy(STILL ? startPosition : introFrom);
  controls.target.copy(startTarget);
  controls.update();
}

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
  const base = viewFov ?? CAMERA.fov;
  const horizontal = 2 * Math.atan(Math.tan(base * DEG * 0.5) * aspect) / DEG;
  camera.fov = horizontal < CAMERA.minHorizontalFov
    ? Math.min(70, 2 * Math.atan(Math.tan(CAMERA.minHorizontalFov * DEG * 0.5) / aspect) / DEG)
    : base;

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

/**
 * One frame's worth of updating, with no drawing in it.
 *
 * Split out from the loop because the same work has to happen ONCE,
 * synchronously, before the first paint. That is not only for the opening
 * frame: under `--virtual-time-budget` a headless capture can finish without
 * the compositor ever ticking a requestAnimationFrame, so anything left to the
 * loop is simply absent from the screenshot. The rain was — there was no
 * weather in any still capture, which is why every still capture looked a
 * little wrong in a way that was hard to name.
 */
function step(dt, elapsed) {
  if (introRunning) {
    introElapsed += dt;
    const t = Math.min(introElapsed / MOTION.intro.duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(introFrom, startPosition, eased);
    if (t >= 1) endIntro();
  }

  if (!view) {
    // The look-at point is free to be dragged, but it is penned into a small box
    // around the model so the diorama can never be pushed off-screen and lost.
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, startTarget.x - CAMERA.panLimit, startTarget.x + CAMERA.panLimit);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, startTarget.y + CAMERA.panLimit);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, startTarget.z - CAMERA.panLimit, startTarget.z + CAMERA.panLimit);

    controls.update();
  }

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
}

function frame() {
  const dt = STILL ? 0 : Math.min(clock.getDelta(), 0.1);
  const elapsed = STILL ? STILL_TIME : clock.elapsedTime;
  frames++;

  step(dt, elapsed);
  postfx.composer.render(dt);

  if (showCounters && frames % 60 === 0) report();
}

/** `?debug=1` only. The scene itself never shows a number to anyone. */
function report() {
  const stats = countScene(world);
  console.log(
    `[shop] frame ${frames} · ${stats.meshes} meshes · ${stats.triangles} tris · ` +
      `${stats.materials} materials · ${renderer.info.render.calls} calls drawn`,
  );
}

/**
 * `?hide=name,name` — removes named subtrees before the first frame.
 *
 * A debugging affordance with one real job: it is how "what is that dark shape
 * lying on the pavement" gets answered by measurement instead of by staring.
 * Guessing at it from three screenshots is how the last four rounds of this
 * project went wrong. Nothing in the scene reads this, and with no parameter
 * the scene is untouched.
 */
const hideList = (params.get('hide') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
for (const name of hideList) {
  const found = world.getObjectByName(name);
  if (found) found.visible = false;
  else console.warn(`[shop] ?hide=${name} matched nothing in the scene`);
}

// Draw one complete frame before handing over to the animation loop, so the
// model is never caught half-built behind the veil and a headless capture has
// something real in the buffer even if the compositor never ticks.
step(0, STILL ? STILL_TIME : 0);
postfx.composer.render(0);
if (showCounters) report();

renderer.setAnimationLoop(frame);

/* ------------------------------------------------------------- the hooks -- */

/**
 * The scene hands out its own parts, for the offline visual check and for
 * anyone who wants to drive the camera from the console. Nothing in the page
 * reads any of this, and `tools/check_scene.js` fails if the scene ever starts
 * to depend on it — the model has to be correct on its own.
 */
window.__shop = {
  THREE, scene, world, camera, controls, renderer, postfx, reflection,
  bounds: { startPosition, startTarget },
  views: Object.keys(VIEWS),
  /** Jump to a named view. `window.__shop.view('topdown')` */
  view(name) {
    const next = VIEWS[name];
    if (!next) return Object.keys(VIEWS);
    camera.position.set(next.position.x, next.position.y, next.position.z);
    controls.target.set(next.target.x, next.target.y, next.target.z);
    camera.lookAt(controls.target);
    controls.enabled = false;
    return name;
  },
  /** Where the camera actually ended up, in metres. */
  where() {
    return {
      position: camera.position.toArray().map((n) => +n.toFixed(2)),
      target: controls.target.toArray().map((n) => +n.toFixed(2)),
      fov: +camera.fov.toFixed(1),
      distance: +camera.position.distanceTo(controls.target).toFixed(2),
    };
  },
  /** Redraw immediately, without waiting for the loop. */
  draw() {
    step(0, STILL ? STILL_TIME : clock.elapsedTime);
    postfx.composer.render(0);
  },
};

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
