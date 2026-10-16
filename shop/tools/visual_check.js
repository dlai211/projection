#!/usr/bin/env node
/**
 * visual_check.js — look at the model.
 *
 *   node tools/visual_check.js                  # four standard views
 *   node tools/visual_check.js --only topdown   # one of them
 *   node tools/visual_check.js --url http://localhost:8080/
 *
 * WHY THIS EXISTS
 *
 * `tools/check_scene.js` proves the model is internally consistent: nothing
 * overlaps, nothing is off the plinth, every config key is real. What it cannot
 * do is notice that a utility pole stands in the middle of the one picture
 * everybody sees. Every fault a reader has found in this scene so far has been
 * that kind — a door panel showing through the glass, a guardrail across a
 * junction, a crosswalk painted at right angles to its own traffic — and each
 * one was also fully "correct" by coordinate. Numbers cannot see.
 *
 * So this script drives a real Chrome, at named camera positions, and writes
 * PNGs. It does NOT look at them: the point is that a person (or the model that
 * wrote the scene) opens the files and says what is in them. The script's job
 * ends at "here are four pictures".
 *
 * HOW
 *
 * No dependencies, on purpose — this repository has no node_modules and is not
 * about to grow one for a screenshot. Chrome's own `--headless --screenshot`
 * does the work, once per view, driven from a URL the page already understands
 * (`?view=topdown&still=1`, see js/main.js). `--virtual-time-budget` gives the
 * page time to build and paint before the capture.
 *
 * Caution, learned the hard way: under virtual time the compositor may never
 * tick a requestAnimationFrame at all, so `main.js` does one complete
 * update-and-draw synchronously before it hands over to the loop. Anything that
 * only happens inside the loop — the rain, for instance — is missing from the
 * capture. If a screenshot ever looks like the scene has stopped part way
 * through being built, that is the first thing to check.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/* ------------------------------------------------------------------ args -- */

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const URL_BASE = arg('url', 'http://localhost:8137/');
const OUT_DIR = resolve(arg('out', join(ROOT, '.screenshots')));
const WIDTH = Number(arg('width', 1600));
const HEIGHT = Number(arg('height', 1000));
const BUDGET = Number(arg('budget', 6000));
const ONLY = arg('only', null);
/** `--hide storeFloor` — passed through to the page's `?hide=`, to isolate one
 *  object when a picture shows something and you cannot tell what it is. */
const HIDE = arg('hide', null);

/**
 * The four views. `what` is what a person is supposed to be able to decide from
 * the picture, written down next to the picture so that the check has a
 * question rather than just a file.
 */
const SHOTS = [
  {
    id: 'shot_1_default',
    view: 'default',
    what: 'The view the page opens on. Is anything standing in front of the '
        + 'shop — pole, signal mast, sign — that should not be?',
  },
  {
    id: 'shot_2_topdown',
    view: 'topdown',
    what: 'Straight down on the whole base. Crossing bars, stop lines, bay '
        + 'markings, arrows, kerb lines, and every pole seen as a dot.',
  },
  {
    id: 'shot_3_backyard',
    view: 'backyard',
    what: 'The delivery yard. Tailgate, hand truck and service door in a line; '
        + 'the shelter clear of the truck; the neighbour wall not dead black.',
  },
  {
    id: 'shot_4_intersection',
    view: 'intersection',
    what: 'The junction. Both crossings, tactile paving, kerb ramps, which way '
        + 'the signal arms point, and whether any sign faces backwards.',
  },
  {
    id: 'shot_5_entrance',
    view: 'entrance',
    what: 'The doorway, head on. This is the shot the whole model is for: '
        + 'threshold, mat, door glass, and what is readable through it.',
  },
  {
    id: 'shot_6_junction',
    view: 'junction',
    what: 'The junction from close overhead, 100 px per metre. Which way each '
        + 'crossing\'s bars run, where the stop line is and in which lane, and '
        + 'every kerb line and tactile strip at its true plan position.',
  },
];

/* ----------------------------------------------------------------- chrome -- */

