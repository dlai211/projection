/**
 * Drawing the score.
 *
 * This is test.html's renderSheet(), kept whole: the same elements, the same classes,
 * the same order, so the pencil filters and the CSS land on exactly the same shapes.
 * The only differences are that it draws sixteen systems instead of two, takes its
 * coordinates from js/layout.js instead of from hand-written numbers, and can grow a
 * system's drawing window upward when a note sits above the staff.
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

    const staffGroup = make('g', null, 'pencil-stroke');

    staff.trebleLines.concat(staff.bassLines).forEach(function (y) {
      staffGroup.appendChild(make('line', {
        x1: staff.x1, x2: staff.x2, y1: y, y2: y
      }, 'staff-line'));
    });

    staff.barlineX.forEach(function (x) {
      staffGroup.appendChild(make('line', {
        x1: x, x2: x, y1: staff.trebleLines[0], y2: staff.bassLines[staff.bassLines.length - 1]
      }, 'bar-line'));
    });

    // Ledger strokes, drawn with the staff so they carry the same pencil edge.
    const ledger = make('g', null, 'pencil-stroke');
    system.measures.forEach(function (measure) {
      measure.rh.concat(measure.lh).forEach(function (note) {
        note.ledger.forEach(function (y) {
          ledger.appendChild(make('line', {
            x1: note.x - Config.layout.ledgerHalfWidth,
            x2: note.x + Config.layout.ledgerHalfWidth,
            y1: y, y2: y
          }, 'staff-line ledger-line'));
        });
      });
    });

    svg.appendChild(staffGroup);
    // Ledger strokes go on before the notes, so a notehead always covers its own line.
    svg.appendChild(ledger);

    // Handwritten clefs, exactly where test.html puts them.
    svg.appendChild(make('text', {
      x: header.trebleClef.x, y: header.trebleClef.y, 'font-size': header.trebleClef.size,
      fill: 'var(--graphite-2b)', class: 'pencil-stroke clef'
    })).textContent = '𝄞';

    svg.appendChild(make('text', {
      x: header.bassClef.x, y: header.bassClef.y, 'font-size': header.bassClef.size,
      fill: 'var(--graphite-2b)', class: 'pencil-stroke clef'
    })).textContent = '𝄢';

    // Key signature at the head of the system, and again wherever the key changes
    // inside it (measure 42 is the one place that happens).
    appendKeySignature(svg, system.measures[0].key, header.sharp.x, header.sharp.gap);
    let runningKey = system.measures[0].key;
    system.measures.forEach(function (measure, index) {
      if (index > 0 && measure.key !== runningKey) {
        appendKeySignature(svg, measure.key,
          measure.slotStart + header.inlineSharp.offset, header.inlineSharp.gap);
      }
      runningKey = measure.key;
    });

    system.measures.forEach(function (measure) {
      svg.appendChild(makeLabel(measure.xStart + Config.layout.measureNumber.dx,
        Config.layout.measureNumber.dy, 'measure-num', String(measure.m), String(measure.m)));

      measure.beams.forEach(function (beam) {
        svg.appendChild(make('line', {
          x1: beam[0], y1: beam[1], x2: beam[2], y2: beam[3]
        }, 'note-beam'));
      });

      measure.rh.forEach(function (note) {
        svg.appendChild(renderMelodyNote(note, measure));
      });
      measure.lh.forEach(function (note) {
        svg.appendChild(renderBassNote(note, measure));
      });
    });

    return svg;
  }

  /** The sharps of a key signature, in circle-of-fifths order. */
  function appendKeySignature(svg, key, startX, gap) {
    const sharp = Config.header.sharp;
    const signature = Config.keySignatures[key] || [];

    signature.forEach(function (position, index) {
      const y = window.App.Layout.staffY(position.letter, position.octave, 'treble') + sharp.baselineLift;
      svg.appendChild(make('text', {
        x: startX + index * gap, y: y, 'font-size': sharp.size,
        fill: 'var(--graphite-2b)', class: 'pencil-stroke key-sharp'
      })).textContent = '♯';
    });
  }

  /** A melody note: stem, tilted notehead, and its handwritten label above it. */
  function renderMelodyNote(note, measure) {
    const layout = Config.layout;
    const group = make('g', null, 'note-group');
    group.dataset.measure = measure.m;
    group.dataset.midi = note.midi;
    group.addEventListener('click', function () {
      window.App.onNoteClick(measure.m, note.midi);
    });

    group.appendChild(make('line', {
      x1: note.stem.x, x2: note.stem.x, y1: note.stem.top, y2: note.stem.bottom
    }, 'note-stem'));

    group.appendChild(make('ellipse', {
      cx: note.x, cy: note.y, rx: layout.note.rx, ry: layout.note.ry,
      transform: 'rotate(' + layout.note.tilt + ' ' + note.x + ' ' + note.y + ')'
    }, 'note-head' + (note.hollow ? ' hollow' : '')));

    group.appendChild(makeLabel(note.x, note.y + note.labelDy, 'written-note-rh',
      note.num, note.let, note.labelSize));

    return group;
  }

  /** A bass note: an open or filled oval with its chord written underneath. */
  function renderBassNote(note, measure) {
    const layout = Config.layout;
    const group = make('g', null, 'note-group');
    group.dataset.measure = measure.m;
    group.dataset.midi = note.midi;
    group.addEventListener('click', function () {
      window.App.onNoteClick(measure.m, note.midi);
    });

    group.appendChild(make('ellipse', {
      cx: note.x, cy: note.y, rx: layout.bassNote.rx, ry: layout.bassNote.ry,
      transform: 'rotate(' + layout.bassNote.tilt + ' ' + note.x + ' ' + note.y + ')'
    }, 'note-head' + (note.hollow ? ' hollow' : '')));

    group.appendChild(makeLabel(note.x + layout.lhLabel.dx, note.y + layout.lhLabel.dy,
      'written-note-lh', note.num, note.let, 0));

    return group;
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
