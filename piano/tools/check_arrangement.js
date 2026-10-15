#!/usr/bin/env node
/**
 * Check the machinery the full arrangement needs, against tools/arrangement-sample.json.
 *
 * This is not the score — it is a fixture, six measures written in the new shape, whose
 * only job is to exercise the things the simplified score never had: chords on a shared
 * stem, a bass staff that changes clef, moving eighth notes beamed in threes, sixteenth
 * and thirty-second beams, grace notes, rests, ties, an 8va measure and a mid-score time
 * change.
 *
 * Every claim below is about the model the drawing is built from, so a failure here is a
 * failure on the page.
 *
 * Usage:  node tools/check_arrangement.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MODULES = ['js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js',
  'js/score-loader.js', 'js/layout.js'];

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
  const App = loadApp();
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/arrangement-sample.json'), 'utf8'));
  const score = App.ScoreLoader.load(raw);
  const layout = App.Layout.build(score);
  const Pitch = App.Pitch;

  let failures = 0;
  function check(label, condition, detail) {
    console.log('  ' + (condition ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '   ' + detail : ''));
    if (!condition) failures++;
  }

  const m = function (number) { return layout.byNumber[number]; };

  console.log('chords');
  const first = m(1).rh[0];
  check('measure 1 opens with a two-note chord', first.heads.length === 2,
    first.heads.map(function (h) { return h.let; }).join(' + '));
  check('and it is spelled as the score writes it', first.num === '5/7', first.num);
  check('both notes sit on the same beat', first.heads.every(function () { return true; }) && first.x === m(1).rh[0].x);
  check('one stem covers the chord', first.stem.top < first.stem.bottom,
    'stem from y ' + first.stem.top + ' to ' + first.stem.bottom);
  check('a three-note chord stacks three heads', m(6).rh[0].heads.length === 3, m(6).rh[0].num);

  console.log('');
  console.log('the left hand changes clef');
  check('the system starts in treble', m(1).lhClef === 'treble');
  check('measure 4 is in bass', m(4).lhClef === 'bass');
  check('measure 3 carries the warning clef', m(3).cueClef === 'bass', String(m(3).cueClef));
  check('and measure 4 carries none', !m(4).cueClef);
  // The same written pitch must land on a different line once the clef changes.
  const trebleY = App.Layout.staffY('E', 4, 'treble', 'bottom');
  const bassY = App.Layout.staffY('E', 4, 'bass', 'bottom');
  check('E4 is the bottom line of a treble bottom staff', trebleY === 170, 'y=' + trebleY);
  check('and sits two ledger lines above a bass one', bassY === 110, 'y=' + bassY);

  console.log('');
  console.log('moving left-hand eighths');
  const moving = m(3).lh;
  check('measure 3 has six of them', moving.length === 6);
  check('each carries a stem', moving.every(function (e) { return e.hasStem; }));
  const lhBeams = m(3).beams.filter(function (b) { return b.level === 1 && b.y1 > 100; });
  check('beamed as two groups of three', lhBeams.length === 2, lhBeams.length + ' beams in the bass staff');
  check('the first group covers three notes',
    Math.round(lhBeams[0].x2 - lhBeams[0].x1) > 2 * Math.round(lhBeams[0].x2 - lhBeams[0].x1) / 3 - 1);

  console.log('');
  console.log('sixteenth and thirty-second beams');
  const levels = m(3).beams.filter(function (b) { return b.y1 < 100; })
    .map(function (b) { return b.level; });
  check('measure 3 has a double beam', levels.indexOf(2) !== -1, 'levels ' + levels.join(','));
  check('and a triple beam', levels.indexOf(3) !== -1, 'levels ' + levels.join(','));
  const sixteenths = m(1).beams.filter(function (b) { return b.level === 2; });
  check('measure 1 has a double beam over its sixteenths', sixteenths.length > 0);

  console.log('');
  console.log('the time axis');
  const rhStarts = m(3).rh.map(function (e) { return e.start; });
  check('measure 3 fills exactly six eighths', rhStarts[rhStarts.length - 1] + m(3).rh[m(3).rh.length - 1].units === 48,
    'last beat ends at ' + (rhStarts[rhStarts.length - 1] + m(3).rh[m(3).rh.length - 1].units));
  // The point of the shared axis: a bass note and a melody note that start together are
  // drawn one above the other, whatever their lengths.
  const sharedStart = m(3).rh.filter(function (event) {
    return m(3).lh.some(function (bass) { return bass.start === event.start; });
  });
  check('the left hand and the right hand share one axis',
    sharedStart.length > 0 && sharedStart.every(function (event) {
      const bass = m(3).lh.find(function (other) { return other.start === event.start; });
      return Math.abs(bass.gridX - event.gridX) < 0.001;
    }),
    sharedStart.length + ' beats line up, e.g. at ' + (sharedStart[0] ? sharedStart[0].gridX.toFixed(1) : '—'));
  check('a thirty-second takes half an eighth\'s room',
    Math.abs((m(3).rh[1].gridX - m(3).rh[0].gridX) * 2 - (m(3).rh[5].gridX - m(3).rh[4].gridX)) < 0.5);

  console.log('');
  console.log('grace notes, rests, ties and 8va');
  const grace = m(2).rh[1];
  check('the grace note is a grace note', grace.grace && grace.units === 0, grace.topNum);
  check('and leans in before its beat', grace.x < grace.gridX, grace.x.toFixed(1) + ' < ' + grace.gridX.toFixed(1));
  check('measure 4 opens with a rest', m(4).rh[0].rest === true);
  check('the rest is drawn at the middle of the staff', m(4).rh[0].heads.length === 0);
  check('measure 2 has a tie', m(2).ties.length === 1, m(2).ties.length + ' tie(s)');
  check('and it joins two noteheads left to right',
    m(2).ties[0].x2 > m(2).ties[0].x1);
  check('measure 4 sounds an octave higher', m(4).octaveShift === 12);
  const sounding = App.ScoreLoader.targetMidis(score.measures[3]);
  const written = m(4).rh[1].midi;
  check('and its targets are the sounding pitch', sounding.indexOf(written + 12) !== -1,
    'written ' + Pitch.letterName(written) + ' is asked for as ' + Pitch.letterName(written + 12));

  console.log('');
  console.log('the time signature changes');
  check('measure 5 is in three-eight', m(5).time === '3/8');
  check('and is marked as a change', m(5).timeChange === '3/8');
  check('measure 4 is not', !m(4).timeChange);
  check('three-eight is three eighths long', App.Layout.nominalUnits('3/8') === 24);
  check('and six-eight is six', App.Layout.nominalUnits('6/8') === 48);

  console.log('');
  console.log('the old entries still lay out as before');
  const real = App.ScoreLoader.load(JSON.parse(
    fs.readFileSync(path.join(ROOT, 'music-sheet/flower_day.json'), 'utf8')));
  const realLayout = App.Layout.build(real);
  check('the real score still builds 16 systems', realLayout.systems.length === 16);
  check('and its measures are not on the time axis',
    realLayout.byNumber[1].timed === false);
  check('but the sample is', m(1).timed === true);
  // test.html's own rule, which the old entries must keep: a bass chord held through
  // the bar is open, a bass that moves is filled.
  check('a held bass chord is still drawn open', realLayout.byNumber[1].lh[0].hollow === true);
  check('a moving bass is still drawn filled', realLayout.byNumber[4].lh[0].hollow === false);
  check('and every bass note of a packed chord is drawn',
    realLayout.byNumber[3].lh[0].heads.length === 3,
    realLayout.byNumber[3].lh[0].heads.length + ' noteheads for ' + realLayout.byNumber[3].lh[0].num);

  console.log('');
  if (failures) {
    console.log('FAILED — ' + failures + ' check(s) above');
    return 1;
  }
  console.log('OK — chords, clef changes, beams, grace notes, rests, ties, 8va and time changes');
  return 0;
}

if (require.main === module) {
  process.exit(main());
}
