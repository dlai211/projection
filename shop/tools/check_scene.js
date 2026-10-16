#!/usr/bin/env node
/**
 * check_scene.js — the offline gate. No browser, no dependencies, no install.
 *
 *     node tools/check_scene.js
 *
 * Exit code 0 means the scene is structurally sound. Anything else names the
 * rule that broke.
 *
 * What it can and cannot prove is worth being honest about. It cannot see the
 * render, so it says nothing about how the scene looks. What it CAN do is catch
 * the class of mistake that produces a black screen and no error message at all,
 * which is exactly what this project kept producing while it was being built:
 *
 *   - A module importing a file that does not exist. The page loads, one module
 *     404s, and the canvas stays empty.
 *
 *   - A reference to a config key that is not in config.js. `CAMERA.minPolarAngle`
 *     when the key is actually `minPolar` reads as `undefined`, feeds NaN into
 *     OrbitControls, and the camera position becomes NaN — so every vertex
 *     projects to NaN and the renderer draws a perfectly black frame with no
 *     error in the console. Two genuine bugs in this project were exactly that,
 *     which is why it is the first thing checked here.
 *
 *   - A config key nothing uses any more, which is how a palette rots.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS_DIR = join(ROOT, 'js');

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

/* ------------------------------------------------------------ the files -- */

section('Files');

const modules = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
check(`js/ has modules to check (${modules.length})`, modules.length > 0);

const sources = new Map(modules.map((name) => [name, read(join(JS_DIR, name))]));

// Every relative import has to resolve to a file that is actually there.
const missingImports = [];
for (const [name, source] of sources) {
  for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
    const target = resolve(JS_DIR, match[1]);
    if (!existsSync(target)) missingImports.push(`${name} -> ${match[1]}`);
  }
}
check('every relative import resolves', missingImports.length === 0, missingImports.join('\n        '));

// Every module the page loads has to exist, and every module has to be loaded
// by something — an orphan file is a module that was renamed and forgotten.
const html = read(join(ROOT, 'index.html'));
const entry = html.match(/<script type="module" src="([^"]+)"/);
check('index.html loads a module entry point', Boolean(entry), 'no <script type="module" src=...> found');

