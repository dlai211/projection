#!/usr/bin/env node
/**
 * Does the listener actually hear chords?
 *
 * The detector is a plain function of a spectrum, so it can be tested without a piano,
 * a microphone or a browser: this tool builds the spectrum a piano *would* produce —
 * a peak for the note, plus the partials that make a piano sound like a piano — and
 * checks what comes back.
 *
 * The interesting cases are the ones that break naive detectors: a third harmonic that
 * sounds like a note a fifth up, a bass note whose fundamental sits below the usable
 * range, and a chord where one note is much quieter than another.
 *
 * Usage:  node tools/check_detect.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MODULES = ['js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js',
  'js/score-loader.js', 'js/pitch-detect.js'];

function loadApp() {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  MODULES.forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.App;
}

/**
 * The spectrum of a piano chord: a peak at each note's fundamental, plus its partials,
 * each partial quieter than the last. Returns the decibels an AnalyserNode would give.
 */
function synthSpectrum(midis, options) {
  const settings = options || {};
  const sampleRate = settings.sampleRate || 48000;
  const fftSize = settings.fftSize || 4096;
  const bins = fftSize / 2;
  const binHz = sampleRate / fftSize;
  const partials = settings.partials || [1, 0.5, 0.32, 0.2, 0.13, 0.09];
  const decibels = new Float64Array(bins).fill(-140);

  midis.forEach(function (midi, noteIndex) {
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    const level = (settings.levels && settings.levels[noteIndex]) || 1;

    partials.forEach(function (strength, harmonic) {
      const at = frequency * (harmonic + 1);
      if (at >= sampleRate / 2) return;

      // A partial lands between bins, not on one: the energy spreads over its
      // neighbours in a peak. Modelling that matters — without it the test signal is
      // blurrier than a real piano, and at the bottom of the keyboard half a bin is
      // most of a semitone.
      const position = at / binHz;
      const magnitude = strength * level;
      const centre = Math.round(position);

      for (let offset = -2; offset <= 2; offset++) {
        const index = centre + offset;
        if (index < 1 || index >= bins) continue;
        const distance = Math.abs(position - index);
        if (distance > 2) continue;
        const shape = Math.pow(Math.max(0, 1 - distance / 2), 2);
        const value = 20 * Math.log10(magnitude * shape);
        if (value > decibels[index]) decibels[index] = value;
      }
    });
  });

  return { decibels: decibels, binHz: binHz };
}

function main() {
  const App = loadApp();
  const Detect = App.PitchDetect;
  const Pitch = App.Pitch;

  let failures = 0;

  function check(label, condition, detail) {
    console.log('  ' + (condition ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '   ' + detail : ''));
    if (!condition) failures++;
  }

  function chromaOf(midis, options) {
    const spectrum = synthSpectrum(midis, options);
    return Detect.analyse(spectrum.decibels, spectrum.binHz);
  }

  function nameOf(pitchClass) { return Pitch.SHARP_NAMES[pitchClass]; }

  console.log('one note at a time');
  [40, 52, 60, 69, 76, 88].forEach(function (midi) {
    const result = chromaOf([midi]);
    const wanted = Pitch.pitchClassOf(midi);
    const loudest = Array.from(result.chroma).indexOf(Math.max.apply(null, Array.from(result.chroma)));
    check(Pitch.letterName(midi) + ' is heard', loudest === wanted,
      'strongest class is ' + nameOf(loudest) + ', wanted ' + nameOf(wanted));
  });

  console.log('');
  console.log('a left-hand chord — E3 over B2, as measure 1 asks for');
  const chord = chromaOf([52, 47]);
  check('both notes are present', chord.chroma[4] > 0.3 && chord.chroma[11] > 0.3,
    'E=' + chord.chroma[4].toFixed(2) + ' B=' + chord.chroma[11].toFixed(2));
  check('and nothing else is claimed', Detect.describeNotes(chord.notes).sort().join(' ') === 'B2 E3',
    Detect.describeNotes(chord.notes).join(' '));

  console.log('');
  console.log('melody and bass together — measure 1 in full');
  const measure = chromaOf([71, 69, 52, 47]);
  const wanted = new Set([71, 69, 52, 47].map(Pitch.pitchClassOf));
  const match = Detect.match(measure.chroma, wanted);
  check('every pitch class of the measure is found', match.complete,
    match.heard.map(nameOf).join(' ') + ' heard, missing ' + match.missing.map(nameOf).join(' '));

  console.log('');
  console.log('harmonics — the trap for a naive detector');
  const withPartials = chromaOf([48]);                      // C3, its partials included
  check('a low C does not also report the G a fifth above', withPartials.chroma[7] < 0.3,
    'G=' + withPartials.chroma[7].toFixed(2));
  // C3, G3 and the melody's G4 above them: the G is also C3's third harmonic, and it
  // must still be heard because it is genuinely being played.
  const stacked = chromaOf([48, 55, 67]);
  const stackedMatch = Detect.match(stacked.chroma, new Set([0, 7]));
  check('a real fifth is still heard when it is really played', stackedMatch.complete,
    'C=' + stacked.chroma[0].toFixed(2) + ' G=' + stacked.chroma[7].toFixed(2));

  console.log('');
  console.log('the quieter left hand under the melody');
  // B4 in the melody at full strength, the E3/B2 chord underneath at a third of it.
  // A left hand played *much* softer than this stops counting — that is what
  // matchThreshold trades against, and it is the first knob to turn if a real piano
  // is being heard but not recognised.
  const unbalanced = chromaOf([71, 52, 47], { levels: [1, 0.35, 0.35] });
  const unbalancedMatch = Detect.match(unbalanced.chroma, new Set([11, 4]));
  check('the left hand is heard under the melody', unbalancedMatch.complete,
    'B=' + unbalanced.chroma[11].toFixed(2) + ' E=' + unbalanced.chroma[4].toFixed(2));

  console.log('');
  console.log('silence and a wrong note');
  const silence = Detect.analyse(new Float64Array(2048).fill(-140), 48000 / 4096);
  check('silence reports nothing', silence.notes.length === 0 && silence.chroma.every(function (v) { return v === 0; }));
  const wrong = chromaOf([60, 64]);
  const wrongMatch = Detect.match(wrong.chroma, new Set([71, 69, 52, 47].map(Pitch.pitchClassOf)));
  check('playing the wrong notes does not pass the measure', !wrongMatch.complete,
    Math.round(wrongMatch.score * 100) + '% matched');

  console.log('');
  console.log('every measure of the piece, played as written');
  // The window size decides whether two notes a semitone apart can be told apart at
  // all: at 48 kHz, FFT 4096 puts a bin every 11.7 Hz, and C#3 and D3 are 8 Hz apart.
  // The chosen size is the one the page uses; the others are here to show the trade.
  const chosen = App.Config.audio.fftSize;
  [4096, 8192, 16384].forEach(function (size) {
    const bad = wholePiece(App, Detect, Pitch, check, size);
    if (size === chosen) failures += bad;
    else console.log('        (at FFT ' + size + ': ' + (bad ? bad + ' measures would fail' : 'no failures') + ')');
  });
  console.log('');

  if (failures) {
    console.log('FAILED — ' + failures + ' check(s) above');
    return 1;
  }
  console.log('OK — the detector hears what is played, and only what is played');
  return 0;
}

