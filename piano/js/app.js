/**
 * Application entry point: builds the page structure, wires the controls and
 * decides when to redraw.
 *
 * Keep this file about *wiring*. Anything that draws lives in sheet-render.js or
 * keyboard-render.js; anything about pitch lives in the notation modules.
 */
window.App = window.App || {};

window.App.Main = (function () {
  'use strict';

  var Config = window.App.Config;

  var state = {
    score: null,
    notation: 'number',
    density: Config.layout.defaultDensity,
    activeMeasure: 1,
    micActive: false,
  };

  var dom = {};

  // ------------------------------------------------------------ page furniture

  /**
   * The paper texture and the pencil-edge filter.
   *
   * Both are plain SVG filters, deliberately kept identical in spirit to the
   * reference design: a bump-lit fractal noise for the coarse cold-press grain,
   * and a small displacement for the graphite-on-tooth wobble.
   */
  function buildFilterDefs() {
    var ns = 'http://www.w3.org/2000/svg';
    var root = document.getElementById('paper-layer');

    var defs = document.createElementNS(ns, 'defs');

    var paper = document.createElementNS(ns, 'filter');
    paper.setAttribute('id', 'coarse-paper');
    paper.setAttribute('x', '0%');
    paper.setAttribute('y', '0%');
    paper.setAttribute('width', '100%');
    paper.setAttribute('height', '100%');
    paper.innerHTML =
      '<feTurbulence type="fractalNoise" baseFrequency="0.045 0.05" numOctaves="5" ' +
      'seed="11" result="roughFibers" />' +
      '<feDiffuseLighting in="roughFibers" lighting-color="#fdfaf3" surfaceScale="2.6" ' +
      'diffuseConstant="0.95" result="litPaper">' +
      '<feDistantLight azimuth="130" elevation="52" /></feDiffuseLighting>';
    defs.appendChild(paper);

    var pencil = document.createElementNS(ns, 'filter');
    pencil.setAttribute('id', 'graphite-edge');
    pencil.setAttribute('x', '-10%');
    pencil.setAttribute('y', '-10%');
    pencil.setAttribute('width', '120%');
    pencil.setAttribute('height', '120%');
    pencil.innerHTML =
      '<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" result="grain" />' +
      '<feDisplacementMap in="SourceGraphic" in2="grain" scale="1.9" ' +
      'xChannelSelector="R" yChannelSelector="G" />';
    defs.appendChild(pencil);

    var ring = document.createElementNS(ns, 'filter');
    ring.setAttribute('id', 'hand-drawn-ring');
    ring.setAttribute('x', '-25%');
    ring.setAttribute('y', '-25%');
    ring.setAttribute('width', '150%');
    ring.setAttribute('height', '150%');
    ring.innerHTML =
      '<feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="7" result="wobble" />' +
      '<feDisplacementMap in="SourceGraphic" in2="wobble" scale="' +
      Config.icons.ringRoughness + '" xChannelSelector="R" yChannelSelector="G" />';
    defs.appendChild(ring);

    root.appendChild(defs);

    var rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('filter', 'url(#coarse-paper)');
    root.appendChild(rect);
  }

  // ------------------------------------------------------------------ controls

  /** The notation modules, in the order the toggle cycles them. */
  function notationModules() {
    return [window.App.NotesNumber, window.App.NotesLetter];
  }

  function activeNotation() {
    return state.notation === 'letter' ? window.App.NotesLetter : window.App.NotesNumber;
  }

  function setNotation(id) {
    state.notation = id;
    window.App.SheetRender.setNotation(activeNotation());
    updateControlState();
    redraw();
  }

  function cycleDensity() {
    var order = ['normal', 'tight', 'loose'];
    var index = order.indexOf(state.density);
    state.density = order[(index + 1) % order.length];
    window.App.SheetRender.setState({ density: state.density });
    updateControlState();
    redraw();
  }

  function resetScore() {
    state.activeMeasure = 1;
    window.App.SheetRender.setState({ activeMeasure: state.activeMeasure });
    updateControlState();
    redraw();
    window.App.SheetRender.scrollToMeasure(state.activeMeasure);
  }

  /** Reflect the current state in the buttons (active classes, labels, hints). */
  function updateControlState() {
    if (dom.btnNumber) dom.btnNumber.classList.toggle('active', state.notation === 'number');
    if (dom.btnLetter) dom.btnLetter.classList.toggle('active', state.notation === 'letter');
    if (dom.btnMic) dom.btnMic.classList.toggle('active', state.micActive);

    if (dom.btnDensity) {
      var labels = {
        normal: 'Staff spacing: normal (click for tight)',
        tight: 'Staff spacing: tight (click for loose)',
        loose: 'Staff spacing: loose (click for normal)',
      };
      dom.btnDensity.setAttribute('title', labels[state.density]);
      dom.btnDensity.setAttribute('data-density', state.density);
    }

    updateStatusText();
  }

  /**
   * The status line carries two facts: where the piece is scrolled to, and which
   * measure is being practised. The range is what replaces the scrollbar.
   */
  function updateStatusText() {
    if (!dom.progress) return;
    var total = state.score ? state.score.totalMeasures : 0;
    var text = 'Measure ' + state.activeMeasure + ' / ' + total;

    var range = window.App.SheetRender.visibleMeasureRange
      ? window.App.SheetRender.visibleMeasureRange()
      : null;
    if (range && (range.from !== 1 || range.to !== total)) {
      text = 'Measures ' + range.from + '–' + range.to + ' of ' + total +
        '   ·   practising measure ' + state.activeMeasure;
    }
    dom.progress.textContent = text;
  }

  // ------------------------------------------------------------------ rendering

  function redraw() {
    if (!state.score) return;
    window.App.SheetRender.setState({ activeMeasure: state.activeMeasure });
    window.App.SheetRender.render(dom.sheetArea, state.score);
    updateControlState();
  }

  function handleMeasureClick(measureNumber, midi) {
    state.activeMeasure = measureNumber;
    // Phase 1 has no audio yet, so a click simply moves the practice position —
    // which is exactly the "click a measure to jump there" behaviour.
    window.App.SheetRender.setState({ activeMeasure: measureNumber });
    redraw();
    window.App.SheetRender.scrollToMeasure(state.activeMeasure);
    if (window.console && console.debug) {
      console.debug('measure', measureNumber, 'note midi', midi);
    }
  }

  /** Watch the sheet area so the number of systems adapts to the window height. */
  function observeResize() {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', redraw);
      return;
    }
    var observer = new ResizeObserver(function () {
      window.requestAnimationFrame(redraw);
    });
    observer.observe(dom.sheetArea);
  }

  // ----------------------------------------------------------------------- init

  function start() {
    buildFilterDefs();

    dom.sheetArea = document.getElementById('sheet-area');
    dom.btnNumber = document.getElementById('btn-num');
    dom.btnLetter = document.getElementById('btn-let');
    dom.btnMic = document.getElementById('btn-mic');
    dom.btnReset = document.getElementById('btn-reset');
    dom.btnDensity = document.getElementById('btn-density');
    dom.progress = document.getElementById('progress-label');

    if (dom.btnNumber) dom.btnNumber.addEventListener('click', function () { setNotation('number'); });
    if (dom.btnLetter) dom.btnLetter.addEventListener('click', function () { setNotation('letter'); });
    if (dom.btnReset) dom.btnReset.addEventListener('click', resetScore);
    if (dom.btnDensity) dom.btnDensity.addEventListener('click', cycleDensity);
    if (dom.btnMic) {
      dom.btnMic.addEventListener('click', function () {
        state.micActive = !state.micActive;
        updateControlState();
      });
    }

    try {
      state.score = window.App.ScoreLoader.load();
    } catch (error) {
      showFatal(error);
      return;
    }

    renderTitle();

    window.App.SheetRender.setNotation(activeNotation());
    window.App.SheetRender.setState({ density: state.density, activeMeasure: state.activeMeasure });
    window.App.SheetRender.onMeasureClick(handleMeasureClick);

    // Clicking the paper (but not a note) also jumps to that measure.
    dom.sheetArea.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.note-group')) return;
      var measure = window.App.SheetRender.measureAtPoint(event.clientX, event.clientY);
      if (measure) handleMeasureClick(measure, null);
    });

    // Scrolling brings the neighbouring systems into the rendered window and
    // keeps the position ruler and the status line in step.
    dom.sheetArea.addEventListener('scroll', function () {
      window.App.SheetRender.onScroll(dom.sheetArea);
      updateStatusText();
    }, { passive: true });

    observeResize();
    redraw();
  }

  function renderTitle() {
    var meta = state.score.meta;
    var title = document.getElementById('song-title');
    var subtitle = document.getElementById('song-subtitle');
    if (title) title.textContent = meta.title;
    if (subtitle) {
      var tempo = meta.tempoDottedQuarter ? '♩. = ' + meta.tempoDottedQuarter : '';
      subtitle.textContent = [meta.subtitle, tempo, meta.timeSignature]
        .filter(Boolean).join(' · ');
    }
    document.title = meta.title + ' — Piano Trainer';
  }

  function showFatal(error) {
    var area = document.getElementById('sheet-area');
    if (!area) return;
    area.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fatal-error';
    box.innerHTML =
      '<h2>Cannot load the score</h2><p>' + String(error.message || error) + '</p>' +
      '<p>If you opened this file by double-clicking, try the local server instead:</p>' +
      '<pre>cd projection\\piano\npython -m http.server 8080</pre>' +
      '<p>then open <code>http://localhost:8080/</code></p>';
    area.appendChild(box);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  return {
    state: state,
    redraw: redraw,
    setNotation: setNotation,
    cycleDensity: cycleDensity,
    resetScore: resetScore,
  };
})();