const reachable = new Set();
if (entry) {
  const queue = [entry[1].replace(/^\.?\//, '')];
  while (queue.length) {
    const current = queue.pop();
    if (reachable.has(current)) continue;
    reachable.add(current);
    const source = sources.get(current.replace(/^js\//, ''));
    if (!source) continue;
    for (const match of source.matchAll(/from\s+'\.\/([^']+)'/g)) queue.push(`js/${match[1]}`);
  }
}

const orphans = modules.filter((name) => !reachable.has(`js/${name}`));
check('no orphan modules', orphans.length === 0, `not reachable from the entry point: ${orphans.join(', ')}`);

// The vendored three.js has to be complete, or the page 404s at runtime.
const vendor = [
  'vendor/three/three.module.js',
  'vendor/three/three.core.js',
  'vendor/three/LICENSE',
  'vendor/three/addons/controls/OrbitControls.js',
  'vendor/three/addons/geometries/RoundedBoxGeometry.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/three/addons/postprocessing/EffectComposer.js',
  'vendor/three/addons/postprocessing/Pass.js',
  'vendor/three/addons/postprocessing/MaskPass.js',
  'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js',
  'vendor/three/addons/postprocessing/OutputPass.js',
  'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js',
  'vendor/three/addons/shaders/OutputShader.js',
];
const missingVendor = vendor.filter((path) => !existsSync(join(ROOT, path)));
check(`vendored three.js is complete (${vendor.length} files)`, missingVendor.length === 0, missingVendor.join('\n        '));

// three.module.js re-exports from three.core.js since r168. Ship one without
// the other and you get a 404 and a blank page.
if (existsSync(join(ROOT, 'vendor/three/three.module.js'))) {
  const three = read(join(ROOT, 'vendor/three/three.module.js'));
  check(
    'three.module.js and three.core.js are a matching pair',
    !three.includes('./three.core.js') || existsSync(join(ROOT, 'vendor/three/three.core.js')),
  );
}

/* ---------------------------------------------------------- config keys -- */

section('Config');

const config = await import(new URL('../js/config.js', import.meta.url).href);
const configNames = Object.keys(config);
const configSource = read(join(JS_DIR, 'config.js'));

/**
 * Every `NAME.key` in the source where NAME is one of config's exports has to
 * be a key that export actually has. This is the NaN check.
 */
const badKeys = [];
const usedKeys = new Map();

for (const [name, source] of sources) {
  for (const block of configNames) {
    const pattern = new RegExp(`\\b${block}\\.([A-Za-z_][A-Za-z0-9_]*)`, 'g');
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      if (!(key in config[block])) {
        const line = source.slice(0, match.index).split('\n').length;
        badKeys.push(`${name}:${line}  ${block}.${key}  (not in config.js)`);
      }
      if (!usedKeys.has(block)) usedKeys.set(block, new Set());
      usedKeys.get(block).add(key);
    }
  }
}
check(
  'every config key referenced in js/ exists',
  badKeys.length === 0,
  badKeys.join('\n        '),
);

// And the other direction: a key nothing reads is either a typo or dead weight.
const unused = [];
for (const block of configNames) {
  const value = config[block];
  if (!value || typeof value !== 'object') continue;
  const used = usedKeys.get(block) ?? new Set();
  for (const key of Object.keys(value)) {
    if (!used.has(key)) unused.push(`${block}.${key}`);
  }
}
// A warning rather than a gate. Some of these are deliberate — a palette entry
// kept for the next thing that needs it, a dimension recorded for the reader —
// and failing the build over a colour nobody has used yet would just train
// whoever runs this to ignore it.
if (unused.length > 0) {
  console.log(`  note  ${unused.length} config keys nothing reads yet (not a failure)`);
  console.log(`        ${unused.join(', ')}`);
} else {
  console.log('  ok    every config key is read by something');
}

/* --------------------------------------------------------------- levels -- */

section('Levels');

/**
 * No two horizontal ground surfaces may be within 6 mm of each other.
 *
 * This is not a style rule. The plinth's top layer and the pavement blocks both
 * ended at exactly y = 0, and the result was that the pavement strobed between
 * its own paving texture and the plinth's dark grey as the camera moved — a
 * full-screen flicker with no error anywhere, caused entirely by two numbers
 * being equal.
 */
const LEVEL_GAP = 0.006;
const levelEntries = Object.entries(config.LEVELS).sort((a, b) => a[1] - b[1]);
const tooClose = [];
for (let i = 1; i < levelEntries.length; i++) {
  const [nameA, yA] = levelEntries[i - 1];
  const [nameB, yB] = levelEntries[i];
  // `wet` is a blending layer with depthWrite off, so it is exempt: it can sit
  // millimetres above the road without fighting it, because it never writes.
  const exempt = nameA === 'wet' || nameB === 'wet';
  const gap = yB - yA;
  if (gap < LEVEL_GAP && !exempt) {
    tooClose.push(`${nameA} (${yA}) and ${nameB} (${yB}) are ${(gap * 1000).toFixed(1)} mm apart`);
  }
}
check(
  `${levelEntries.length} ground surfaces, none coplanar`,
  tooClose.length === 0,
  tooClose.join('\n        '),
);

/* ------------------------------------------------------------- fixtures -- */

section('Fixtures');

/**
 * Every fixture has to be inside the 45 degree corner.
 *
 * The shop's entrance corner is chamfered, so the usable floor is not the
 * rectangle: the wall runs along z = x + 5 and anything with z above that line
 * and x below the chamfer's end is OUTSIDE the building. The bento cabinet was
 * placed at (-3.4, 1.85) — z is 0.25 m above the line — and stood out on the
 * pavement with the automatic doors behind it.
 */
const { STORE } = config;
const wallAt = (x) => x + Math.abs(STORE.x0) + (STORE.z1 - STORE.chamfer - STORE.z1);
const chamferLine = (x) => x - STORE.x0 + (STORE.z1 - STORE.chamfer);

const outside = [];
for (const f of config.FIXTURES) {
  // The worst corner is the one farthest into the chamfer: smallest x, largest z.
  const cornerX = f.x - f.w / 2;
  const cornerZ = f.z + f.d / 2;
  const limit = chamferLine(cornerX);
  if (cornerZ > limit) {
    outside.push(
      `${f.id}: corner (${cornerX.toFixed(2)}, ${cornerZ.toFixed(2)}) is ` +
        `${(cornerZ - limit).toFixed(2)} m past the 45 degree wall`,
    );
  }
}
check(
  `all ${config.FIXTURES.length} fixtures are inside the chamfered wall`,
  outside.length === 0,
  outside.join('\n        '),
);

// And none of them may intersect each other.
const overlaps = [];
for (let i = 0; i < config.FIXTURES.length; i++) {
  for (let j = i + 1; j < config.FIXTURES.length; j++) {
    const a = config.FIXTURES[i];
    const b = config.FIXTURES[j];
    const hitX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
    const hitZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
    if (hitX && hitZ) overlaps.push(`${a.id} overlaps ${b.id}`);
  }
}
check('no two fixtures occupy the same floor', overlaps.length === 0, overlaps.join('\n        '));

/* ----------------------------------------------------------------- yard -- */

section('Yard');

// Nothing in the yard may sit off the edge of the plinth.
const offPlinth = [];
const limit = config.BASE.half - 0.4;
for (const item of config.YARD) {
  const far = Math.max(
    Math.abs(item.x) + item.w / 2,
    Math.abs(item.z) + item.d / 2,
  );
  if (far > limit) offPlinth.push(`${item.id} reaches ${far.toFixed(2)} m from centre`);
}
check(
  `all ${config.YARD.length} yard items are on the plinth`,
  offPlinth.length === 0,
  offPlinth.join('\n        '),
);

// And none of them may intersect: the truck reversed into the bicycle shelter.
const yardHits = [];
for (let i = 0; i < config.YARD.length; i++) {
  for (let j = i + 1; j < config.YARD.length; j++) {
    const a = config.YARD[i];
    const b = config.YARD[j];
    const hitX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
    const hitZ = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
    if (hitX && hitZ) yardHits.push(`${a.id} intersects ${b.id}`);
  }
}
check('nothing in the yard intersects anything else', yardHits.length === 0, yardHits.join('\n        '));

/* ------------------------------------------------------------ the scene -- */

section('Scene');

// Every module the plan names has to exist, and each has to export something.
const expected = {
  'config.js': 'the tunables',
  'toon.js': 'cel shading and contours',
  'textures.js': 'procedural surfaces',
  'signage.js': 'everything with letters on it',
  'lights.js': 'light rig, fog and sky',
  'ground.js': 'plinth, streets, pavement',
  'store.js': 'the building',
  'interior.js': 'what you see through the glass',
  'props.js': 'everything on the street',
  'weather.js': 'rain, splashes, steam',
  'reflection.js': 'the wet road',
  'postfx.js': 'bloom and grade',
  'anim.js': 'doors, flicker, signals',
  'main.js': 'bootstrap',
};
const missingModules = Object.keys(expected).filter((name) => !sources.has(name));
check(
  `all ${Object.keys(expected).length} planned modules exist`,
  missingModules.length === 0,
  missingModules.map((m) => `${m} (${expected[m]})`).join('\n        '),
);

// The requirement list, straight from the brief. Each entry names the file that
// has to build it. This is the check that catches "I forgot the umbrella stand".
const SPEC = [
  ['store sign (fascia)', 'store.js', 'fasciaSouth'],
  ['store sign (pole)', 'store.js', 'pylonPanel'],
  ['glass windows', 'store.js', 'glazing'],
  ['automatic doors', 'store.js', 'doorLeaf'],
  ['eave / awning', 'store.js', 'canopy'],
  ['entrance mat', 'store.js', 'entranceMat'],
  ['vending machine', 'props.js', 'vendingAt'],
  ['bicycle', 'props.js', 'bike'],
  ['umbrella stand', 'props.js', 'umbrellaStand'],
  ['rubbish bins', 'props.js', 'bin-'],
  ['street lamp', 'props.js', 'lampPost'],
  ['utility pole', 'props.js', 'utilityPole'],
  ['overhead wires (sagging)', 'props.js', 'wireCurve'],
  ['road signs', 'props.js', 'signPlate'],
  ['traffic signals', 'props.js', 'signalHead'],
  ['delivery truck', 'service.js', 'deliveryTruck'],
  ['hand truck and crates', 'service.js', 'handTruck'],
  ['service door', 'service.js', 'yardSlab'],
  ['corner guardrail', 'props.js', 'guardrail'],
  ['neighbouring building', 'props.js', 'neighbourBlock'],
  ['alley entrance', 'props.js', 'alleyFloor'],
  ['air-conditioner units', 'props.js', 'condenser'],
  ['notice board', 'props.js', 'noticeBoard'],
  ['traffic signal', 'props.js', 'signal'],
  ['parking bay markings', 'ground.js', 'bay'],
  ['drainage gutter', 'ground.js', 'gutter'],
  ['zebra crossing', 'ground.js', 'crosswalk'],
  ['wet road reflection', 'reflection.js', 'wetLayer'],
  ['shelves', 'interior.js', 'shelfRun'],
  ['drinks cooler', 'interior.js', 'drinksCooler'],
  ['checkout counter', 'interior.js', 'counter'],
  ['coffee machine', 'interior.js', 'coffeeMachine'],
  ['oden counter', 'interior.js', 'odenCounter'],
  ['magazine rack', 'interior.js', 'magazineRack'],
  ['ceiling light boxes', 'interior.js', 'ceilingLights'],
  ['floor guidance markings', 'interior.js', 'tape'],
  ['lockers', 'interior.js', 'lockers'],
  ['back room doorway', 'interior.js', 'backRoomDoorway'],
  ['posters', 'signage.js', 'poster'],
  ['rain', 'weather.js', 'rainLayer'],
  ['awning drips', 'weather.js', 'buildDrips'],
  ['splash ripples', 'weather.js', 'splashLayer'],
  ['glass runoff', 'weather.js', 'glassRunoff'],
  ['steam', 'weather.js', 'buildSteam'],
  ['sign flicker', 'anim.js', 'scheduleFlicker'],
  ['automatic door cycle', 'anim.js', 'doorOpen'],
  ['traffic signal cycle', 'anim.js', 'tickSignal'],
];

const missingSpec = [];
for (const [thing, owner, identifier] of SPEC) {
  const source = sources.get(owner);
  if (!source) { missingSpec.push(`${thing} -> ${owner} (no such module)`); continue; }
  // Checked against the identifier the code actually uses, not a word from the
  // brief: grepping the brief's own vocabulary finds nothing and proves nothing.
  if (!source.includes(identifier)) missingSpec.push(`${thing} -> no "${identifier}" in ${owner}`);
}
check(`all ${SPEC.length} required elements are built`, missingSpec.length === 0, missingSpec.join('\n        '));

/* ------------------------------------------------------------- report -- */

const budget = modules.reduce((sum, name) => sum + sources.get(name).split('\n').length, 0);
console.log(`\n  ${modules.length} modules, ${budget} lines of JavaScript`);
console.log(`  config exports ${configNames.length} blocks`);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
console.log('scene is structurally sound');
process.exit(0);
