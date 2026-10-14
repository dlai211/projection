/**
 * Low-level pitch helpers shared by both notation modules.
 *
 * Everything downstream speaks MIDI numbers; this file is the only place that
 * knows about note names, octaves, frequencies and pitch classes.
 */
window.App = window.App || {};

window.App.Pitch = (function () {
  'use strict';

  var LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT_LETTERS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  function isValidMidi(midi) {
    return typeof midi === 'number' && isFinite(midi) && midi >= 0 && midi <= 127;
  }

  /** MIDI 60 = C4 = middle C. */
  function octaveOf(midi) {
    return Math.floor(midi / 12) - 1;
  }

  function pitchClassOf(midi) {
    return ((midi % 12) + 12) % 12;
  }

  /** "C#5", "F4", "Bb3" — sharp spelling by default. */
  function letterName(midi, preferFlats) {
    if (!isValidMidi(midi)) return '';
    var table = preferFlats ? FLAT_LETTERS : LETTERS;
    return table[pitchClassOf(midi)] + octaveOf(midi);
  }

  /** Equal temperament, A4 = 440 Hz. */
  function frequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Parse a letter name such as "C#5", "Eb3", "F4" or "G#5" into its parts.
   * Returns null when the string is not a note name.
   */
  function parseLetterName(text) {
    if (!text) return null;
    var match = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(String(text).trim());
    if (!match) return null;

    var letter = match[1].toUpperCase();
    var accidental = match[2];
    var octave = parseInt(match[3], 10);

    var baseSemitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
    var shift = (accidental === '#' || accidental === '♯') ? 1
      : (accidental === 'b' || accidental === '♭') ? -1
        : 0;

    return {
      letter: letter,
      accidental: accidental,
      octave: octave,
      midi: (octave + 1) * 12 + baseSemitone + shift,
    };
  }

  /** All MIDI numbers of a pitch class inside an inclusive range, ascending. */
  function midisWithPitchClass(pitchClass, lowMidi, highMidi) {
    var out = [];
    for (var m = lowMidi; m <= highMidi; m++) {
      if (pitchClassOf(m) === pitchClass) out.push(m);
    }
    return out;
  }

  /**
   * Difference in octaves between two MIDI numbers, used by the number-notation
   * module to decide how many ' or , marks a note needs.
   */
  function octaveDistanceFrom(midi, referenceOctave) {
    return octaveOf(midi) - referenceOctave;
  }

  return {
    LETTERS: LETTERS,
    isValidMidi: isValidMidi,
    octaveOf: octaveOf,
    pitchClassOf: pitchClassOf,
    letterName: letterName,
    frequency: frequency,
    parseLetterName: parseLetterName,
    midisWithPitchClass: midisWithPitchClass,
    octaveDistanceFrom: octaveDistanceFrom,
  };
})();
