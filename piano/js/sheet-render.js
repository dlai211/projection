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

  /** The scale that maps one staff space (10 units) onto the staff-space glyphs. */
  function glyphScale() {
    return sheet.staff.space;
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

    var musicHeight = sheet.viewBox.h * scale;

    /**
     * Turning the *visible* gap into the space between two drawing boxes.
     *
     * A box is `viewBox.h` tall, but its ink stops short of the bottom edge (and
     * starts a little above the top). So the distance between two boxes has to be
     * shrunk by that unused space, or `systemGapPx: 0` would still leave the
     * boxes' own empty margins showing as a gap.
     */
    var inkTop = layout.inkTop !== undefined ? layout.inkTop : sheet.viewBox.from;
    var inkBottom = layout.inkBottom !== undefined ? layout.inkBottom : sheet.viewBox.from + sheet.viewBox.h;
    var emptyInBand = (sheet.viewBox.from + sheet.viewBox.h - inkBottom) + (inkTop - sheet.viewBox.from);
    var gap = Math.max(0, density.systemGapPx - emptyInBand * scale);

    var systems = count;
    if (availableHeight < musicHeight) {
      systems = 1;
    } else {
      systems = Math.min(count,
        1 + Math.floor((availableHeight - musicHeight) / (musicHeight + gap)));
    }
    systems = Math.max(1, systems);

    // Leftover room is shared out between the systems rather than dumped at the
    // bottom, so the score stays balanced on the page. The gap you see is
    // therefore usually roomier than the configured minimum.
    var slack = availableHeight - systems * musicHeight;
    var usedGap = systems > 1 ? Math.max(gap, slack / (systems - 1)) : 0;
    var blockHeight = systems * musicHeight + Math.max(0, systems - 1) * usedGap;

    return {
      width: width,
      height: height,
      systemWidth: systemWidth,
      musicHeight: musicHeight,
      gap: usedGap,
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

  function accidentalGlyphName(spelled) {
    if (spelled.accidental === window.App.NotesLetter.SHARP || spelled.accidental === '#') {
      return 'accidentalSharp';
    }
    if (spelled.accidental === window.App.NotesLetter.NATURAL) return 'accidentalNatural';
    if (spelled.accidental === 'b') return 'accidentalFlat';
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

    if (options.accidentalName) {
      var acc = glyph(options.accidentalName, options.x - sheet.note.rx - 9, options.y + 5.6, glyphScale());
      if (acc) {
        acc.setAttribute('class', 'accidental-glyph');
        group.appendChild(acc);
      }
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

  /** The curly brace that ties the two staves into one grand staff. */
  function drawBrace(group) {
    var data = Glyphs.brace;
    if (!data) return;
    var height = data.ne[1] - data.sw[1];
    var scale = sheet.header.braceHeight / height;
    var path = glyph('brace', sheet.header.braceX, sheet.header.braceTop + sheet.header.braceHeight, scale);
    if (path) {
      path.setAttribute('class', 'brace-glyph');
      group.appendChild(path);
    }
  }

  function drawClefs(group) {
    var scale = glyphScale();
    var gx = sheet.header.gClefX;
    var gy = sheet.staff.trebleTop + sheet.staff.space * 3; // the G4 line
    group.appendChild(glyph('gClef', gx, gy, scale));

    var fx = sheet.header.fClefX;
    var fy = sheet.staff.bassTop + sheet.staff.space * 3; // the F3 line
    group.appendChild(glyph('fClef', fx, fy, scale));
  }

  /**
   * Key signature: the sharps belonging to the key, each on its proper line/space.
   * The vertical placements follow standard engraving practice rather than a
   * calculated pattern, because that is what makes them look right.
   */
  function drawKeySignature(group, keyId, offsetX) {
    var key = window.App.NotesLetter.keySignature(keyId);
    if (!key.count) return 0;

    var scale = glyphScale();
    var x = sheet.header.sharpX + (offsetX || 0);

    key.sharps.slice(0, 3).forEach(function (letter, index) {
      var columnX = x + index * sheet.header.sharpStep;
      ['treble', 'bass'].forEach(function (clef) {
        var staffY = SHARP_STAFF_Y[clef][letter];
        if (staffY === undefined) return;
        // Each glyph is centred on its staff position using its own bounding box.
        var data = Glyphs.accidentalSharp;
        var centre = (data.ne[1] + data.sw[1]) / 2;
        group.appendChild(glyph('accidentalSharp', columnX, staffY + centre * scale, scale));
      });
    });

    return 3 * sheet.header.sharpStep;
  }

  /** Time signature set between the two staves, as engraved convention demands. */
  function drawTimeSignature(group, timeSignature, offsetX) {
    var parts = String(timeSignature).split('/');
    if (parts.length !== 2) return 0;

    var scale = glyphScale();
    var x = sheet.header.timeSigX + (offsetX || 0);
    var middle = sheet.staff.trebleTop + sheet.staff.space * 6; // halfway between the staves

    [
      { glyph: 'timeSig' + parts[0], y: middle - sheet.staff.space * 2 },
      { glyph: 'timeSig' + parts[1], y: middle + sheet.staff.space * 2 },
    ].forEach(function (item) {
      var data = Glyphs[item.glyph];
      if (!data) return;
      var centre = (data.ne[1] + data.sw[1]) / 2;
      group.appendChild(glyph(item.glyph, x, item.y + centre * scale, scale));
    });

    return 22;
  }

  /** Everything drawn once at the left edge of a system. */
  function drawSystemHeader(group, system) {
    var first = system.measures[0];
    drawBrace(group);
    drawClefs(group);

    var offset = 0;
    offset += drawKeySignature(group, first.key, offset);
    drawTimeSignature(group, first.time, offset);
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
        signatureShift += drawKeySignature(changeGroup, measure.key, -34);
      }
      if (measure.changedTime) {
        drawTimeSignature(changeGroup, measure.time, 2);
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
        accidentalName: accidentalGlyphName(spelled),
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
        accidentalName: accidentalGlyphName(spelled),
        withStem: false,
      });

      // Left-hand notes mostly sit on the bass staff, right under the treble one,
      // so the label goes wherever the note leaves room: beneath the note for the
      // low bass notes, above it once the line climbs into the gap between staves.
      var bassBounds = Staff.staffBounds('bass', sheet);
      var labelY = placed.y > bassBounds.middle
        ? placed.y + sheet.note.ry + sheet.note.labelGap + 11
        : placed.y - sheet.note.ry - sheet.note.labelGap - 5;

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
    var totalHeight = geometry.systems * geometry.musicHeight +
      Math.max(0, geometry.systems - 1) * geometry.gap +
      Config.layout.pagePaddingTop + Config.layout.pagePaddingBottom;
    geometry.totalHeight = totalHeight;
    state.layout = geometry;

    var scrollTop = container.scrollTop;
    var firstVisible = Math.floor(scrollTop / (geometry.musicHeight + geometry.gap));
    firstVisible = Math.max(0, Math.min(firstVisible, Math.max(0, geometry.systems - 1)));
    var lastVisible = Math.min(geometry.systems - 1,
      Math.floor((scrollTop + container.clientHeight) / (geometry.musicHeight + geometry.gap)) + 1);

    // Nothing to do when the same window is already on screen: ResizeObserver
    // fires on every layout change, including the ones this function causes.
    // Everything that changes what is drawn must appear in this signature.
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

    if (state.canvas && state.canvas.parentNode) state.canvas.parentNode.removeChild(state.canvas);

    state.systemElements = [];
    state.renderedFirst = firstVisible;
    state.renderedLast = lastVisible;
    state.renderedScale = geometry.scale;

    state.canvas = html('div', 'sheet-canvas');
    state.canvas.style.height = totalHeight.toFixed(1) + 'px';

    // The viewBox is the drawing's own coordinate space, unbiased: one user unit
    // is exactly `scale` CSS pixels. The score is centred by moving the SVG *box*
    // (see --system-left below), not by sliding the viewBox — keeping the two
    // mechanisms separate is what makes the placement easy to reason about.
    var viewBox = sheet.viewBox.from + ' 0 ' +
      sheet.viewBox.w.toFixed(2) + ' ' + sheet.viewBox.h.toFixed(2);
    var musicRight = sheet.staff.marginRight;

    for (var index = firstVisible; index <= lastVisible; index++) {
      var system = state.score.systems[index];
      var top = Config.layout.pagePaddingTop +
        index * (geometry.musicHeight + geometry.gap);
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

    container.appendChild(state.canvas);
    container.scrollTop = scrollTop;

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
    var stride = layout.musicHeight + layout.gap;
    var top = Config.layout.pagePaddingTop + systemIndex * stride;
    var bottom = top + layout.musicHeight;

    var viewTop = state.container.scrollTop;
    var viewBottom = viewTop + state.container.clientHeight;
    var margin = options && options.force ? 0 : 8;

    if (top >= viewTop + margin && bottom <= viewBottom - margin) return; // already visible
    state.container.scrollTop = Math.max(0, top - layout.gap / 2);
  }

  /**
   * Re-render when the sheet area is scrolled, but only when the visible window
   * actually changes — otherwise every scroll event would redraw the notation.
   */
  function onScroll(container) {
    var layout = state.layout;
    if (!layout) return;
    var stride = layout.musicHeight + layout.gap;
    var first = Math.max(0, Math.floor(container.scrollTop / stride));
    if (first !== state.renderedFirst) render(container);
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
    noteColumns: noteColumns,
    getState: function () { return state; },
  };
})();
