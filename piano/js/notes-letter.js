/**
 * LETTER notation ("ABC").
 *
 * The other half of the 123 / ABC switch. Letter names are absolute, so this module
 * never looks at the key signature: middle C is C4, and a note keeps its name in
 * every key.
 *
 * The score already carries a letter string for every note ("C#5", "E3/B2"), and the
 * staff prints those untouched. This module exists for the places where a name has to
 * be worked out from a MIDI number instead — the piano keys, and the cross-checks in
 * tools/check_score.js.
 */
window.App = window.App || {};

window.App.NotesLetter = (function () {
  'use strict';

  const Pitch = window.App.Pitch;

  /** "C#5", "F4", "A6" — sharp spelling. */
  function midiToLabel(midi) {
    return Pitch.letterName(midi);
  }

  /** MIDI numbers for a packed chord such as "E3/B2" or "F#3/C#4". */
  function chordToMidis(text) {
    return String(text).split('/').map(parseLabel).filter(function (midi) { return midi !== null; });
  }

  /** "C#5" to its MIDI number, or null. */
  function parseLabel(text) {
    const match = /^\s*([A-Ga-g])([#b♯♭♮]?)(-?\d)\s*$/.exec(String(text));
    if (!match) return null;

    const accidental = match[2] === '♯' ? '#' : match[2] === '♭' ? 'b' : match[2];
    const midi = Pitch.midiOf(match[1].toUpperCase(), accidental, Number(match[3]));
    return Pitch.isValidMidi(midi) ? midi : null;
  }

  /**
   * Label for one piano key, written exactly as test.html writes them:
   * white keys carry their octave ("C4"), black keys never do ("C#").
   */
  function keyLabel(midi) {
    const name = Pitch.SHARP_NAMES[Pitch.pitchClassOf(midi)];
    return name.length > 1 ? name : name + Pitch.octaveOf(midi);
  }

  return {
    midiToLabel: midiToLabel,
    parseLabel: parseLabel,
    chordToMidis: chordToMidis,
    keyLabel: keyLabel
  };
})();