/** Chrome, wherever this machine keeps it. Edge will do at a pinch. */
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const path of candidates) if (existsSync(path)) return path;
  throw new Error(
    'No Chrome or Edge found. Set CHROME_PATH to the executable and try again.',
  );
}

/**
 * One capture. Resolves when Chrome has exited; rejects on a non-zero exit or
 * on a missing/empty PNG, because a silent failure here would look exactly like
 * a successfully taken picture.
 */
function capture(browser, url, file, profile) {
  return new Promise((done, fail) => {
    const args = [
      '--headless=new',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      `--virtual-time-budget=${BUDGET}`,
      `--screenshot=${file}`,
      url,
    ];

    const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', fail);
    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        // Chrome exits non-zero on noisy-but-harmless cases too, so the file is
        // the real evidence; only complain if the file is not there.
        if (!existsSync(file)) return fail(new Error(`chrome exited ${code}\n${stderr}`));
      }
      if (!existsSync(file)) return fail(new Error(`no screenshot written to ${file}\n${stderr}`));
      const size = statSync(file).size;
      if (size < 4096) return fail(new Error(`${file} is only ${size} bytes — almost certainly blank`));

      // The page reports its own camera, so a preset that silently failed to
      // apply is visible here rather than as a subtly wrong picture.
      done({ size, width: pngWidth(file), height: pngHeight(file), note: cameraNote(stderr) });
    });
  });
}

/** Width and height straight out of the PNG's IHDR — no image library needed. */
function pngWidth(file) {
  const head = readFileSync(file).subarray(16, 20);
  return head.readUInt32BE(0);
}
function pngHeight(file) {
  const head = readFileSync(file).subarray(20, 24);
  return head.readUInt32BE(0);
}

/**
 * Chrome's console output is where `?debug=1` counters and any error would
 * land. Nothing is parsed out of it beyond a warning about the page having
 * failed, which is the one thing that turns "empty picture" into a diagnosis.
 */
function cameraNote(stderr) {
  if (/SyntaxError|TypeError|ReferenceError|Uncaught/.test(stderr)) {
    const line = stderr.split('\n').find((l) => /Error/.test(l)) ?? '';
    return line.trim().slice(0, 140);
  }
  return '';
}

/* ------------------------------------------------------------------- run -- */

const shots = ONLY ? SHOTS.filter((s) => s.id.includes(ONLY) || s.view === ONLY) : SHOTS;
if (shots.length === 0) {
  console.error(`No view matches --only ${ONLY}. Try one of: ${SHOTS.map((s) => s.view).join(', ')}`);
  process.exit(2);
}

const browser = findBrowser();
const profile = join(tmpdir(), `shop-visual-${process.pid}`);
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(profile, { recursive: true });

console.log(`browser  ${browser}`);
console.log(`url      ${URL_BASE}`);
console.log(`writing  ${OUT_DIR}\n`);

const results = [];
let failed = 0;

for (const shot of shots) {
  const file = join(OUT_DIR, `${shot.id}.png`);
  if (existsSync(file)) rmSync(file);

  const query = `view=${shot.view}&still=1${HIDE ? `&hide=${HIDE}` : ''}`;
  const url = `${URL_BASE}?${query}`;
  process.stdout.write(`  ${shot.id.padEnd(22)} ${shot.view.padEnd(13)} `);

  try {
    const r = await capture(browser, url, file, profile);
    results.push({ ...shot, file, ...r });
    console.log(`${r.width}x${r.height}  ${(r.size / 1024).toFixed(0)} KB${r.note ? `  !! ${r.note}` : ''}`);
  } catch (error) {
    failed++;
    console.log('FAILED');
    console.error(`    ${String(error.message).split('\n').slice(0, 4).join('\n    ')}`);
  }
}

try { rmSync(profile, { recursive: true, force: true }); } catch { /* nothing */ }

console.log('\nWhat each picture is for:');
for (const r of results) console.log(`  ${r.id}.png\n    ${r.what}`);

if (failed) {
  console.error(`\n${failed} of ${shots.length} captures failed.`);
  process.exit(1);
}
console.log(`\n${results.length}/${shots.length} captured. Now open them and look.`);
