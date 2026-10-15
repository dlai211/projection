#!/usr/bin/env node
/**
 * Compare the layout engine against test.html's hand-placed measures.
 *
 * test.html places its eight measures by hand; the layout engine works the same
 * positions out from the score. This tool prints the difference note by note, so any
 * drift shows up here instead of on screen.
 *
 * Measure 6 is skipped for the melody: the score file has one more note there than
 * test.html's hand-written copy, so the two cannot line up. The bass is not compared
 * at all, because the score file corrected several of test.html's bass notes (they sit
 * an octave lower than the hand-placed ones).
 *
 * Usage:  node tools/check_layout.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MODULES = ['js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js', 'js/score-loader.js', 'js/layout.js'];

/** x and y of every melody note in test.html's first two systems. */
const REFERENCE = {
  1: { x: [105, 138, 164, 192, 228, 258, 284], y: [55, 55, 60, 55, 55, 55, 60] },
  2: { x: [338, 392, 428, 464, 498], y: [55, 50, 45, 50, 55] },
  3: { x: [560, 592, 618, 646, 682, 714, 742], y: [60, 60, 65, 60, 60, 60, 65] },
  4: { x: [805, 875, 915, 952], y: [60, 70, 65, 70] },
  5: { x: [105, 138, 164, 192, 228, 258, 284], y: [75, 55, 60, 55, 55, 55, 60] },
  7: { x: [585, 690], y: [60, 65] },
  8: { x: [808, 878, 916, 952], y: [70, 55, 50, 45] }
};

/** test.html's own baffles for the first system, to compare the beam ends. */
const REFERENCE_BEAMS = {
  1: [[100, 81, 187, 81], [223, 81, 279, 81]],
  2: [[423, 75, 493, 81]],
  4: [[870, 96, 947, 96]],
  8: [[873, 81, 947, 75]]
};

function loadApp() {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  MODULES.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.App;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'music-sheet/flower_day.json'), 'utf8'));
  const App = loadApp();
  const score = App.ScoreLoader.load(raw);
  const layout = App.Layout.build(score);

  let worstX = 0;
  let worstY = 0;
  let worstLine = '';

  console.log('melody positions vs test.html');
  console.log('measure   note        engine      test.html    difference');

  Object.keys(REFERENCE).forEach(function (key) {
    const measure = layout.byNumber[Number(key)];
    const reference = REFERENCE[key];

    if (measure.rh.length !== reference.x.length) {
      console.log('  m' + key + '      skipped — ' + measure.rh.length + ' notes in the score, ' +
        reference.x.length + ' in test.html');
      return;
    }

    measure.rh.forEach(function (note, index) {
      const dx = Math.abs(note.x - reference.x[index]);
      const dy = Math.abs(note.y - reference.y[index]);
      if (dx > worstX) worstX = dx;
      if (dy > worstY) worstY = dy;
      if (dx > 4 || dy > 4) {
        worstLine = 'm' + key + ' note ' + (index + 1);
      }
      console.log(
        '  m' + String(key).padEnd(6) + String(index + 1).padEnd(12) +
        (note.x.toFixed(1) + ',' + note.y.toFixed(0)).padEnd(12) +
        (reference.x[index] + ',' + reference.y[index]).padEnd(13) +
        'dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(0)
      );
    });
  });

  console.log('');
  console.log('worst x difference: ' + worstX.toFixed(1) + ' units of 1000  (a notehead is 12.4 wide)');
  console.log('worst y difference: ' + worstY.toFixed(0) + ' units (a staff step is 5)');
  console.log('');

  console.log('beams vs test.html');
  [1, 2, 4, 8].forEach(function (number) {
    const measure = layout.byNumber[number];
    const mine = measure.beams.filter(function (beam) { return beam.level === 1; })
      .map(function (beam) {
        return '[' + [beam.x1, beam.y1, beam.x2, beam.y2].map(function (value) { return Math.round(value); }).join(',') + ']';
      }).join(' ');
    const theirs = REFERENCE_BEAMS[number].map(function (beam) {
      return '[' + beam.join(',') + ']';
    }).join(' ');
    console.log('  m' + number + '  engine: ' + mine);
    console.log('      test.html: ' + theirs);
  });

  const extraTop = layout.systems.filter(function (system) { return system.extraTop > 0; })
    .map(function (system) { return 'm' + system.firstMeasure + '-m' + system.lastMeasure + ' +' + system.extraTop; });
  console.log('');
  console.log('systems needing a taller window: ' + (extraTop.length ? extraTop.join(', ') : 'none'));
  return 0;
}

if (require.main === module) {
  process.exit(main());
}
