/**
 * Low-level pitch helpers.
 *
 * Everything downstream speaks MIDI numbers; this file is the only place that knows
 * about note names, octaves, frequencies and positions on the staves.
 *
 * One convention is shared by the score, by test.html and by both notation modules:
 * middle C is C4 (MIDI 60) and the number notation's "1" is always C.
 */
window.App = window.App || {};

window.App.Pitch = (function () {
  'use strict';

  /** Letter names in sharp spelling, indexed by pitch class (0 = C). */
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /** Semitones above C for each natural letter. */
  const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  /** Position of each natural letter in the seven-step scale (C = 0). */
  const LETTER_STEPS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  function isValidMidi(midi) {
    return typeof midi === 'number' && isFinite(midi) && midi >= 0 && midi <= 127;
  }

  function octaveOf(midi) {
    return Math.floor(midi / 12) - 1;
  }

  function pitchClassOf(midi) {
    return ((midi % 12) + 12) % 12;
  }

  /** "C#5", "F4", "A6" — sharp spelling, matching the score's own letter notation. */
  function letterName(midi) {
    if (!isValidMidi(midi)) return '';
    return SHARP_NAMES[pitchClassOf(midi)] + octaveOf(midi);
  }

  /** Equal temperament, A4 = 440 Hz. */
  function frequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * MIDI number for a natural letter, an accidental and an octave.
   * `accidental` is '#', 'b', '♮' or '' — anything but '#' or 'b' means unaltered.
   */
  function midiOf(letter, accidental, octave) {
    const semitone = LETTER_SEMITONES[letter];
    if (semitone === undefined) return null;
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    return (octave + 1) * 12 + semitone + shift;
  }

  /** Diatonic position counting letter steps: C4 = 0, D4 = 1, C5 = 7. */
  function diatonicStep(letter, octave) {
    return LETTER_STEPS[letter] + 7 * (octave - 4);
  }

  /** How many staff steps a MIDI note sits above its octave's C. */
  function letterAndOctaveOf(midi) {
    const name = SHARP_NAMES[pitchClassOf(midi)];
    return { letter: name.charAt(0), accidental: name.length > 1 ? '#' : '', octave: octaveOf(midi) };
  }

  return {
    SHARP_NAMES: SHARP_NAMES,
    LETTER_STEPS: LETTER_STEPS,
    isValidMidi: isValidMidi,
    octaveOf: octaveOf,
    pitchClassOf: pitchClassOf,
    letterName: letterName,
    letterAndOctaveOf: letterAndOctaveOf,
    frequency: frequency,
    midiOf: midiOf,
    diatonicStep: diatonicStep
  };
})();
