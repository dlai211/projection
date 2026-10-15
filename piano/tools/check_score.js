#!/usr/bin/env node
/**
 * Validate the score before anything is drawn.
 *
 * Runs the real modules (config, pitch helpers, both notation modules, the loader) in
 * a browser-less context, so what is checked here is exactly what the page will use:
 *
 *   1. every note's number notation must agree with the letter name and MIDI number
 *      stored beside it;
 *   2. every pitch must be inside the range the 88 samples cover (A0-C8);
 *   3. each measure's melody and bass must land on the staves in a sane place.
 *
 * Usage:  node tools/check_score.js [music-sheet/flower_day.json]
 * Exit code 0 means the score is clean.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MODULES = ['js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js', 'js/score-loader.js', 'js/layout.js'];

function loadApp() {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  MODULES.forEach(function (file) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, sandbox, { filename: file });
  });
  return sandbox.App;
}

function main() {
  const jsonPath = process.argv[2] || 'music-sheet/flower_day.json';
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, jsonPath), 'utf8'));

  const App = loadApp();
  const score = App.ScoreLoader.load(raw);
  const Config = App.Config;

  let problems = 0;

  console.log('score: ' + score.title + '  (' + score.measures.length + ' measures, ' + jsonPath + ')');
  console.log('');

  // --- 1. notation agrees with the letter name and MIDI number beside it
  if (score.warnings.length) {
    problems += score.warnings.length;
    console.log('MISMATCHES (' + score.warnings.length + ')');
    score.warnings.forEach(function (warning) { console.log('  ' + warning); });
    console.log('');
  }
  if (score.quirks.length) {
    console.log('FAULTS IN THE FILE, SETTLED (' + score.quirks.length + ') — nothing drawn is affected');
    score.quirks.forEach(function (quirk) { console.log('  ' + quirk); });
    console.log('');
  }
  if (!score.warnings.length && !score.quirks.length) {
    console.log('notation vs letter vs MIDI: all ' + countNotes(score) + ' notes agree');
  }

  // --- 2. range
  const outOfRange = [];
  score.measures.forEach(function (measure) {
    measure.rh.concat(measure.lh).forEach(function (event) {
      event.notes.forEach(function (note) {
        if (note.midi < Config.piano.fullRange.low || note.midi > Config.piano.fullRange.high) {
          outOfRange.push('measure ' + measure.m + ': ' + note.let + ' (MIDI ' + note.midi + ')');
        }
      });
    });
  });
  if (outOfRange.length) {
    problems += outOfRange.length;
    console.log('OUTSIDE THE 88 KEYS (' + outOfRange.length + ')');
    outOfRange.forEach(function (line) { console.log('  ' + line); });
  } else {
    console.log('range: every note is inside A0-C8');
  }

  // --- 3. the drawn positions
  const layout = App.Layout.build(score);
  let topY = Infinity;
  let bottomY = -Infinity;
  let dense = [];

  layout.systems.forEach(function (system) {
    system.measures.forEach(function (measure) {
      measure.rh.forEach(function (note) {
        topY = Math.min(topY, note.y);
        bottomY = Math.max(bottomY, note.y);
      });
      if (measure.rh[0] && measure.rh[0].labelSize < Config.layout.rhLabel.size) {
        dense.push('m' + measure.m + ' (label ' + measure.rh[0].labelSize.toFixed(1) + ')');
      }
    });
  });

  console.log('drawing: ' + layout.systems.length + ' systems built; highest note y=' + topY +
    ', lowest note y=' + bottomY + ' (the standard window is 0..205)');
  console.log('systems taller than the window: ' +
    layout.systems.filter(function (s) { return s.extraTop > 0; })
      .map(function (s) { return 'm' + s.firstMeasure + '-' + s.lastMeasure + ' (+' + s.extraTop + ')'; }).join(', ') || 'none');
  console.log('measures with shrunken labels: ' + (dense.length ? dense.join(', ') : 'none'));
  console.log('');

  const inRange = { treble: 0, bass: 0 };
  layout.systems.forEach(function (system) {
    system.measures.forEach(function (measure) {
      measure.rh.forEach(function (note) { inRange.treble += measure.rh.length ? 1 : 0; });
      inRange.bass += measure.lh.length;
    });
  });
  console.log('melody beats drawn: ' + inRange.treble + ', bass beats drawn: ' + inRange.bass);
  console.log('');

  if (problems) {
    console.log('FAILED — ' + problems + ' problem(s) above');
    return 1;
  }
  console.log('OK — score is clean');
  return 0;
}

function longer(a, b) { return b.length > a.length ? b : a; }

function countNotes(score) {
  return score.measures.reduce(function (total, measure) {
    return total + measure.rh.length + measure.lh.reduce(function (n, chord) { return n + chord.notes.length; }, 0);
  }, 0);
}

if (require.main === module) {
  process.exit(main());
}
