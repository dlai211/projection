/**
 * Mapping from pitch to position on the grand staff.
 *
 * Both staves are measured in "diatonic steps": every line or space is one step,
 * five units apart, so a third (line to line) is exactly one staff space. Getting
 * this wrong is what makes hand-drawn notation look wrong, so it lives in one
 * place and both renderers use it.
 *
 *   treble staff: top line  y=45  (F5)  ... bottom line y=85  (E4)
 *   bass staff:   top line  y=125 (A3)  ... bottom line y=165 (G2)
 */
window.App = window.App || {};

window.App.Staff = (function () {
  'use strict';

  var Pitch = window.App.Pitch;

  /** Pitch class -> the natural letter whose octave number applies, plus a shift. */
  var NATURAL_OF = [
    { letter: 'C', shift: 0, octaveBump: 0 },  // 0  C
    { letter: 'C', shift: 1, octaveBump: 0 },  // 1  C#
    { letter: 'D', shift: 0, octaveBump: 0 },  // 2  D
    { letter: 'D', shift: 1, octaveBump: 0 },  // 3  D#
    { letter: 'E', shift: 0, octaveBump: 0 },  // 4  E
    { letter: 'F', shift: 0, octaveBump: 0 },  // 5  F
    { letter: 'F', shift: 1, octaveBump: 0 },  // 6  F#
    { letter: 'G', shift: 0, octaveBump: 0 },  // 7  G
    { letter: 'G', shift: 1, octaveBump: 0 },  // 8  G#
    { letter: 'A', shift: 0, octaveBump: 0 },  // 9  A
    { letter: 'A', shift: 1, octaveBump: 0 },  // 10 A#
    { letter: 'B', shift: 0, octaveBump: 0 },  // 11 B
  ];

  /** Diatonic index: (octave * 7) + letterIndex, so differences are staff steps. */
  var LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

  function diatonicIndex(letter, octave) {
    return octave * 7 + LETTER_INDEX[letter];
  }

  /** Letter + octave of the natural note a pitch is written as. */
  function naturalOf(midi) {
    var info = NATURAL_OF[Pitch.pitchClassOf(midi)];
    var octave = Pitch.octaveOf(midi);
    // Cb / B# style edge cases do not occur in this score, but keep the maths sane:
    if (info.letter === 'C' && info.octaveBump) octave += info.octaveBump;
    return { letter: info.letter, octave: octave, sharp: info.shift === 1 };
  }

  /**
   * Vertical position of a pitch on a clef, in SVG units.
   * Returns the y of the notehead centre plus whether the pitch is off-staff.
   */
  function position(midi, clef) {
    var natural = naturalOf(midi);
    var index = diatonicIndex(natural.letter, natural.octave);

    if (clef === 'treble') {
      // E4 sits on the bottom line (y = 85) and the staff rises 5 units per step.
      var e4 = diatonicIndex('E', 4);
      return { y: 85 - (index - e4) * 5, natural: natural };
    }
    // Bass: G2 sits on the bottom line (y = 165).
    var g2 = diatonicIndex('G', 2);
    return { y: 165 - (index - g2) * 5, natural: natural };
  }

  /** Staff geometry for a clef, from the shared configuration. */
  function staffBounds(clef, sheetConfig) {
    var staff = sheetConfig.staff;
    var top = clef === 'treble' ? staff.trebleTop : staff.bassTop;
    var space = staff.space;
    return {
      top: top,
      bottom: top + space * (staff.lines - 1),
      middle: top + space * 2,
      space: space,
    };
  }

  /** Ledger line y positions needed to reach an off-staff note. */
  function ledgerLines(y, clef, sheetConfig) {
    var bounds = staffBounds(clef, sheetConfig);
    var space = bounds.space;
    var lines = [];

    if (y < bounds.top) {
      for (var above = bounds.top - space; above >= y - 2.5; above -= space) lines.push(above);
    } else if (y > bounds.bottom) {
      for (var below = bounds.bottom + space; below <= y + 2.5; below += space) lines.push(below);
    }
    return lines;
  }

  /** Stems point up below the middle line and down from it upwards. */
  function stemUp(y, clef, sheetConfig) {
    return y > staffBounds(clef, sheetConfig).middle;
  }

  /** True when the note sits inside the staff (no ledger lines needed). */
  function isOnStaff(y, clef, sheetConfig) {
    var bounds = staffBounds(clef, sheetConfig);
    return y >= bounds.top && y <= bounds.bottom;
  }

  return {
    naturalOf: naturalOf,
    diatonicIndex: diatonicIndex,
    position: position,
    staffBounds: staffBounds,
    ledgerLines: ledgerLines,
    stemUp: stemUp,
    isOnStaff: isOnStaff,
  };
})();
