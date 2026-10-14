/**
 * The layout engine — the one part test.html does not have.
 *
 * test.html places its eight measures by hand. This score has sixty-four measures and
 * no coordinates at all, so positions are worked out here instead: same drawing window,
 * same staff geometry, same four measure slots in every system, same margins, same
 * stems and beams. Everything below is written to land where test.html's hand-placed
 * notes land; tools/check_layout.js compares the two and prints the difference.
 *
 * The rules, in short:
 *
 *   - a measure's melody is spread across its slot in proportion to note length, so a
 *     long note takes more room than the eighth notes around it;
 *   - consecutive eighth notes are beamed in threes (the 6/8 pulse), with a lone
 *     leftover joining the group before it;
 *   - each left-hand chord sits under the melody note that starts its beat;
 *   - notes outside their staff get ledger strokes.
 */
window.App = window.App || {};

window.App.Layout = (function () {
  'use strict';

  const Config = window.App.Config;
  const Pitch = window.App.Pitch;

  /** Where a pitch sits vertically, in drawing units. */
  function staffY(letter, octave, clef) {
    const step = Pitch.diatonicStep(letter, octave);
    const anchor = clef === 'treble' ? Config.staff.trebleAnchor : Config.staff.bassAnchor;
    return anchor.y - Config.staff.step * (step - anchor.step);
  }

  /** The ledger strokes a note needs, above or below its staff. */
  function ledgerStrokes(y, clef) {
    const lines = clef === 'treble' ? Config.staff.trebleLines : Config.staff.bassLines;
    const top = lines[0];
    const bottom = lines[lines.length - 1];
    const strokes = [];

    if (y < top) {
      for (let ly = top - Config.staff.staffSpace; ly >= y - 2; ly -= Config.staff.staffSpace) strokes.push(ly);
    } else if (y > bottom) {
      for (let ly = bottom + Config.staff.staffSpace; ly <= y + 2; ly += Config.staff.staffSpace) strokes.push(ly);
    }
    return strokes;
  }

  /**
   * x positions for one measure's melody.
   *
   * Notes are spread by duration so the last one lands on the right edge of the box.
   * When that would leave a short measure spread thinly, the gap is capped and the
   * line is centred instead — which is what test.html's two-note measure 7 does.
   */
  function distribute(boxLeft, boxRight, weights) {
    if (!weights.length) return [];
    if (weights.length === 1) return [boxLeft];

    const total = weights.reduce(function (a, b) { return a + b; }, 0);
    const span = total - weights[weights.length - 1];
    if (span <= 0) return weights.map(function () { return boxLeft; });

    let unit = (boxRight - boxLeft) / span;
    let left = boxLeft;
    if (unit > Config.layout.maxUnit) {
      unit = Config.layout.maxUnit;
      left = boxLeft + (boxRight - boxLeft - span * unit) / 2;
    }

    const xs = [left];
    for (let i = 1; i < weights.length; i++) xs.push(xs[i - 1] + weights[i - 1] * unit);
    return xs;
  }

  /**
   * Beams for one measure: a straight stroke from the first stem end to the last.
   * Groups of three, and a group of one at the end joins the group before it, so
   * seven eighths become 3 + 4 — the way test.html beams them.
   */
  function buildBeams(notes, xs) {
    const layout = Config.layout;
    const runs = [];
    let run = [];

    notes.forEach(function (note, index) {
      if (note.units === layout.plainUnits && note.midi !== null) run.push(index);
      else if (run.length) { runs.push(run); run = []; }
    });
    if (run.length) runs.push(run);

    const beams = [];
    runs.forEach(function (indices) {
      const groups = [];
      for (let left = indices.length; left > 0; left -= 3) groups.push(Math.min(3, left));
      if (groups.length > 1 && groups[groups.length - 1] === 1) {
        groups.pop();
        groups[groups.length - 1] += 1;
      }

      let at = 0;
      groups.forEach(function (size) {
        if (size > 1) {
          const first = indices[at];
          const last = indices[at + size - 1];
          beams.push([
            xs[first] - layout.stemOffset, notes[first].y + layout.stemLength,
            xs[last] - layout.stemOffset, notes[last].y + layout.stemLength
          ]);
        }
        at += size;
      });
    });
    return beams;
  }

  /** Index of the melody note that starts beat `beat` (beat 0 is the downbeat). */
  function beatStartIndex(notes, beat) {
    const target = beat * Config.layout.beatGroup;
    let elapsed = 0;
    for (let i = 0; i < notes.length; i++) {
      if (elapsed >= target) return i;
      elapsed += notes[i].units;
    }
    return notes.length ? notes.length - 1 : 0;
  }

  /**
   * Labels shrink only where they would otherwise touch: a crowded measure keeps its
   * own smaller handwriting, and the size is chosen so the longest label fits the
   * narrowest gap. Nothing else about the measure changes.
   */
  function labelSize(texts, xs) {
    const layout = Config.layout;
    if (xs.length < 2) return layout.rhLabel.size;

    let narrowest = Infinity;
    for (let i = 1; i < xs.length; i++) narrowest = Math.min(narrowest, xs[i] - xs[i - 1]);

    const longest = texts.reduce(function (a, b) { return Math.max(a, b.length); }, 1);
    const fits = narrowest / (longest * layout.denseLabel.charWidth);
    return Math.max(layout.denseLabel.minSize, Math.min(layout.rhLabel.size, fits));
  }

  /** Lay out one measure inside its slot of a system. */
  function layoutMeasure(measure, slotIndex) {
    const layout = Config.layout;
    const staff = Config.staff;
    const barlineX = staff.barlineX;

    const slotStart = barlineX[slotIndex];
    const slotEnd = barlineX[slotIndex + 1];
    const isFirstSlot = slotIndex === 0;

    const boxLeft = slotStart + (isFirstSlot ? layout.firstSlotLeftPad : layout.slotLeftPad);
    const boxRight = slotEnd - layout.rightPad;

    const weights = measure.rh.map(function (note) { return note.spacing; });
    const xs = distribute(boxLeft, boxRight, weights);

    const rh = measure.rh.map(function (note, index) {
      const y = note.midi === null ? staff.trebleLines[0] : staffY(note.letter, note.octave, 'treble');
      return {
        num: note.num,
        let: note.let,
        midi: note.midi,
        notes: note.notes,
        dotted: note.dotted,
        units: note.units,
        hollow: note.hollow,
        x: xs[index],
        y: y,
        stem: { x: xs[index] - layout.stemOffset, top: y, bottom: y + layout.stemLength },
        ledger: ledgerStrokes(y, 'treble'),
        labelSize: layout.rhLabel.size,
        labelDy: layout.rhLabel.dy
      };
    });

    // One size for the whole measure, from the longest label it has to print.
    const size = labelSize(rh.map(function (note) { return longer(note.num, note.let); }), xs);
    let stagger = false;
    rh.forEach(function (note, index) {
      note.labelSize = size;
      if (size < layout.denseLabel.staggerBelow && index % 2 === 1) {
        note.labelDy = layout.rhLabel.dy - layout.denseLabel.staggerDy;
        stagger = true;
      }
    });

    const lh = measure.lh.map(function (chord, index) {
      const anchor = rh[beatStartIndex(measure.rh, index)];
      const x = anchor ? anchor.x : boxLeft;
      const y = chord.midi === null ? staff.bassLines[0] : staffY(chord.letter, chord.octave, 'bass');
      return {
        num: formatBassLabel(chord.num),
        let: chord.let,
        midi: chord.midi,
        notes: chord.notes,
        hollow: chord.hollow,
        x: x,
        y: y,
        ledger: ledgerStrokes(y, 'bass')
      };
    });

    const xStart = isFirstSlot ? slotStart + layout.measureNumberShift : slotStart;

    return {
      m: measure.m,
      key: measure.key,
      time: measure.time,
      slotIndex: slotIndex,
      xStart: xStart,
      width: slotEnd - xStart,
      slotStart: slotStart,
      slotEnd: slotEnd,
      isFirstSlot: isFirstSlot,
      staggered: stagger,
      rh: rh,
      lh: lh,
      beams: buildBeams(rh, xs)
    };
  }

  function longer(a, b) {
    return (b && b.length > a.length) ? b : a;
  }

  /** "3/7," prints as "3 / 7," — the spacing test.html's handwriting uses. */
  function formatBassLabel(text) {
    return window.App.NotesNumber.formatChord(text);
  }

  /** How far the drawing window has to grow upward to hold a system's ink. */
  function extraTopFor(rhNotes) {
    const layout = Config.layout;
    let inkTop = Infinity;

    rhNotes.forEach(function (note) {
      const labelTop = note.y + layout.rhLabel.dy - note.labelSize * 0.85;
      const noteTop = note.y - layout.bassNote.ry;
      const ledgerTop = note.ledger.length ? note.ledger[0] : Infinity;
      inkTop = Math.min(inkTop, labelTop, noteTop, ledgerTop);
    });

    if (!isFinite(inkTop)) return 0;
    const needed = 2 - inkTop;
    return needed > 0 ? Math.ceil(needed / 5) * 5 : 0;
  }

  /** The whole score: sixteen systems of four measures, plus a lookup by number. */
  function build(score) {
    const perSystem = Config.layout.measuresPerSystem;
    const systems = [];
    const byNumber = {};

    for (let start = 0; start < score.measures.length; start += perSystem) {
      const slice = score.measures.slice(start, start + perSystem);
      const measures = slice.map(function (measure, slotIndex) {
        const laidOut = layoutMeasure(measure, slotIndex);
        byNumber[laidOut.m] = laidOut;
        return laidOut;
      });

      const rhNotes = measures.reduce(function (all, measure) { return all.concat(measure.rh); }, []);
      systems.push({
        index: systems.length,
        extraTop: extraTopFor(rhNotes),
        measures: measures,
        firstMeasure: measures[0].m,
        lastMeasure: measures[measures.length - 1].m
      });
    }

    return { systems: systems, byNumber: byNumber };
  }

  return {
    staffY: staffY,
    ledgerStrokes: ledgerStrokes,
    distribute: distribute,
    buildBeams: buildBeams,
    build: build
  };
})();
