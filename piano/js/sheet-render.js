/**
 * Drawing the score.
 *
 * This is test.html's renderSheet(), kept whole: the same elements, the same classes,
 * the same order, so the pencil filters and the CSS land on exactly the same shapes.
 * What it adds is what the full arrangement needs — a beat that carries a chord on one
 * stem, beams that double and triple, a left hand whose clef changes, rests, grace
 * notes, ties, an 8va line and mid-score time signatures — every one of them drawn
 * with test.html's own marks: the same strokes, the same `pencil-stroke` filter, the
 * same graphite colours.
 *
 * Nothing here decides where anything goes — that all happened in the layout engine.
 */
window.App = window.App || {};

window.App.SheetRender = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const Config = window.App.Config;

  /** An SVG element with attributes and an optional class. */
  function make(name, attributes, className) {
    const node = document.createElementNS(NS, name);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    }
    if (className) node.setAttribute('class', className);
    return node;
  }

  /**
   * A handwritten label. Both spellings travel with the node, so switching between
   * 123 and ABC only swaps the text — the sheet is never rebuilt for it.
   */
  function makeLabel(x, y, className, numberText, letterText, size) {
    const node = make('text', { x: x, y: y }, className);
    node.dataset.num = numberText;
    node.dataset.let = letterText;
    node.textContent = numberText;
    if (size) node.style.fontSize = size + 'px';
    return node;
  }

  function linesFor(staff) {
    return staff === 'top' ? Config.staff.topStaffLines : Config.staff.bottomStaffLines;
  }

  /** Where a clef's foot sits: a treble clef on its G line, a bass clef on its F line. */
  function clefBaseline(clef, staff) {
    const lines = linesFor(staff);
    return clef === 'treble' ? lines[3] + 4 : lines[1] + 20;
  }

  /**
   * Draw the whole score into a container.
   *
   * Returns the system elements and the smudge of every measure, so the highlight can
   * be moved by showing one and hiding the rest instead of redrawing sixteen systems.
   */
  function renderSheet(container, layout, state) {
    container.textContent = '';
    const drawn = { systems: [], highlights: {} };

    layout.systems.forEach(function (system) {
      const element = renderSystem(system, state, drawn.highlights);
      drawn.systems.push(element);
      container.appendChild(element);
    });

    return drawn;
  }

  /** One system: four measures on a grand staff, exactly as test.html draws them. */
  function renderSystem(system, state, highlights) {
    const staff = Config.staff;
    const header = Config.header;
    const viewHeight = Config.viewBox.height + system.extraTop;
    const first = system.measures[0];

    const svg = make('svg', {
      viewBox: '0 ' + (-system.extraTop) + ' ' + Config.viewBox.width + ' ' + viewHeight,
      class: 'manuscript-svg'
    });
    // A system whose window grew stays exactly as large as the others: the box gets
    // taller, the music inside does not change size.
    if (system.extraTop) {
      svg.style.maxHeight = (Config.render.maxHeightPx * viewHeight / Config.viewBox.height) + 'px';
    }

    // Soft graphite smudge behind the measure being practised (test.html draws it
    // before the staff, so it sits underneath). Every measure gets one; the others
    // simply wait, hidden.
    system.measures.forEach(function (measure) {
      const smudge = make('rect', {
        x: measure.xStart,
        y: Config.layout.highlight.y,
        width: measure.width,
        height: Config.layout.highlight.height
      }, 'graphite-rub-highlight');
      if (measure.m !== state.activeMeasure) smudge.style.display = 'none';
      highlights[measure.m] = smudge;
      svg.appendChild(smudge);
    });

    // Everything drawn for its looks alone lets clicks through, so a click anywhere in
    // a measure reaches that measure's own invisible target instead of a staff line.
    const staffGroup = make('g', null, 'pencil-stroke no-pointer');

    staff.topStaffLines.concat(staff.bottomStaffLines).forEach(function (y) {
      staffGroup.appendChild(make('line', { x1: staff.x1, x2: staff.x2, y1: y, y2: y }, 'staff-line'));
    });

    staff.barlineX.forEach(function (x) {
      staffGroup.appendChild(make('line', {
        x1: x, x2: x, y1: staff.topStaffLines[0],
        y2: staff.bottomStaffLines[staff.bottomStaffLines.length - 1]
      }, 'bar-line'));
    });

    // Ledger strokes, drawn with the staff so they carry the same pencil edge.
    const ledger = make('g', null, 'pencil-stroke no-pointer');
    system.measures.forEach(function (measure) {
      measure.rh.concat(measure.lh).forEach(function (note) {
        note.ledger.forEach(function (stroke) {
          ledger.appendChild(make('line', {
            x1: stroke.x - Config.layout.ledgerHalfWidth,
            x2: stroke.x + Config.layout.ledgerHalfWidth,
            y1: stroke.y, y2: stroke.y
          }, 'staff-line ledger-line'));
        });
      });
    });

    svg.appendChild(staffGroup);
    // Ledger strokes go on before the notes, so a notehead always covers its own line.
    svg.appendChild(ledger);

    // Handwritten clefs: treble on the top staff as test.html has it, and on the bottom
    // staff whichever clef the left hand is reading in.
    appendClef(svg, 'treble', 'top');
    appendClef(svg, first.lhClef, 'bottom');

    // Key signatures, on both staves, each in the lines its own clef gives it.
    appendKeySignature(svg, first.key, 'treble', 'top', header.sharp.x, header.sharp.gap);
    appendKeySignature(svg, first.key, first.lhClef, 'bottom', header.sharp.x, header.sharp.gap);

    // A key that changes inside the system, and a time signature that changes at all,
    // are written where they happen.
    let runningKey = first.key;
    system.measures.forEach(function (measure, index) {
      if (index > 0 && measure.key !== runningKey) {
        appendKeySignature(svg, measure.key, 'treble', 'top',
          measure.slotStart + header.inlineSharp.offset, header.inlineSharp.gap);
        appendKeySignature(svg, measure.key, measure.lhClef, 'bottom',
          measure.slotStart + header.inlineSharp.offset, header.inlineSharp.gap);
      }
      runningKey = measure.key;

      if (measure.timeChange) {
        appendTimeSignature(svg, measure.timeChange, 'top', measure.slotStart + header.timeSignature.gapFromBarline);
        appendTimeSignature(svg, measure.timeChange, 'bottom', measure.slotStart + header.timeSignature.gapFromBarline);
      }
      if (measure.cueClef) {
        appendCueClef(svg, measure.cueClef, measure.slotEnd - header.cueClef.backFromBarline);
      }
      if (measure.octaveShift > 0) appendOctaveLine(svg, measure);
    });

    // Click targets: one invisible rectangle per measure, under the notes but over
    // everything else. Clicking a note plays it; clicking anywhere else in the measure
    // chooses the measure.
    system.measures.forEach(function (measure) {
      const target = make('rect', {
        x: measure.slotStart, y: 0,
        width: measure.slotEnd - measure.slotStart,
        height: viewHeight
      }, 'measure-hit');
      target.addEventListener('click', function (event) {
        window.App.onMeasureClick(measure.m, event);
      });
      svg.appendChild(target);
    });

    system.measures.forEach(function (measure) {
      svg.appendChild(makeLabel(measure.xStart + Config.layout.measureNumber.dx,
        Config.layout.measureNumber.dy, 'measure-num no-pointer',
        String(measure.m), String(measure.m)));

      measure.beams.forEach(function (beam) {
        svg.appendChild(make('line', {
          x1: beam.x1, y1: beam.y1, x2: beam.x2, y2: beam.y2
        }, 'note-beam no-pointer' + (beam.level > 1 ? ' beam-secondary' : '')));
      });

      measure.ties.forEach(function (tie) {
        const middleX = (tie.x1 + tie.x2) / 2;
        const middleY = (tie.y1 + tie.y2) / 2 - Config.layout.tie.height;
        svg.appendChild(make('path', {
          d: 'M ' + tie.x1 + ' ' + tie.y1 + ' Q ' + middleX + ' ' + middleY + ' ' + tie.x2 + ' ' + tie.y2
        }, 'tie-arc no-pointer'));
      });

      measure.rh.forEach(function (note) { svg.appendChild(renderEvent(note, measure, 'rh')); });
      measure.lh.forEach(function (note) { svg.appendChild(renderEvent(note, measure, 'lh')); });
    });

    return svg;
  }

  function appendClef(svg, clef, staff) {
    const definition = Config.header.clefs[clef] || Config.header.clefs.treble;
    const node = make('text', {
      x: definition.x, y: clefBaseline(clef, staff), 'font-size': definition.size,
      fill: 'var(--graphite-2b)', class: 'pencil-stroke clef no-pointer'
    });
    node.textContent = definition.glyph;
    svg.appendChild(node);
  }

  /** The sharps of a key signature, in circle-of-fifths order, on one staff. */
  function appendKeySignature(svg, key, clef, staff, startX, gap) {
    const sharp = Config.header.sharp;
    const signature = (Config.keySignatures[key] || {})[clef] || [];

    signature.forEach(function (position, index) {
      const y = window.App.Layout.staffY(position.letter, position.octave, clef, staff) + sharp.baselineLift;
      const node = make('text', {
        x: startX + index * gap, y: y, 'font-size': sharp.size,
        fill: 'var(--graphite-2b)', class: 'pencil-stroke key-sharp no-pointer'
      });
      node.textContent = '♯';
      svg.appendChild(node);
    });
  }

  /**
   * A clef at the end of a measure, warning that the next one changes.
   * A fraction of the usual size, exactly as the reference score draws it.
   */
  function appendCueClef(svg, clef, x) {
    const definition = Config.header.clefs[clef] || Config.header.clefs.bass;
    const node = make('text', {
      x: x, y: clefBaseline(clef, 'bottom'), 'font-size': Config.header.cueClef.size,
      fill: 'var(--graphite-hb)', class: 'pencil-stroke cue-clef no-pointer'
    });
    node.textContent = definition.glyph;
    svg.appendChild(node);
  }

  /** A time signature drawn on the staves, one number over the other. */
  function appendTimeSignature(svg, time, staff, x) {
    const parts = String(time).split('/');
    const settings = Config.header.timeSignature;
    const middle = linesFor(staff)[2];

    [{ text: parts[0], dy: settings.numeratorDy }, { text: parts[1], dy: settings.denominatorDy }]
      .forEach(function (part) {
        const node = make('text', {
          x: x, y: middle + part.dy, 'font-size': settings.size,
          fill: 'var(--graphite-2b)', class: 'pencil-stroke time-signature no-pointer'
        });
        node.textContent = part.text;
        svg.appendChild(node);
      });
  }

  /** The dashed 8va line over a measure that sounds an octave above what is written. */
  function appendOctaveLine(svg, measure) {
    const settings = Config.layout.octaveLine;
    const y = linesFor('top')[0] - settings.y;
    const from = measure.slotStart + 6;
    const to = measure.slotEnd - 6;

    svg.appendChild(make('line', {
      x1: from, x2: to, y1: y, y2: y,
      'stroke-dasharray': settings.dash
    }, 'octave-line no-pointer'));

    const label = make('text', {
      x: from + 2, y: y - settings.labelGap, 'font-size': settings.labelSize,
      fill: 'var(--graphite-hb)', class: 'pencil-stroke octave-mark no-pointer'
    });
    label.textContent = '8va';
    svg.appendChild(label);
  }

  /**
   * One beat: its stem, its noteheads, and its handwritten label. A beat may hold a
   * chord, a rest, or a grace note leaning into the beat it belongs to.
   */
  function renderEvent(note, measure, hand) {
    const layout = Config.layout;
    const group = make('g', null, 'note-group');
    group.dataset.measure = measure.m;
    group.dataset.midi = note.midi;
    group.addEventListener('click', function () {
      window.App.onNoteClick(measure.m, note.midi);
    });

    if (note.rest) {
      group.appendChild(renderRest(note));
      return group;
    }

    const grace = note.grace;
    const scale = grace ? layout.grace.scale : 1;

    // A chord shares one stem, which spans from its highest notehead to a little past
    // its lowest — the stem test.html draws, made to fit a chord.
    if (note.hasStem !== false) {
      group.appendChild(make('line', {
        x1: note.x - layout.stemOffset * scale, x2: note.x - layout.stemOffset * scale,
        y1: note.stem.top, y2: note.stem.bottom
      }, 'note-stem'));

      if (grace) {
        // The slash that marks a grace note.
        const slash = layout.grace.slashLength;
        group.appendChild(make('line', {
          x1: note.x - layout.stemOffset - slash / 2, x2: note.x - layout.stemOffset + slash / 2,
          y1: (note.stem.top + note.stem.bottom) / 2 + slash / 2,
          y2: (note.stem.top + note.stem.bottom) / 2 - slash / 2
        }, 'grace-slash'));
      }
    }

    note.heads.forEach(function (head) {
      const rx = (head.y === note.y || note.heads.length === 1 ? layout.note.rx : layout.note.rx) * scale;
      group.appendChild(make('ellipse', {
        cx: note.x, cy: head.y, rx: rx, ry: layout.note.ry * scale,
        transform: 'rotate(' + layout.note.tilt + ' ' + note.x + ' ' + head.y + ')'
      }, 'note-head' + (note.hollow ? ' hollow' : '') + (grace ? ' grace-head' : '')));
    });

    // The label: above the melody, below the bass. A chord prints its whole stack when
    // there is room for it and its top note when there is not.
    const labelText = hand === 'rh' ? note.num : note.num;
    const labelLet = hand === 'rh' ? note.let : note.let;
    if (hand === 'rh') {
      const text = fitsStack(labelText, note) ? labelText : note.topNum;
      const text2 = fitsStack(labelLet, note) ? labelLet : note.topLet;
      group.appendChild(makeLabel(note.x, note.y + note.labelDy, 'written-note-rh',
        text, text2, note.labelSize));
    } else {
      group.appendChild(makeLabel(note.x + layout.lhLabel.dx, note.y + layout.lhLabel.dy,
        'written-note-lh', labelText, labelLet, 0));
    }

    return group;
  }

  /** A chord's full stack of labels only when the measure's writing is big enough. */
  function fitsStack(text, note) {
    if (note.heads.length < 2) return true;
    return note.labelSize >= Config.layout.denseLabel.staggerBelow;
  }

  /** A rest, drawn as a pencil squiggle at the middle of its staff. */
  function renderRest(note) {
    const rest = Config.layout.rest;
    const half = rest.width / 2;
    const top = note.y - rest.height / 2;
    return make('path', {
      d: 'M ' + (note.x - half) + ' ' + top +
        ' L ' + (note.x + half) + ' ' + (top + rest.height * 0.28) +
        ' L ' + (note.x - half) + ' ' + (top + rest.height * 0.5) +
        ' L ' + (note.x + half) + ' ' + (top + rest.height * 0.78) +
        ' L ' + (note.x - half) + ' ' + (top + rest.height)
    }, 'rest-stroke no-pointer');
  }

  /** Switch every label between 123 and ABC without redrawing the sheet. */
  function applyMode(container, mode) {
    const labels = container.querySelectorAll('[data-num]');
    Array.prototype.forEach.call(labels, function (label) {
      label.textContent = mode === 'number' ? label.dataset.num : label.dataset.let;
    });
  }

  return {
    renderSheet: renderSheet,
    applyMode: applyMode
  };
})();
