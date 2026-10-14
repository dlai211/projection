/**
 * NUMBER NOTATION mapping ("123" / Jianpu).
 *
 * The second of the two interchangeable annotation systems. Jianpu moves with the
 * key: "1" is always the key's tonic, so it means C in C major but C# in A major.
 *
 * Octave marks (the same convention the source score uses):
 *   "1"   -> C4 (middle C, the reference octave)
 *   "1'"  -> C5, "1''"  -> C6
 *   "1,"  -> C3, "1,,"  -> C2
 *
 * Accidentals are written before the degree: "#4" = raised 4th, "♮4" = natural 4th.
 */
window.App = window.App || {};

window.App.NotesNumber = (function () {
  'use strict';

  var Pitch = window.App.Pitch;
  var Config = window.App.Config.numberNotation;

  var SHARP = '#';
  var NATURAL = '♮'; // ♮

  /** Tonic pitch class of each key signature. */
  var KEY_TONIC = {
    '0': 0,  // C
    '1#': 7,  // G
    '2#': 2,  // D
    '3#': 9,  // A
    '4#': 4,  // E
    '5#': 11, // B
    '6#': 6,  // F#
    '7#': 1,  // C#
  };

  /** Major-scale semitone offsets, scale degree 1..7. */
  var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

  /** Nearest lower major-scale degree for every semitone offset. */
  var DEGREE_BY_SEMITONE = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7];

  function keyTonic(keyId) {
    return Object.prototype.hasOwnProperty.call(KEY_TONIC, keyId) ? KEY_TONIC[keyId] : 0;
  }

  /** Octaves above the reference get apostrophes, octaves below get commas. */
  function octaveMarks(octave) {
    var distance = octave - Config.baseOctave;
    if (distance > 0) return repeat(Config.highMark, distance);
    if (distance < 0) return repeat(Config.lowMark, -distance);
    return '';
  }

  function repeat(text, times) {
    var out = '';
    for (var i = 0; i < times; i++) out += text;
    return out;
  }

  /**
   * Convert a pitch to its Jianpu spelling in a given key.
   *
   * In A major (3#), C# is plain "1" while C natural is written "♮1".
   * In G major (1#), F# is plain "4" while F natural is written "♮4".
   * A raised degree outside the key becomes "#4" and so on.
   */
  function spell(midi, keyId) {
    var tonic = keyTonic(keyId);
    var interval = ((Pitch.pitchClassOf(midi) - tonic) % 12 + 12) % 12;

    var degree = 1;
    var accidental = '';

    var exact = MAJOR_SCALE.indexOf(interval);
    if (exact !== -1) {
      degree = exact + 1;
    } else if (interval > 0 && MAJOR_SCALE.indexOf(interval - 1) !== -1) {
      degree = MAJOR_SCALE.indexOf(interval - 1) + 1;
      accidental = SHARP;
    } else {
      // The pitch is natural but the key raises it (F natural in G major).
      degree = DEGREE_BY_SEMITONE[interval];
      accidental = NATURAL;
    }

    return {
      degree: degree,
      accidental: accidental,
      marks: octaveMarks(Pitch.octaveOf(midi)),
      midi: midi,
    };
  }

  /** Short label used on the keyboard keys, e.g. "#1'" or "3". */
  function label(midi, keyId) {
    var spelled = spell(midi, keyId);
    return spelled.accidental + spelled.degree + spelled.marks;
  }

  /** Label drawn on the staff; uses the real ♯ glyph. */
  function staffLabel(midi, keyId) {
    var spelled = spell(midi, keyId);
    return realAccidental(spelled.accidental) + spelled.degree + spelled.marks;
  }

  function realAccidental(accidental) {
    if (accidental === SHARP) return '♯';   // ♯
    if (accidental === NATURAL) return '♮'; // ♮
    return accidental;
  }

  /** Parse a source string such as "#1'", "7,," or "♮4." into its parts. */
  function parse(text) {
    if (text === null || text === undefined) return null;
    var source = String(text);

    var degreeMatch = /(\d)/.exec(source);
    var accidentalMatch = /^([#♯♮]?)/.exec(source);
    var markMatch = /(['’,]+)\s*$/.exec(source);

    return {
      accidental: accidentalMatch ? accidentalMatch[1] : '',
      degree: degreeMatch ? parseInt(degreeMatch[1], 10) : null,
      marks: markMatch ? markMatch[1].replace(/’/g, "'") : '',
      dotted: source.indexOf('.') !== -1,
    };
  }

  /** Chord label, e.g. "3/7," — degrees joined with slashes, lowest note first. */
  function chordLabel(midis, keyId) {
    return midis.slice().sort(function (a, b) { return a - b; })
      .map(function (m) { return label(m, keyId); })
      .join('/');
  }

  return {
    id: 'number',
    name: '123',
    SHARP: SHARP,
    NATURAL: NATURAL,
    keyTonic: keyTonic,
    octaveMarks: octaveMarks,
    spell: spell,
    label: label,
    staffLabel: staffLabel,
    parse: parse,
    chordLabel: chordLabel,
  };
})();
