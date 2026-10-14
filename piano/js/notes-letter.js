/**
 * LETTER NOTATION mapping ("ABC").
 *
 * One of the two interchangeable annotation systems. This module owns everything
 * about how a pitch is written as a letter: the note names, the accidentals, the
 * key-signature spellings and the labels drawn on the sheet and the keyboard.
 *
 * The other system lives in notes-number.js (123 / Jianpu). The two never import
 * each other; sheet-render.js and keyboard-render.js ask the active one for labels.
 */
window.App = window.App || {};

window.App.NotesLetter = (function () {
  'use strict';

  var Pitch = window.App.Pitch;

  var SHARP = '♯';   // ♯
  var NATURAL = '♮'; // ♮

  /**
   * Each key signature is described by the natural notes it raises, written in
   * circle-of-fifths order. "1#" raises F; "3#" raises F, C then G.
   */
  var KEY_SIGNATURES = {
    '0': { count: 0, sharps: [], label: 'C major / A minor' },
    '1#': { count: 1, sharps: ['F'], label: 'G major / E minor' },
    '2#': { count: 2, sharps: ['F', 'C'], label: 'D major / B minor' },
    '3#': { count: 3, sharps: ['F', 'C', 'G'], label: 'A major / F# minor' },
    '4#': { count: 4, sharps: ['F', 'C', 'G', 'D'], label: 'E major / C# minor' },
    '5#': { count: 5, sharps: ['F', 'C', 'G', 'D', 'A'], label: 'B major / G# minor' },
    '6#': { count: 6, sharps: ['F', 'C', 'G', 'D', 'A', 'E'], label: 'F# major / D# minor' },
    '7#': { count: 7, sharps: ['F', 'C', 'G', 'D', 'A', 'E', 'B'], label: 'C# major / A# minor' },
  };

  function keySignature(keyId) {
    return KEY_SIGNATURES[keyId] || KEY_SIGNATURES['0'];
  }

  /** True when this letter (ignoring octave) is raised by the key signature. */
  function isRaisedByKey(letter, keyId) {
    return keySignature(keyId).sharps.indexOf(letter) !== -1;
  }

  /**
   * Decide how a pitch is actually written in a given key.
   *
   * A note that already belongs to the key needs no accidental; anything else is
   * spelled with the accidental that explains the difference (F natural in G major
   * is written ♮F, F sharp in C major is written ♯F).
   */
  function spell(midi, keyId) {
    var pitchClass = Pitch.pitchClassOf(midi);
    var octave = Pitch.octaveOf(midi);
    var naturalName = Pitch.LETTERS[pitchClass];
    var letter = naturalName.charAt(0);
    var isSharp = naturalName.length > 1;

    var raisedByKey = isRaisedByKey(letter, keyId);
    var accidental = '';

    if (isSharp && !raisedByKey) accidental = SHARP;
    else if (!isSharp && raisedByKey) accidental = NATURAL;

    return {
      letter: letter,
      accidental: accidental,
      octave: octave,
      midi: midi,
    };
  }

  /** Short label, e.g. "C#5" — used on the keyboard keys. */
  function label(midi, keyId) {
    var spelled = spell(midi, keyId);
    return spelled.letter + spelled.accidental + spelled.octave;
  }

  /** Longer label used above the staff, e.g. "C♯5" — kept identical for now. */
  function staffLabel(midi, keyId) {
    return label(midi, keyId);
  }

  /** Chord label, e.g. "E3/B2" — notes listed from the lowest up. */
  function chordLabel(midis, keyId) {
    return midis.slice().sort(function (a, b) { return a - b; })
      .map(function (m) { return label(m, keyId); })
      .join('/');
  }

  return {
    id: 'letter',
    name: 'ABC',
    SHARP: SHARP,
    NATURAL: NATURAL,
    KEY_SIGNATURES: KEY_SIGNATURES,
    keySignature: keySignature,
    isRaisedByKey: isRaisedByKey,
    spell: spell,
    label: label,
    staffLabel: staffLabel,
    chordLabel: chordLabel,
  };
})();
