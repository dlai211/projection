/**
 * The layout engine.
 *
 * test.html places its eight measures by hand. This score has sixty-five measures and no
 * coordinates at all, so positions are worked out here: the same drawing window, the
 * same staff geometry, the same four measure slots in every system, the same margins,
 * the same stems and beams. Everything below is written to land where test.html's
 * hand-placed notes land.
 *
 * Three things the full arrangement brought with it:
 *
 *   - **The left hand changes clef.** A treble clef names B4 for the middle line of
 *     whichever staff it is drawn on; the bottom staff is treble for the opening
 *     fifteen measures and bass for most of the rest, so the same pitch sits on a
 *     different line depending on the measure.
 *   - **Beats carry more than one note**, so a beat has one position, one stem and as
 *     many noteheads as it has notes.
 *   - **Notes have written lengths**, so the horizontal spacing is a real time axis and
 *     both hands line up on it. The old entries, which have no lengths, keep the
 *     proportional spacing that was calibrated against test.html.
 */
window.App = window.App || {};

window.App.Layout = (function () {
  'use strict';

  const Config = window.App.Config;
  const Pitch = window.App.Pitch;
  const DURATIONS = Config.durations;

  /** Which set of staff lines a hand is drawn on. */
  function linesFor(staff) {
    return staff === 'top' ? Config.staff.topStaffLines : Config.staff.bottomStaffLines;
  }

  /**
   * Where a pitch sits vertically, in drawing units. The clef says which line of that
   * staff holds which pitch, so the same note moves when the clef changes.
   */
  function staffY(letter, octave, clef, staff) {
    const lines = linesFor(staff);
    const anchor = Config.staff.clefs[clef] || Config.staff.clefs.treble;
    return lines[anchor.lineFromTop] - Config.staff.step * (Pitch.diatonicStep(letter, octave) - anchor.step);
  }

  /** The ledger strokes a note needs, above or below its staff. */
  function ledgerStrokes(y, staff) {
    const lines = linesFor(staff);
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

  /** How long a measure is, from its time signature, in sixty-fourth notes. */
  function nominalUnits(time) {
    const parts = String(time || '6/8').split('/');
    const beats = Number(parts[0]) || 6;
    const unit = Number(parts[1]) || 8;
    // a measure is `beats` notes of 1/unit — in sixty-fourths that is beats * 64 / unit
    return beats * (64 / unit);
  }

  /**
   * x positions for one measure's melody.
   *
   * A measure with written lengths is placed on a real time axis, so a sixteenth takes
   * half the room of an eighth and both hands line up. A measure from the old entries
   * has no lengths to go on, so it keeps the calibrated spread: notes pushed to the
   * right edge of the box, unless that would leave a short measure spread thinly, in
   * which case the gap is capped and the line centred — which is what test.html's
   * two-note measure 7 does.
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
   * Positions for one hand of a measure.
   *
   * When the measure has written lengths, both hands are placed on the same time axis —
   * a note four eighths in sits four eighths in, in either hand — and the axis is scaled
   * so a full measure fills the box.
   */
  function positions(events, boxLeft, boxRight, timed, measureUnits) {
    if (!events.length) return [];
    if (!timed) return distribute(boxLeft, boxRight, events.map(function (e) { return e.spacing; }));

    const boxWidth = boxRight - boxLeft;
    let scale = boxWidth / measureUnits;
    let left = boxLeft;
    if (scale * 8 > Config.layout.maxUnit) {
      scale = Config.layout.maxUnit / 8;
      left = boxLeft + (boxWidth - measureUnits * scale) / 2;
    }
    return events.map(function (event) { return left + event.start * scale; });
  }

  /**
   * Beams for one hand: a straight stroke from the first stem end to the last, broken
   * where the beat changes, with a group that holds a single note joining the group
   * before it. A run of sixteenths gets a second stroke, thirty-seconds a third.
   */
  function buildBeams(events, xs) {
    const groups = beamGroups(events);

    const stemEndY = function (event) {
      const bottom = event.heads.length ? event.heads[0].y : event.y;
      return bottom + Config.layout.stemLength;
    };

    const beams = [];
    groups.forEach(function (group) {
      const firstAt = group[0];
      const lastAt = group[group.length - 1];
      const x1 = xs[firstAt] - Config.layout.stemOffset;
      const x2 = xs[lastAt] - Config.layout.stemOffset;
      const y1 = stemEndY(events[firstAt]);
      const y2 = stemEndY(events[lastAt]);

      beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, level: 1 });

      // A straight line between the two stem ends; every further stroke hangs from it.
      const yAt = function (x) {
        if (x2 === x1) return y1;
        return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
      };

      [DURATIONS['16'], DURATIONS['32']].forEach(function (limit, index) {
        const level = index + 2;
        let runStart = -1;

        group.forEach(function (at, position) {
          const qualifies = events[at].units <= limit;
          if (qualifies && runStart === -1) runStart = position;
          const last = position === group.length - 1;
          if (runStart !== -1 && (!qualifies || last)) {
            const endPosition = qualifies && last ? position : position - 1;
            const from = group[runStart];
            const to = group[endPosition];
            const drop = Config.layout.beam.secondaryGap * (level - 1);
            const strokeX1 = xs[from] - Config.layout.stemOffset;
            const strokeX2 = xs[to] - Config.layout.stemOffset +
              (endPosition === runStart ? Config.layout.beam.stubLength : 0);
            beams.push({
              x1: strokeX1, y1: yAt(strokeX1) + drop,
              x2: strokeX2, y2: yAt(strokeX2) + drop,
              level: level
            });
            runStart = -1;
          }
        });
      });
    });

    return beams;
  }

  /** Consecutive notes short enough to be beamed, grouped by the beat they fall on. */
  function beamGroups(events) {
    const runs = [];
    let run = [];

    events.forEach(function (event, index) {
      const beamed = !event.rest && !event.grace && event.units > 0 && event.units <= DURATIONS['8'];
      if (beamed) run.push(index);
      else if (run.length) { runs.push(run); run = []; }
    });
    if (run.length) runs.push(run);

    const groups = [];
    runs.forEach(function (indices) {
      let group = [indices[0]];
      for (let i = 1; i < indices.length; i++) {
        const beat = Math.floor(events[indices[i]].start / Config.layout.beatUnits);
        const before = Math.floor(events[indices[i - 1]].start / Config.layout.beatUnits);
        if (beat !== before) { groups.push(group); group = []; }
        group.push(indices[i]);
      }
      groups.push(group);
    });

    // A beat holding one beamed note on its own joins the beat before it, rather than
    // being left with a bare stem.
    const merged = [];
    groups.forEach(function (group) {
      if (group.length === 1 && merged.length) merged[merged.length - 1] = merged[merged.length - 1].concat(group);
      else merged.push(group);
    });

    return merged.filter(function (group) { return group.length > 1; });
  }

  /**
   * How one hand's labels are written across a measure.
   *
   * The full arrangement is fast in places — sixteenths and thirty-seconds a few drawing
   * units apart — and there is no size at which a label fits every gap. So the labels
   * move rather than shrink: every other one rises (or drops, under the bass), which
   * doubles the room each has, and only if that is still not enough does the writing get
   * smaller. That is also what a person does when annotating a crowded bar by hand.
   */
  function applyLabels(events, xs, baseSize, baseDy, staggerSign) {
    const layout = Config.layout;
    if (!events.length) return;

    let narrowest = Infinity;
    for (let i = 1; i < xs.length; i++) narrowest = Math.min(narrowest, xs[i] - xs[i - 1]);

    /** The size one notation system needs, and whether it has to step between heights. */
    const planFor = function (longest) {
      const fit = function (gap) { return gap / (Math.max(1, longest) * layout.denseLabel.charWidth); };
      if (xs.length < 2 || fit(narrowest) >= baseSize) return { size: baseSize, stagger: false };
      const staggered = fit(narrowest * 2);
      return {
        size: Math.max(layout.denseLabel.minSize, Math.min(baseSize, staggered)),
        stagger: true
      };
    };

    const longestOf = function (key) {
      return events.reduce(function (longest, event) {
        return Math.max(longest, String(event[key] || '').length);
      }, 1);
    };

    // Each notation system is measured on its own. "7" and "B4" are not the same width,
    // and sizing the handwriting for the longer one would shrink it for no reason in the
    // other — so the plan is kept for both and the page picks when the switch is flipped.
    const plans = { number: planFor(longestOf('num')), letter: planFor(longestOf('let')) };

    events.forEach(function (event, index) {
      const step = index % 2 === 1 ? staggerSign * layout.denseLabel.staggerDy : 0;
      event.labelPlans = {
        number: {
          size: plans.number.size,
          y: event.y + baseDy + (plans.number.stagger ? step : 0)
        },
        letter: {
          size: plans.letter.size,
          y: event.y + baseDy + (plans.letter.stagger ? step : 0)
        }
      };
      event.labelSize = plans.number.size;
      event.labelDy = event.labelPlans.number.y - event.y;
    });
  }

  /** The vertical extent of a beat's noteheads, and where its stem runs. */
  function stemOf(heads, y) {
    const top = heads.length ? heads[heads.length - 1].y : y;
    const bottom = heads.length ? heads[0].y : y;
    return { top: top, bottom: bottom + Config.layout.stemLength };
  }

  /** Lay out one measure inside its slot of a system. */
  function layoutMeasure(measure, slotIndex, context) {
    const layout = Config.layout;
    const staff = Config.staff;
    const barlineX = staff.barlineX;

    const slotStart = barlineX[slotIndex];
    const slotEnd = barlineX[slotIndex + 1];
    const isFirstSlot = slotIndex === 0;

    const boxLeft = slotStart + (isFirstSlot ? layout.firstSlotLeftPad : layout.slotLeftPad);
    const boxRight = slotEnd - layout.rightPad;
    const timed = !!measure.timed;
    const measureUnits = nominalUnits(measure.time);

    const rhXs = positions(measure.rh, boxLeft, boxRight, timed, measureUnits);
    const lhXs = positions(measure.lh, boxLeft, boxRight, timed, measureUnits);

    const place = function (event, x, clef, staffName, hand) {
      // A grace note leans into the beat it belongs to, to the left of it.
      const drawnX = event.grace ? x - layout.grace.offset : x;
      // Lowest note first: a chord's stem spans from its top notehead to its bottom.
      const heads = event.notes.map(function (note) {
        return {
          num: note.num,
          let: note.let,
          midi: note.midi,
          letter: note.letter,
          y: staffY(note.letter, note.octave, clef, staffName)
        };
      }).sort(function (a, b) { return b.y - a.y; });
      const middle = linesFor(staffName);
      const y = heads.length ? heads[heads.length - 1].y : (middle[2] + 5);

      const placed = {
        num: event.num,
        let: event.let,
        topNum: event.topNum,
        topLet: event.topLet,
        midi: event.midi,
        notes: event.notes,
        heads: heads,
        x: drawnX,
        gridX: x,
        y: y,
        start: event.start,
        units: event.units,
        duration: event.duration,
        dotted: event.dotted,
        hollow: event.hollow,
        grace: event.grace,
        rest: event.rest,
        tie: event.tie,
        ledger: heads.reduce(function (all, head) {
          return all.concat(ledgerStrokes(head.y, staffName).map(function (ly) {
            return { x: drawnX, y: ly };
          }));
        }, [])
      };
      placed.stem = stemOf(heads, y);
      placed.labelSize = layout.rhLabel.size;
      placed.labelDy = layout.rhLabel.dy;
      // Every melody note carries a stem, as in test.html. A bass note carries one only
      // when it moves: a chord held through the bar stays a bare open oval.
      placed.hasStem = !event.rest && (hand === 'rh' || event.units <= DURATIONS['4']);
      return placed;
    };

    const rh = measure.rh.map(function (event, index) {
      return place(event, rhXs[index], 'treble', 'top', 'rh');
    });
    const lh = measure.lh.map(function (event, index) {
      return place(event, lhXs[index], measure.lhClef, 'bottom', 'lh');
    });

    // The melody's labels sit above their notes, the bass's below, and each hand gets
    // the room it actually has.
    applyLabels(rh, rhXs, layout.rhLabel.size, layout.rhLabel.dy, -1);
    applyLabels(lh, lhXs, layout.lhLabel.size, layout.lhLabel.dy, 1);

    const xStart = isFirstSlot ? slotStart + layout.measureNumberShift : slotStart;

    return {
      m: measure.m,
      key: measure.key,
      time: measure.time,
      lhClef: measure.lhClef,
      timed: timed,
      slotIndex: slotIndex,
      xStart: xStart,
      width: slotEnd - xStart,
      slotStart: slotStart,
      slotEnd: slotEnd,
      isFirstSlot: isFirstSlot,
      measureUnits: measureUnits,
      rh: rh,
      lh: lh,
      beams: buildBeams(rh, rhXs).concat(buildBeams(lh, lhXs)),
      ties: tiesOf(rh).concat(tiesOf(lh)),
      rests: rh.concat(lh).filter(function (event) { return event.rest; }),
      octaveShift: measure.octaveShift || 0,
      /** A clef drawn at the barline when the next measure changes it. */
      cueClef: context && context.nextClef && context.nextClef !== measure.lhClef ? context.nextClef : null,
      /** A time signature drawn after the barline when this measure changes it. */
      timeChange: context && context.previousTime && context.previousTime !== measure.time ? measure.time : null
    };
  }

  function longer(a, b) {
    return (b && b.length > a.length) ? b : a;
  }

  /** The pencil arcs that join a note to the next one of the same hand. */
  function tiesOf(events) {
    const ties = [];
    events.forEach(function (event, index) {
      const next = events[index + 1];
      if (!event.tie || !next || event.rest || next.rest) return;
      const from = event.heads.length ? event.heads[0] : event;
      const to = next.heads.length ? next.heads[0] : next;
      ties.push({
        x1: event.x + Config.layout.note.rx - 1, y1: from.y + 5,
        x2: next.x - Config.layout.note.rx + 1, y2: to.y + 5
      });
    });
    return ties;
  }

  /** How far the drawing window has to grow upward to hold a system's ink. */
  function extraTopFor(measures) {
    const layout = Config.layout;
    let inkTop = Infinity;

    measures.forEach(function (measure) {
      measure.rh.forEach(function (note) {
        const labelTop = note.y + layout.rhLabel.dy - note.labelSize * 0.85;
        const noteTop = note.y - layout.bassNote.ry;
        const ledgerTop = note.ledger.length ? Math.min.apply(null, note.ledger.map(function (l) { return l.y; })) : Infinity;
        inkTop = Math.min(inkTop, labelTop, noteTop, ledgerTop);
      });
      if (measure.octaveShift > 0) inkTop = Math.min(inkTop, linesFor('top')[0] - layout.octaveLine.y - layout.octaveLine.labelSize);
    });

    if (!isFinite(inkTop)) return 0;
    const needed = 2 - inkTop;
    return needed > 0 ? Math.ceil(needed / 5) * 5 : 0;
  }

  /**
   * How far the drawing window has to grow downward.
   *
   * The bass staff usually carries nothing below it but its own ledger strokes. When a
   * measure's left hand is written far below the staff it is drawn on — which happens
   * when a clef and its notes disagree — the labels would otherwise run into the system
   * underneath, so the window grows to hold them instead. check_score.js reports the
   * notes that cause it.
   */
  function extraBottomFor(measures) {
    const layout = Config.layout;
    let inkBottom = -Infinity;

    measures.forEach(function (measure) {
      measure.lh.forEach(function (note) {
        note.heads.forEach(function (head) {
          inkBottom = Math.max(inkBottom, head.y + layout.bassNote.ry + 2);
        });
        // A moving bass note has a stem hanging below its noteheads.
        if (note.hasStem && note.stem) inkBottom = Math.max(inkBottom, note.stem.bottom + 2);
        note.ledger.forEach(function (stroke) { inkBottom = Math.max(inkBottom, stroke.y + 2); });
        if (!note.rest && note.labelPlans) {
          const plan = note.labelPlans.number;
          inkBottom = Math.max(inkBottom, plan.y + plan.size * 0.25);
        }
      });
    });

    if (!isFinite(inkBottom)) return 0;
    const needed = inkBottom - (Config.viewBox.height - 2);
    return needed > 0 ? Math.ceil(needed / 5) * 5 : 0;
  }

  /** The whole score: systems of four measures, plus a lookup by measure number. */
  function build(score) {
    const perSystem = Config.layout.measuresPerSystem;
    const systems = [];
    const byNumber = {};
    let previousTime = null;

    for (let start = 0; start < score.measures.length; start += perSystem) {
      const slice = score.measures.slice(start, start + perSystem);
      const measures = slice.map(function (measure, slotIndex) {
        const context = {
          previousTime: slotIndex === 0 ? previousTime : slice[slotIndex - 1].time,
          nextClef: slotIndex + 1 < slice.length ? slice[slotIndex + 1].lhClef : null
        };
        const laidOut = layoutMeasure(measure, slotIndex, context);
        byNumber[laidOut.m] = laidOut;
        previousTime = measure.time;
        return laidOut;
      });

      systems.push({
        index: systems.length,
        extraTop: extraTopFor(measures),
        extraBottom: extraBottomFor(measures),
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
    nominalUnits: nominalUnits,
    build: build
  };
})();