/**
 * The test that matters: all 64 measures, played the way a person plays them.
 *
 * The melody goes one note at a time and the bass chord sounds underneath it, frames
 * arriving twenty times a second exactly as they do in the page, with the chroma
 * carried across them. A measure passes when the page would have moved on from it —
 * which is the only question that matters, because a measure the detector refuses to
 * hear is a measure practice mode can never leave.
 */
function wholePiece(App, Detect, Pitch, check, fftSize) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'music-sheet/flower_day.json'), 'utf8'));
  const score = App.ScoreLoader.load(raw);
  const Loader = App.ScoreLoader;
  const frameSeconds = 0.05;
  const framesPerNote = 6;                     // a slow piece: about a third of a second a note
  let failed = 0;

  score.measures.forEach(function (measure) {
    const targets = Loader.targetPitchClasses(measure);
    let smoothed = null;
    let passed = false;

    // The bass chord sounds from the downbeat and is held throughout.
    const bass = [];
    measure.lh.forEach(function (event) { event.notes.forEach(function (note) { bass.push(note.midi); }); });

    measure.rh.forEach(function (note) {
      if (passed) return;
      for (let frame = 0; frame < framesPerNote && !passed; frame++) {
        const played = note.notes.map(function (written) { return written.midi; });
        const midis = played.concat(bass);
        const levels = midis.map(function (unused, index) { return index < played.length ? 1 : 0.45; });
        const spectrum = synthSpectrum(midis, { levels: levels, fftSize: fftSize });
        const result = Detect.analyse(spectrum.decibels, spectrum.binHz);
        smoothed = Detect.accumulate(smoothed, result.chroma, frameSeconds);
        if (Detect.match(smoothed, targets).complete) passed = true;
      }
    });

    if (!passed) {
      const result = Detect.match(smoothed || new Float64Array(12), targets);
      failed++;
      console.log('  FAIL  measure ' + measure.m + '  missing ' +
        result.missing.map(function (pc) { return Pitch.SHARP_NAMES[pc]; }).join(' ') +
        '   (needs ' + Loader.targetMidis(measure).map(Pitch.letterName).join(' ') + ')');
    }
  });

  if (!failed) {
    console.log('  ok    all ' + score.measures.length + ' measures are heard complete at FFT ' +
      fftSize + ', melody and left hand together');
  }
  return failed;
}

module.exports = { synthSpectrum: synthSpectrum };

if (require.main === module) {
  process.exit(main());
}
