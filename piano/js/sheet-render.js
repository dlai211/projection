/**
 * Draws the grand staff: brace, clefs, key and time signatures, barlines, notes,
 * beams, ledger lines and the handwritten annotations.
 *
 * Everything is drawn with the real Bravura outlines (js/glyphs-bravura.js), so the
 * musical shapes are correctly proportioned rather than assembled from Unicode
 * characters that render differently — or not at all — from one machine to the next.
 *
 * Layout rule: the music is a fixed pixel size and only the space between systems
 * changes, so a denser view fits more systems instead of shrinking them.
 */
window.App = window.App || {};

window.App.SheetRender = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var Config = window.App.Config;
  var Staff = window.App.Staff;
  var Glyphs = window.App.Glyphs;

  /** Set by app.js so clicks can be routed back into the practice state. */
  var clickHandler = null;

  var sheet = Config.sheet;

  /** Key signatures stay within three sharps for this score. */
  var SHARP_STAFF_Y = {
    treble: { F: 42, C: 62, G: 32 },
    bass: { F: 142, C: 132, G: 152 },
  };

  var state = {
    score: null,
    systemElements: [],
    hitAreas: [],
    activeMeasure: 1,
    density: Config.layout.defaultDensity,
    notation: null, // the active notation module, set with setNotation()
  };

  // ---------------------------------------------------------------- SVG helpers

  function el(name, attributes, text) {
    var node = document.createElementNS(NS, name);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        if (attributes[key] !== null && attributes[key] !== undefined) {
          node.setAttribute(key, attributes[key]);
        }
      });
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * A plain HTML element. Kept separate from el() on purpose: creating a <div>
   * with createElementNS(SVG_NS, ...) silently yields an SVG-namespaced element
   * that HTML stylesheets never match.
   */
  function html(name, className) {
    var node = document.createElement(name);
    if (className) node.className = className;
    return node;
  }

  /** A glyph from the extracted Bravura outlines, positioned by its origin. */
  function glyph(name, x, y, scale) {
    var data = Glyphs[name];
    if (!data) return null;
    return el('path', {
      d: data.d,
      transform: 'translate(' + x + ' ' + y + ') scale(' + scale + ')',
    });
  }

  // -------------------------------------------------------------------- layout

  /**
   * Decide how many systems fit, how big the music is and how much air goes
   * between the systems.
   *
   * @param {number} width  the drawing width available, in CSS pixels
   * @param {number} height the drawing height available, in CSS pixels
   */
  function computeLayout(width, height) {
    var layout = Config.layout;
    var density = layout.density[state.density] || layout.density.normal;
    var count = state.score.systems.length;
    var paddingTop = layout.pagePaddingTop;
    var paddingBottom = layout.pagePaddingBottom;
    var availableHeight = height - paddingTop - paddingBottom;

    /**
     * How big the music is drawn.
     *
     * The system is capped at maxSystemWidth, which is what fixes the size of the
     * notation on screen — the staff space comes out at 13.6 px, the reference
     * design's size. Only a window narrower than that cap shrinks the music, and
     * then the two dimensions shrink together so nothing is ever distorted.
     */
    var systemWidth = Math.min(layout.maxSystemWidth, width);
    var scale = systemWidth / sheet.viewBox.w;

    /**
     * `systemGapPx` is an exact on-page distance, and it can be exact because the
     * drawing band *is* the ink band.
     *
     * The SVG for a system shows only `inkTop .. inkBottom` of the drawing's
     * coordinate space, so there is no empty margin inside a system to leak into
     * the spacing. Two neighbouring systems are therefore separated by exactly
     * `systemGapPx`, whatever it is set to.
     */
    var inkTop = layout.inkTop !== undefined ? layout.inkTop : sheet.viewBox.from;
    var inkBottom = layout.inkBottom !== undefined ? layout.inkBottom : sheet.viewBox.from + sheet.viewBox.h;
    var bandHeight = inkBottom - inkTop;
    var musicHeight = bandHeight * scale;

    // Box separation = the requested gap, converted to drawing units. The stride
    // is one band plus that gap.
    var boxGapWorld = density.systemGapPx / scale;
    var strideWorld = bandHeight + boxGapWorld;
    var stride = strideWorld * scale;

    var systems = count;
    if (availableHeight < musicHeight) {
      systems = 1;
    } else {
      systems = Math.min(count,
        Math.floor((availableHeight + density.systemGapPx) / stride));
    }
    systems = Math.max(1, systems);

    // The requested gap is honoured exactly; whatever height is left over stays
    // as blank space at the bottom of the scroll range rather than being pushed
    // into the gaps.
    var blockHeight = systems * musicHeight + Math.max(0, systems - 1) * density.systemGapPx;

    return {
      width: width,
      height: height,
      systemWidth: systemWidth,
      musicHeight: musicHeight,
      bandHeight: bandHeight,
      inkTop: inkTop,
      stride: stride,
      boxGap: density.systemGapPx,
      visibleGap: density.systemGapPx,
      top: paddingTop + Math.max(0, (availableHeight - blockHeight) / 2),
      offsetX: Math.max(0, (width - systemWidth) / 2),
      systems: systems,
      scale: scale,
    };
  }

  // --------------------------------------------------------------------- notes

  /**
   * Horizontal positions of the notes in one measure.
   *
   * The score carries no duration data, so the notes are spaced the way the
   * reference engraving spaces them: the first pair is wider and the remaining
   * notes sit at an even step, which for a 6/8 bar reproduces the reference
   * layout to within a pixel or two.
   */
  function noteColumns(count) {
    var weights = [];
    for (var i = 0; i < count; i++) weights.push(i < 2 ? 1.5 : 1);
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    if (!total) total = 1;

    var columns = [];
    var running = 0;
    for (var j = 0; j < count; j++) {
      columns.push((running + weights[j] / 2) / total);
      running += weights[j];
    }
    return columns;
  }

  /**
   * Which runs of notes are beamed together.
   *
   * The score has no duration data, so the grouping is derived from the note count
   * the way the reference engraving groups them: a leading pair (the dotted-eighth
   * plus sixteenth that opens most 6/8 bars) and then runs of three, which together
   * give the 3+3+3+3 sixteenths of a 6/8 bar.
   */
  function beamGroups(count) {
    if (count < 3) return [];

    var groups = [];
    var index = 0;
    var remaining = count;

    // One tied group at a time, splitting whenever the rest needs two beats.
    while (remaining > 0) {
      var size = remaining <= 5 ? Math.ceil(remaining / 2) : 3;
      size = Math.min(size, remaining);

      if (size > 1) groups.push([index, index + size - 1]);
      else if (index > 0) groups[groups.length - 1][1] = index; // lone note joins the run

      index += size;
      remaining -= size;
    }
    return groups;
  }

  /** Where a notehead sits on the staff, plus the ledger lines it needs. */
  function place(midi) {
    var chosen = midi < 60 ? 'bass' : 'treble';
    var position = Staff.position(midi, chosen);
    return {
      clef: chosen,
      y: position.y,
      ledgers: Staff.ledgerLines(position.y, chosen, sheet),
      stemUp: Staff.stemUp(position.y, chosen, sheet),
    };
  }

  /** The character a note's accidental is drawn with, or null when it needs none. */
  function accidentalSymbolFor(spelled) {
    if (spelled.accidental === window.App.NotesLetter.SHARP ||
        spelled.accidental === window.App.NotesNumber.SHARP) {
      return '♯';
    }
    if (spelled.accidental === window.App.NotesLetter.NATURAL ||
        spelled.accidental === window.App.NotesNumber.NATURAL) {
      return '♮';
    }
    if (spelled.accidental === 'b') return '♭';
    return null;
  }

  /**
   * Draw one notehead with its accidental, ledger lines, stem and label.
   * Returns geometry the caller needs for beams.
   */
  function drawNote(group, options) {
    // Noteheads are the one place the pencil filter is worth its cost — it is what
    // makes the notation read as drawn on paper instead of printed.
    var head = el('ellipse', {
      cx: options.x,
      cy: options.y,
      rx: sheet.note.rx,
      ry: sheet.note.ry,
      transform: 'rotate(' + sheet.note.tiltDegrees + ' ' + options.x + ' ' + options.y + ')',
      class: 'note-head',
    });
    group.appendChild(head);

    options.ledgers.forEach(function (ledgerY) {
      group.appendChild(el('line', {
        x1: options.x - sheet.note.ledgerHalfWidth,
        x2: options.x + sheet.note.ledgerHalfWidth,
        y1: ledgerY,
        y2: ledgerY,
        class: 'ledger-line',
      }));
    });

    if (options.accidentalSymbol) {
      // Drawn on the same staff position as the note it alters, then nudged up so
      // the ink straddles the line or space the way a pencil stroke would.
      group.appendChild(el('text', {
        x: options.x - sheet.note.rx - 10,
        y: options.y + sheet.header.sharpSize * 0.34,
        'font-size': sheet.header.sharpSize,
        class: 'music-glyph accidental-glyph',
      }, options.accidentalSymbol));
    }

    if (options.dotted) {
      var dot = el('circle', {
        cx: options.x + sheet.note.rx + 4,
        cy: options.y,
        r: 1.9,
        class: 'augmentation-dot',
      });
      group.appendChild(dot);
    }

    if (options.withStem) {
      var stemX = options.stemUp ? options.x + sheet.note.stemGap : options.x - sheet.note.stemGap;
      var stemEnd = options.stemUp ? options.y - sheet.note.stemLength : options.y + sheet.note.stemLength;
      group.appendChild(el('line', {
        x1: stemX, x2: stemX, y1: options.y, y2: stemEnd, class: 'note-stem',
      }));
      options.stemGeometry = { x: stemX, y: stemEnd, up: options.stemUp };
    }

    return options.stemGeometry;
  }

  // ------------------------------------------------------------------ measures

  function drawStaffLines(group, top, right) {
    var staff = sheet.staff;
    for (var i = 0; i < staff.lines; i++) {
      var y = top + i * staff.space;
      group.appendChild(el('line', {
        x1: staff.marginLeft,
        x2: right,
        y1: y,
        y2: y,
        class: 'staff-line',
      }));
    }
  }

  /**
   * The barline closing the grand staff on the left, running from the top line of
   * the treble staff to the bottom line of the bass staff. The reference design
   * draws this instead of a curly brace.
   */
  function drawLeftBarline(group) {
    var staff = sheet.staff;
    group.appendChild(el('line', {
      x1: sheet.header.leftBarX,
      x2: sheet.header.leftBarX,
      y1: staff.trebleTop,
      y2: staff.bassTop + staff.space * (staff.lines - 1),
      class: 'bar-line bar-line-left',
    }));
  }

  /**
   * The clefs, drawn as glyphs and then roughened by the pencil filter so they
   * read as strokes on paper rather than as engraved type.
   */
  function drawClefs(group) {
    var size = sheet.header.clefSize;
    var staff = sheet.staff;

    // The treble clef's baseline sits on the bottom line of the treble staff;
    // the bass clef's sits on the F line, the second line from the top.
    group.appendChild(el('text', {
      x: sheet.header.gClefX,
      y: staff.trebleTop + staff.space * (staff.lines - 1),
      'font-size': size,
      class: 'music-glyph clef-glyph',
    }, '\uD834\uDD1E'));

    group.appendChild(el('text', {
      x: sheet.header.fClefX,
      y: staff.bassTop + staff.space * 2,
      'font-size': size * 0.94,
      class: 'music-glyph clef-glyph',
    }, '\uD834\uDD22'));
  }

  /**
   * Key signature: the sharps belonging to the key, each on its proper line or
   * space. The vertical placements follow standard engraving practice rather than
   * a calculated pattern, because that is what makes them look right.
   */
  function drawKeySignature(group, keyId, offsetX) {
    var key = window.App.NotesLetter.keySignature(keyId);
    if (!key.count) return 0;

    var x = sheet.header.sharpX + (offsetX || 0);

    key.sharps.slice(0, 3).forEach(function (letter, index) {
      var columnX = x + index * sheet.header.sharpStep;
      ['treble', 'bass'].forEach(function (clef) {
        var staffY = SHARP_STAFF_Y[clef][letter];
        if (staffY === undefined) return;
        // The sharp is drawn with its baseline on the note it alters, then nudged
        // up so the ink straddles the line or space the way a pencil would.
        group.appendChild(el('text', {
          x: columnX,
          y: staffY + sheet.header.sharpSize * 0.34,
          'font-size': sheet.header.sharpSize,
          class: 'music-glyph sharp-glyph',
        }, '\u266F'));
      });
    });

    return 3 * sheet.header.sharpStep;
  }

  /**
   * Everything drawn once at the left edge of a system: the closing barline, the
   * two clefs and the key signature. The reference design carries no time
   * signature on the staves — the pulse is stated once in the page header — so
   * none is drawn here.
   */
  function drawSystemHeader(group, system) {
    drawLeftBarline(group);
    drawClefs(group);
    drawKeySignature(group, system.measures[0].key, 0);
  }

  function drawMeasureNumber(group, number, x) {
    group.appendChild(el('text', {
      x: x,
      y: sheet.measureNumberY,
      class: 'measure-number',
    }, number));
  }

  var notation = function () {
    return state.notation || window.App.NotesLetter;
  };

  /**
   * Draw one measure: its notes, beams, labels, and any signature change that
   * happens on the barline before it.
   */
  function drawMeasure(group, measure, geometry, isFirst, isLast) {
    var layoutConfig = Config.layout;
    var notes = measure.rightHand;
    var columns = noteColumns(notes.length);
    var usableLeft = geometry.left;
    var usableWidth = geometry.width;

    // A key or time signature that changes mid-system is drawn before the barline.
    var signatureShift = 0;
    if (!isFirst && (measure.changedKey || measure.changedTime)) {
      var changeGroup = el('g', { class: 'pencil-stroke' });
      if (measure.changedKey) {
        signatureShift += drawKeySignature(changeGroup, measure.key, -30);
      }
      group.appendChild(changeGroup);
    }

    if (isFirst) drawMeasureNumber(group, measure.number, geometry.left + 4);

    // Barlines bracket the measure.
    group.appendChild(el('line', {
      x1: geometry.left + signatureShift,
      x2: geometry.left + signatureShift,
      y1: sheet.staff.trebleTop,
      y2: sheet.staff.bassTop + sheet.staff.space * 4,
      class: 'bar-line',
    }));
    if (isLast) {
      group.appendChild(el('line', {
        x1: geometry.left + geometry.width,
        x2: geometry.left + geometry.width,
        y1: sheet.staff.trebleTop,
        y2: sheet.staff.bassTop + sheet.staff.space * 4,
        class: 'bar-line bar-line-final',
      }));
    }

    // Right hand -----------------------------------------------------------
    var rightX = notes.map(function (_, index) {
      return usableLeft + signatureShift + columns[index] * usableWidth;
    });

    var beamTops = [];
    notes.forEach(function (note, index) {
      var placed = place(note.midi);
      var noteGroup = el('g', { class: 'note-group' });
      var x = rightX[index];

      var spelled = notation().spell(note.midi, measure.key);
      var stem = drawNote(noteGroup, {
        x: x,
        y: placed.y,
        ledgers: placed.ledgers,
        stemUp: placed.stemUp,
        dotted: note.dotted,
        accidentalSymbol: accidentalSymbolFor(spelled),
        withStem: true,
      });
      if (stem) beamTops.push(stem);

      // Labels sit on the side away from the stem so the two never collide.
      // The numbers are roughly 0.7em tall, which is what the constants below
      // account for (font sizes live in components.css).
      var labelY = placed.stemUp
        ? placed.y + sheet.note.ry + sheet.note.labelGap + 11
        : placed.y - sheet.note.ry - sheet.note.labelGap - 5;

      noteGroup.appendChild(el('text', {
        x: x,
        y: labelY,
        class: 'note-label hand-right',
      }, notation().staffLabel(note.midi, measure.key)));

      noteGroup.addEventListener('click', function () {
        if (clickHandler) clickHandler(measure.number, note.midi);
      });
      group.appendChild(noteGroup);
    });

    // Beams ----------------------------------------------------------------
    // A beam is simply the line joining the ends of the stems in its group; when
    // the melody changes direction the beam tilts with it, as engraving expects.
    beamGroups(notes.length).forEach(function (range) {
      var first = beamTops[range[0]];
      var last = beamTops[range[1]];
      if (!first || !last || first.up !== last.up) return;
      group.appendChild(el('line', {
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        class: 'note-beam',
      }));
    });

    // Left hand ------------------------------------------------------------
    var leftGroups = Math.max(1, Math.min(measure.leftHand.length, 2));
    measure.leftHand.forEach(function (midi, index) {
      var slot = leftGroups === 1 ? 0 : (index === 0 ? 0 : notes.length - 1);
      var x = rightX[Math.min(slot, rightX.length - 1)] || usableLeft;
      var placed = place(midi);
      var noteGroup = el('g', { class: 'note-group' });

      var spelled = notation().spell(midi, measure.key);
      drawNote(noteGroup, {
        x: x,
        y: placed.y,
        ledgers: placed.ledgers,
        stemUp: placed.stemUp,
        dotted: false,
        accidentalSymbol: accidentalSymbolFor(spelled),
        withStem: false,
      });

      // The label goes below the notehead, never above it: the space between the
      // staves belongs to the melody's own labels. The drawing band is tall enough
      // (see layout.inkBottom) that this still clears the next system.
      var labelY = placed.y + sheet.note.ry + sheet.note.labelGap + 12;

      noteGroup.appendChild(el('text', {
        x: x,
        y: labelY,
        class: 'note-label hand-left',
      }, notation().label(midi, measure.key)));

      noteGroup.addEventListener('click', function () {
        if (clickHandler) clickHandler(measure.number, midi);
      });
      group.appendChild(noteGroup);
    });

    return { rightX: rightX, beamTops: beamTops };
  }

  // --------------------------------------------------------------------- render

  function render(container, score) {
    if (score) state.score = score;
    if (!state.score) return null;

    // Measured against the full area: the drawing is capped at a fixed size and
    // centred, so the page margins come out of computeLayout rather than CSS.
    var geometry = computeLayout(container.clientWidth, container.clientHeight);
    state.container = container;

    // The page is taller than the window whenever the song needs more systems
    // than fit, so only the systems actually on screen are drawn. Scrolling
    // re-renders the window, which keeps the DOM small (64 measures of notation
    // is a lot of elements to keep alive all at once).
    // The spacer covers the *whole* score, not just the part that fits, so the
    // area has something to scroll through and every measure stays reachable.
    var totalSystems = state.score.systems.length;
    var totalHeight = totalSystems * geometry.musicHeight +
      Math.max(0, totalSystems - 1) * geometry.boxGap +
      Config.layout.pagePaddingTop + Config.layout.pagePaddingBottom;
    geometry.totalHeight = totalHeight;
    state.layout = geometry;

    // Which systems the viewport covers, taken from the live scroll position and
    // the real container height — never from the number of systems computeLayout
    // chose to draw, or scrolling could run past everything that was drawn.
    var firstVisible = Math.max(0, Math.floor(
      (container.scrollTop - Config.layout.pagePaddingTop) / geometry.stride));
    var lastVisible = Math.min(totalSystems - 1, Math.max(firstVisible,
      Math.floor((container.scrollTop + container.clientHeight -
        Config.layout.pagePaddingTop) / geometry.stride)));

    // Nothing to do when the same window is already on screen: ResizeObserver
    // fires on every layout change, including the ones this function causes.
    // Everything that changes what is drawn must appear in this signature.
    if (window.__trace) window.__trace.push('render scrollTop=' + container.scrollTop + ' first=' + firstVisible + ' last=' + lastVisible);
    var signature = [
      firstVisible,
      lastVisible,
      geometry.scale.toFixed(4),
      state.activeMeasure,
      notation().id,
      state.density,
      state.score.meta.title,
    ].join(':');
    if (state.canvas && state.canvas.parentNode && state.renderSignature === signature) {
      return { geometry: geometry, visibleSystems: lastVisible - firstVisible + 1 };
    }
    state.renderSignature = signature;

    state.systemElements = [];
    state.renderedFirst = firstVisible;
    state.renderedLast = lastVisible;
    state.renderedScale = geometry.scale;

    /**
     * The spacer is created once and then reused.
     *
     * It must never be removed on a re-render: taking it out of the document
     * collapses the scrollable height to nothing, so the browser clamps scrollTop
     * back to 0 and every scroll is undone by the very render it triggered.
     * Re-rendering empties it and fills it again instead.
     */
    if (!state.canvas || !state.canvas.parentNode) {
      state.canvas = html('div', 'sheet-canvas');
      container.appendChild(state.canvas);
    }
    state.canvas.style.height = totalHeight.toFixed(1) + 'px';
    while (state.canvas.firstChild) state.canvas.removeChild(state.canvas.firstChild);

    if (state.ruler && state.ruler.parentNode) state.ruler.parentNode.removeChild(state.ruler);
    state.ruler = html('div', 'position-ruler');

    // The viewBox shows the ink band of the drawing's coordinate space: it starts
    // at the topmost drawn element and is exactly as tall as the ink. One user
    // unit is exactly `scale` CSS pixels. The score is centred horizontally by
    // moving the SVG *box* (margin auto in layout.css), not by sliding the
    // viewBox — keeping the two mechanisms separate is what makes the placement
    // easy to reason about.
    var viewBox = sheet.viewBox.from + ' ' + geometry.inkTop.toFixed(2) + ' ' +
      sheet.viewBox.w.toFixed(2) + ' ' + geometry.bandHeight.toFixed(2);
    var musicRight = sheet.staff.marginRight;

    for (var index = firstVisible; index <= lastVisible; index++) {
      var system = state.score.systems[index];
      var top = Config.layout.pagePaddingTop + index * geometry.stride;
      var svg = el('svg', {
        class: 'system-svg',
        viewBox: viewBox,
        preserveAspectRatio: 'none',
        'aria-label': 'System ' + (index + 1),
      });
      svg.style.setProperty('--system-top', top.toFixed(1) + 'px');
      svg.style.setProperty('--system-height', geometry.musicHeight.toFixed(1) + 'px');
      svg.style.setProperty('--system-width', geometry.systemWidth.toFixed(1) + 'px');

      var canvas = el('g', { class: 'system-canvas' });

      // Painting order is the z-order in SVG, and the graphite smudge behind the
      // active measure has to be laid down before anything it sits under — the
      // staff lines and the notes are drawn on top of it, as pencil would be.
      var highlightGroup = el('g', { class: 'highlight-layer' });
      var notesGroup = el('g', { class: 'notes-group' });
      var cursor = sheet.header.musicStart;
      var remaining = musicRight - cursor;
      var measureWidth = remaining / system.measures.length;

      system.measures.forEach(function (measure, measureIndex) {
        if (measure.number === state.activeMeasure) {
          highlightGroup.appendChild(el('rect', {
            x: cursor - 5,
            y: sheet.staff.trebleTop - 10,
            width: measureWidth + 5,
            height: sheet.staff.bassTop + sheet.staff.space * 4 - sheet.staff.trebleTop + 20,
            rx: 6,
            class: 'measure-highlight',
          }));
        }

        drawMeasure(notesGroup, measure, {
          left: cursor,
          width: measureWidth,
        }, measureIndex === 0, measureIndex === system.measures.length - 1);

        cursor += measureWidth;
      });

      canvas.appendChild(highlightGroup);

      var headerGroup = el('g', { class: 'pencil-stroke header-glyphs' });
      drawSystemHeader(headerGroup, system);
      canvas.appendChild(headerGroup);

      var staffGroup = el('g', { class: 'pencil-stroke staff-group' });
      drawStaffLines(staffGroup, sheet.staff.trebleTop, musicRight);
      drawStaffLines(staffGroup, sheet.staff.bassTop, musicRight);
      canvas.appendChild(staffGroup);

      canvas.appendChild(notesGroup);
      svg.appendChild(canvas);
      state.canvas.appendChild(svg);
      state.systemElements.push(svg);
    }

    container.appendChild(state.ruler);

    // The ruler replaces the scrollbar, so its marks are positioned by where the
    // systems actually are in the whole score — scrolling slides them past.
    // The visible window is recomputed from the real scrollTop because assigning
    // it above may have been clamped by the browser.
    buildRuler();
    markRuler.apply(null, currentWindow());

    return { geometry: geometry, visibleSystems: lastVisible - firstVisible + 1 };
  }

  function setState(next) {
    if (next.activeMeasure !== undefined) state.activeMeasure = next.activeMeasure;
    if (next.density !== undefined) state.density = next.density;
  }

  function setNotation(module) {
    state.notation = module;
  }

  function onMeasureClick(handler) {
    clickHandler = handler;
  }

  /** Which measure occupies a point in the sheet area? */
  function measureAtPoint(clientX, clientY) {
    if (!state.layout || !state.score) return null;

    var scale = state.layout.scale;

    for (var i = 0; i < state.systemElements.length; i++) {
      var box = state.systemElements[i].getBoundingClientRect();
      if (clientY < box.top || clientY > box.bottom) continue;

      var system = state.score.systems[state.renderedFirst + i];
      if (!system) continue;
      var cursor = sheet.header.musicStart;
      var measureWidth = (sheet.staff.marginRight - cursor) / system.measures.length;

      for (var m = 0; m < system.measures.length; m++) {
        var left = box.left + cursor * scale;
        var right = left + measureWidth * scale;
        if (clientX >= left && clientX <= right) return system.measures[m].number;
        cursor += measureWidth;
      }
    }
    return null;
  }

  /**
   * Scroll the sheet so the given measure is comfortably on screen.
   * The scroll position is set directly (rather than via scrollIntoView) so it
   * works even for a system that is not currently rendered.
   */
  function scrollToMeasure(measureNumber, options) {
    if (!state.score || !state.layout || !state.container) return;

    var systemIndex = Math.floor((measureNumber - 1) / Config.score.measuresPerSystem);
    var layout = state.layout;
    var top = Config.layout.pagePaddingTop + systemIndex * layout.stride;
    var bottom = top + layout.musicHeight;

    var viewTop = state.container.scrollTop;
    var viewBottom = viewTop + state.container.clientHeight;
    var margin = options && options.force ? 0 : 8;

    if (top >= viewTop + margin && bottom <= viewBottom - margin) return; // already visible
    state.container.scrollTop = Math.max(0, top - layout.boxGap / 2);
  }

  /**
   * Re-render when the sheet area is scrolled, but only when the visible window
   * actually changes — otherwise every scroll event would redraw the notation.
   */
  /** The band of systems the viewport currently covers, from the live scrollTop. */
  function currentWindow() {
    var layout = state.layout;
    if (!layout || !state.container) return [0, 0];
    var top = state.container.scrollTop;
    var bottom = top + state.container.clientHeight;
    var count = state.score ? state.score.systems.length : layout.systems;
    var first = Math.max(0, Math.floor((top - Config.layout.pagePaddingTop) / layout.stride));
    var last = Math.max(first, Math.floor((bottom - Config.layout.pagePaddingTop) / layout.stride));
    return [Math.min(first, count - 1), Math.min(count - 1, last)];
  }

  function onScroll(container) {
    var layout = state.layout;
    if (!layout) return;
    markRuler.apply(null, currentWindow());
    var first = currentWindow()[0];
    if (window.__trace) window.__trace.push('onScroll top=' + container.scrollTop + ' first=' + first + ' renderedFirst=' + state.renderedFirst);
    if (first !== state.renderedFirst) render(container);
  }

  /**
   * Which measures are on screen right now — shown in the status line so the
   * reader always knows where they are in the piece without a scrollbar.
   */
  function visibleMeasureRange() {
    if (!state.score || !state.layout || !state.container) return null;
    var band = currentWindow();
    var first = band[0];
    var last = band[1];
    var systems = state.score.systems;
    if (!systems[first]) return null;
    var lastSystem = systems[Math.min(Math.max(last, first), systems.length - 1)];
    return {
      from: systems[first].measures[0].number,
      to: lastSystem.measures[lastSystem.measures.length - 1].number,
    };
  }

  /**
   * Draw the ruler: an SVG strip of hand-drawn ticks standing in for the
   * scrollbar.
   *
   * SVG rather than styled HTML, because the graphite pencil effect is an SVG
   * filter and only applies inside an SVG. Ticks are placed by where a system
   * really sits in the whole score, so scrolling slides them past; every fourth
   * system carries the measure it starts at, and the hatched block over the
   * current window is the "you are here".
   */
  function buildRuler() {
    if (!state.ruler || !state.score || !state.layout || !state.container) return;

    var layout = state.layout;
    var total = state.score.systems.length;
    var track = state.container.clientHeight;
    var perSystem = Config.score.measuresPerSystem;
    var width = 30;

    state.ruler.innerHTML = '';

    var svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + track,
      preserveAspectRatio: 'none',
      width: '100%',
      height: track + 'px',
    });

    svg.appendChild(el('rect', {
      x: 11, y: 0, width: 15, height: track, rx: 1, class: 'ruler-body',
    }));

    var totalSpan = Math.max(1, layout.totalHeight);

    for (var i = 0; i < total; i++) {
      var y = ((Config.layout.pagePaddingTop + i * layout.stride) / totalSpan) * track;
      svg.appendChild(el('line', {
        x1: 11, x2: 26, y1: y, y2: y, class: 'tick major',
      }));

      if (i < total - 1) {
        var my = ((Config.layout.pagePaddingTop + (i + 0.5) * layout.stride) / totalSpan) * track;
        svg.appendChild(el('line', {
          x1: 18, x2: 26, y1: my, y2: my, class: 'tick minor',
        }));
      }

      if (i % 4 === 0) {
        svg.appendChild(el('text', { x: 9, y: y + 4, class: 'ruler-mark' },
          String(i * perSystem + 1)));
      }
    }

    // The window block goes on last so it sits above the ticks.
    state.rulerViewportFill = el('rect', { x: 11, width: 15, rx: 2, class: 'viewport-fill' });
    state.rulerViewport = el('rect', { x: 11, width: 15, rx: 2, class: 'viewport' });
    svg.appendChild(state.rulerViewportFill);
    svg.appendChild(state.rulerViewport);

    state.ruler.appendChild(svg);
    state.rulerTrack = track;
  }

  /**
   * Move the hatched block over the systems on screen: scrolling is what moves it,
   * so the ruler always answers "where am I?" at a glance.
   */
  function markRuler(first, last) {
    if (!state.rulerViewport || !state.layout || !state.container) return;

    var track = state.rulerTrack || state.container.clientHeight;
    var totalSpan = Math.max(1, state.layout.totalHeight);
    var stride = state.layout.stride;
    var pad = Config.layout.pagePaddingTop;

    var top = ((pad + first * stride) / totalSpan) * track;
    var nextTop = ((pad + (last + 1) * stride) / totalSpan) * track;
    var height = Math.max(8, Math.min(track - top, nextTop - top - state.layout.boxGap));

    [state.rulerViewport, state.rulerViewportFill].forEach(function (node) {
      if (!node) return;
      node.setAttribute('y', top.toFixed(1));
      node.setAttribute('height', height.toFixed(1));
    });
  }

  /**
   * Jump to a point on the ruler. `fraction` is 0 at the top of the strip and 1 at
   * the bottom, so the sheet scrolls to the matching place in the score.
   */
  function seekFraction(fraction) {
    if (!state.container || !state.layout) return;
    var layout = state.layout;
    var count = state.score ? state.score.systems.length : layout.systems;
    var maxScroll = Math.max(0, state.container.scrollHeight - state.container.clientHeight);
    var wanted = Math.max(0, Math.min(1, fraction)) * count;
    var top = Config.layout.pagePaddingTop + wanted * layout.stride;
    state.container.scrollTop = Math.max(0, Math.min(maxScroll, top - layout.musicHeight / 2));
    markRuler.apply(null, currentWindow());
  }

  return {
    render: render,
    computeLayout: computeLayout,
    setState: setState,
    setNotation: setNotation,
    onMeasureClick: onMeasureClick,
    measureAtPoint: measureAtPoint,
    scrollToMeasure: scrollToMeasure,
    onScroll: onScroll,
    visibleMeasureRange: visibleMeasureRange,
    seekFraction: seekFraction,
    noteColumns: noteColumns,
    getState: function () { return state; },
  };
})();
