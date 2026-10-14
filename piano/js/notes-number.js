/**
 * NUMBER notation ("123" / Jianpu).
 *
 * Fixed-do: "1" is always C, in every key -- which is what the score file writes
 * (B is 7 in both the 1# and the 3# section, F# is #4, F natural is ♮4) and what
 * test.html's keyboard labels show. The key signature therefore never changes the
 * spelling of a number.
 *
 * One token looks like  [#|♮] degree ['… | ,…] [.]  and a chord joins tokens with "/":
 *
 *   "7"     B in the middle-C octave      "1'"   C an octave above middle C
 *   "#1'"   C# one octave above           "6,,"  A two octaves below
 *   "♮4"    F natural                     "3''." E two octaves up, a long note
 */
window.App = window.App || {};

window.App.NotesNumber = (function () {
  'use strict';

  const Pitch = window.App.Pitch;

  /** Degree 1..7 to its natural letter. */
  const DEGREE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  /** Pitch class to [degree, accidental] for the keyboard and staff labels. */
  const PC_TO_DEGREE = [
    [1, ''], [1, '#'], [2, ''], [2, '#'], [3, ''], [4, ''],
    [4, '#'], [5, ''], [5, '#'], [6, ''], [6, '#'], [7, '']
  ];

  const TOKEN_PATTERN = /^([#♮]?)([1-7])((?:')*|(?:,)*)(\.?)$/;

  /** Parse one token. Returns null when the text is not number notation. */
  function parseToken(text) {
    const match = TOKEN_PATTERN.exec(String(text).trim());
    if (!match) return null;

    const accidental = match[1] === '#' ? '#' : match[1] === '♮' ? '♮' : '';
    const degree = Number(match[2]);
    const marks = match[3] || '';
    const octaveOffset = marks.charAt(0) === "'" ? marks.length : -marks.length;

    return {
      accidental: accidental,
      degree: degree,
      octaveOffset: octaveOffset,
      dotted: match[4] === '.',
      letter: DEGREE_LETTERS[degree - 1]
    };
  }

  /** MIDI number a token stands for, or null. */
  function tokenToMidi(token) {
    const parsed = parseToken(token);
    if (!parsed) return null;
    return Pitch.midiOf(parsed.letter, parsed.accidental, 4 + parsed.octaveOffset);
  }

  /** Split "3,/1,/6,," into its tokens. */
  function chordToTokens(text) {
    return String(text).split('/').filter(function (part) { return part.trim() !== ''; });
  }

  /** MIDI numbers for every note of a packed chord, in the order written. */
  function chordToMidis(text) {
    return chordToTokens(text).map(tokenToMidi).filter(function (midi) { return midi !== null; });
  }

  /**
   * "3/7," prints as "3 / 7," -- the spacing test.html's handwriting uses.
   * Slashes join, so the label never reads as one long number.
   */
  function formatChord(text) {
    return chordToTokens(text).join(' / ');
  }

  /** Octave marks for a MIDI note: none in the middle-C octave, ' above, , below. */
  function octaveMarks(octave) {
    if (octave >= 5) return "'".repeat(octave - 4);
    if (octave <= 3) return ','.repeat(4 - octave);
    return '';
  }

  /** Number notation for a MIDI number — used for the staff and keyboard labels. */
  function midiToToken(midi) {
    if (!Pitch.isValidMidi(midi)) return '';
    const pair = PC_TO_DEGREE[Pitch.pitchClassOf(midi)];
    return pair[1] + pair[0] + octaveMarks(Pitch.octaveOf(midi));
  }

  /**
   * Label for one piano key, written exactly as test.html writes them:
   * white keys carry their octave ("1", "1'", "1,,"), black keys never do ("#1").
   */
  function keyLabel(midi) {
    const pair = PC_TO_DEGREE[Pitch.pitchClassOf(midi)];
    if (pair[1] === '#') return '#' + pair[0];
    return pair[0] + octaveMarks(Pitch.octaveOf(midi));
  }

  return {
    parseToken: parseToken,
    tokenToMidi: tokenToMidi,
    chordToTokens: chordToTokens,
    chordToMidis: chordToMidis,
    formatChord: formatChord,
    octaveMarks: octaveMarks,
    midiToToken: midiToToken,
    keyLabel: keyLabel
  };
})();
