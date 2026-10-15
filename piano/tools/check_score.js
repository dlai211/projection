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
  console.log('measures whose labels had to shrink below the full size: ' +
    (dense.length ? dense.length + ' of ' + countMeasures(layout) : 'none'));
  if (dense.length) console.log('  ' + dense.join(', '));
  console.log('');

  const inRange = { treble: 0, bass: 0, staggered: 0 };
  layout.systems.forEach(function (system) {
    system.measures.forEach(function (measure) {
      measure.rh.forEach(function (note) { inRange.treble += measure.rh.length ? 1 : 0; });
      inRange.bass += measure.lh.length;
      if (measure.rh.some(function (note) { return note.labelDy !== Config.layout.rhLabel.dy; })) {
        inRange.staggered++;
      }
    });
  });
  console.log('melody beats drawn: ' + inRange.treble + ', bass beats drawn: ' + inRange.bass);
  console.log('measures with stepped labels: ' + inRange.staggered);
  console.log('');

  // --- 4. does the ink fit the drawing window?
  let overTop = 0;
  let overBottom = 0;
  let worstBottom = null;
  layout.systems.forEach(function (system) {
    system.measures.forEach(function (measure) {
      measure.rh.concat(measure.lh).forEach(function (event) {
        if (event.rest) return;
        [event.labelPlans.number, event.labelPlans.letter].forEach(function (plan) {
          const top = plan.y - plan.size * 0.85;
          const bottom = plan.y + plan.size * 0.2;
          if (top < -system.extraTop) overTop++;
          if (bottom > Config.viewBox.height) {
            overBottom++;
            if (!worstBottom || bottom > worstBottom.y) {
              worstBottom = { y: bottom, measure: measure.m };
            }
          }
        });
        if (event.grace) return;
      });
      measure.lh.forEach(function (event) {
        if (event.heads.length) {
          const lowest = Math.max.apply(null, event.heads.map(function (head) { return head.y; }));
          if (lowest + 5 > Config.viewBox.height && (!worstBottom || lowest > worstBottom.y)) {
            worstBottom = { y: lowest, measure: measure.m };
          }
        }
      });
    });
  });

  const grown = layout.systems.filter(function (system) {
    return system.extraBottom > 0 || system.extraTop > 0;
  });
  console.log('writing the standard window cannot hold: ' + overTop + ' labels above it, ' +
    overBottom + ' below' +
    (worstBottom ? ' (the lowest is measure ' + worstBottom.measure + ' at y=' + Math.round(worstBottom.y) + ')' : ''));
  console.log('  the systems that need it grow to hold their own ink:');
  console.log('  ' + (grown.length ? grown.map(function (system) {
    return 'm' + system.firstMeasure + '-' + system.lastMeasure +
      (system.extraTop ? ' +' + system.extraTop + ' up' : '') +
      (system.extraBottom ? ' +' + system.extraBottom + ' down' : '');
  }).join(', ') : 'none'));
  console.log('');

  // --- 5. left-hand notes a long way from the staff they are written on
  const stranded = [];
  score.measures.forEach(function (measure) {
    const lines = Config.staff.bottomStaffLines;
    const top = lines[0];
    const bottom = lines[lines.length - 1];
    measure.lh.forEach(function (event) {
      event.notes.forEach(function (note) {
        const y = App.Layout.staffY(note.letter, note.octave, measure.lhClef, 'bottom');
        // Measured from the edge of the staff, so a note on the top line is not
        // "far away" just because the staff is five lines tall.
        const outside = y < top ? Math.round((top - y) / Config.staff.step)
          : y > bottom ? -Math.round((y - bottom) / Config.staff.step) : 0;
        if (Math.abs(outside) > 4) {
          stranded.push('m' + measure.m + ' (' + measure.lhClef + ' clef): ' + note.num +
            ' needs ' + Math.abs(outside) + ' staff steps of ledger lines ' +
            (outside > 0 ? 'above' : 'below') + ' the staff');
        }
      });
    });
  });

  if (stranded.length) {
    console.log('LEFT-HAND NOTES WRITTEN A LONG WAY FROM THEIR STAFF (' + stranded.length + ')');
    stranded.slice(0, 40).forEach(function (line) { console.log('  ' + line); });
    if (stranded.length > 12) console.log('  ... and ' + (stranded.length - 12) + ' more');
    console.log('  More than four steps means four or more ledger lines. That is playable,');
    console.log('  but in a hand transcription it is more often a clef or an octave that');
    console.log('  was written down for the wrong bar.');
  } else {
    console.log('every left-hand note sits within four steps of its staff');
  }
  console.log('');

  // --- 5. do the beats in each measure add up to its time signature?
  const short = [];
  score.measures.forEach(function (measure) {
    const nominal = App.Layout.nominalUnits(measure.time);
    const melody = measure.rh.reduce(function (total, event) { return total + event.units; }, 0);
    const bass = measure.lh.reduce(function (total, event) { return total + event.units; }, 0);
    if (melody !== nominal || bass !== nominal) {
      short.push('m' + measure.m + ' (' + measure.time + '): melody ' + (melody / 8) +
        ' of ' + (nominal / 8) + ' eighths, bass ' + (bass / 8) + ' of ' + (nominal / 8));
    }
  });

  if (short.length) {
    console.log('MEASURES WHOSE BEATS DO NOT FILL THE BAR (' + short.length + ')');
    short.forEach(function (line) { console.log('  ' + line); });
    console.log('  Not every bar has to fill — a pickup does not — but in a hand');
    console.log('  transcription a short bar is usually a note that was missed.');
  } else {
    console.log('every measure\'s melody and bass fill their bar exactly');
  }
  console.log('');

  if (problems) {
    console.log('FAILED — ' + problems + ' problem(s) above');
    return 1;
  }
  console.log('OK — score is clean');
  return 0;
}

function longer(a, b) { return b.length > a.length ? b : a; }

function countMeasures(layout) {
  return layout.systems.reduce(function (total, system) { return total + system.measures.length; }, 0);
}

function countNotes(score) {
  return score.measures.reduce(function (total, measure) {
    return total + measure.rh.length + measure.lh.reduce(function (n, chord) { return n + chord.notes.length; }, 0);
  }, 0);
}

if (require.main === module) {
  process.exit(main());
}
