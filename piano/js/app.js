/**
 * Wiring: the score goes in, the page comes out, and the controls change things.
 *
 * Everything visual lives in the other modules; this file only holds the state, calls
 * the renderers when something changes, and keeps the ruler and the scroll position in
 * step. Where a change can be made without redrawing (the notation switch, the measure
 * highlight, the compactness gap) it is made in place, so the sheet never flickers.
 */
window.App = window.App || {};

(function () {
  'use strict';

  const Config = window.App.Config;

  const state = {
    mode: 'number',                                    // 'number' | 'letter'
    activeMeasure: 1,
    activeMidis: new Set(),
    micActive: false,
    compact: Config.defaultCompact,                    // 'normal' | 'tight' | 'loose'
    keyboardRange: 'default'                           // 'default' | 'full'
  };

  const COMPACT_CYCLE = ['normal', 'tight', 'loose'];

  let score = null;
  let layout = null;
  let sheet = null;
  const dom = {};
  let audioCtx = null;
  let scrollQueued = false;

  // ---------------------------------------------------------------- start up

  function init() {
    dom.sheetArea = document.getElementById('sheet-area');
    dom.sheetCanvas = document.getElementById('sheet-canvas');
    dom.pianoFrame = document.getElementById('piano-frame');
    dom.rulerLayer = document.getElementById('ruler-layer');
    dom.progress = document.getElementById('progress');
    dom.title = document.getElementById('song-title');
    dom.subtitle = document.getElementById('song-subtitle');
    dom.meta = document.getElementById('song-meta');

    const raw = window[Config.scoreGlobal];
    if (!raw) {
      document.body.appendChild(document.createTextNode('The score did not load.'));
      return;
    }

    score = window.App.ScoreLoader.load(raw);
    layout = window.App.Layout.build(score);

    if (score.warnings.length) {
      console.warn('Score problems that could not be settled:');
      score.warnings.forEach(function (warning) { console.warn('  ' + warning); });
    }
    if (score.quirks.length) {
      console.info('Faults in the score file that were settled from the file itself:');
      score.quirks.forEach(function (quirk) { console.info('  ' + quirk); });
    }

    renderHeader();
    window.App.Ruler.mount(dom.rulerLayer);
    setCompact(state.compact);
    renderAll();
    bindControls();
    bindScroll();
    window.addEventListener('resize', onResize);
  }

  function renderHeader() {
    const meta = score.meta;
    dom.title.textContent = meta.title || '';
    dom.subtitle.textContent = meta.subtitle || '';
    const tempo = meta.tempoDottedQuarter ? '♩. = ' + meta.tempoDottedQuarter : '';
    const time = meta.timeSignature || '';
    dom.meta.textContent = [tempo, time].filter(Boolean).join(' • ');
  }

  /** Draw everything from scratch. Only needed when the score or a range changes. */
  function renderAll() {
    sheet = window.App.SheetRender.renderSheet(dom.sheetCanvas, layout, state);
    window.App.KeyboardRender.renderKeyboard(dom.pianoFrame, state);
    layoutRuler();
    updateProgress();
    updateRangeButtons();
  }

  // ---------------------------------------------------------------- controls

  function bindControls() {
    document.getElementById('btn-num').addEventListener('click', function () { setMode('number'); });
    document.getElementById('btn-let').addEventListener('click', function () { setMode('letter'); });

    document.getElementById('btn-compact').addEventListener('click', function () {
      const next = COMPACT_CYCLE[(COMPACT_CYCLE.indexOf(state.compact) + 1) % COMPACT_CYCLE.length];
      setCompact(next);
    });

    document.getElementById('btn-keys-default').addEventListener('click', function () { setKeyboardRange('default'); });
    document.getElementById('btn-keys-full').addEventListener('click', function () { setKeyboardRange('full'); });

    document.getElementById('btn-mic').addEventListener('click', function () { toggleMic(); });
    document.getElementById('btn-reset').addEventListener('click', function () { resetScore(); });
  }

  function setMode(mode) {
    state.mode = mode;
    document.getElementById('btn-num').classList.toggle('active', mode === 'number');
    document.getElementById('btn-let').classList.toggle('active', mode === 'letter');
    // Only the writing changes, so the sheet is not redrawn.
    window.App.SheetRender.applyMode(dom.sheetCanvas, mode);
    window.App.KeyboardRender.applyMode(dom.pianoFrame, mode);
  }

  function setCompact(compact) {
    state.compact = compact;
    dom.sheetCanvas.style.setProperty('--system-gap', Config.systemGapPx[compact] + 'px');
    document.getElementById('btn-compact').dataset.setting = compact;
    document.getElementById('btn-compact').title = 'Spacing between systems: ' + compact;
    layoutRuler();
  }

  function setKeyboardRange(range) {
    state.keyboardRange = range;
    window.App.KeyboardRender.renderKeyboard(dom.pianoFrame, state);
    window.App.KeyboardRender.applyMode(dom.pianoFrame, state.mode);
    updateRangeButtons();
  }

  function updateRangeButtons() {
    document.getElementById('btn-keys-default').classList.toggle('active', state.keyboardRange === 'default');
    document.getElementById('btn-keys-full').classList.toggle('active', state.keyboardRange === 'full');
  }

  function toggleMic() {
    state.micActive = !state.micActive;
    document.getElementById('btn-mic').classList.toggle('mic-active', state.micActive);
    document.getElementById('btn-mic').setAttribute('aria-pressed', String(state.micActive));
    // The microphone itself arrives with the listener in phase 3.
  }

  function resetScore() {
    setActiveMeasure(1, window.App.ScoreLoader.targetMidis(layout.byNumber[1]));
    jumpToMeasure(1);
  }

  // ---------------------------------------------------------------- selecting

  /** The measure being practised: one graphite smudge, and its keys lit. */
  function setActiveMeasure(number, midis) {
    state.activeMeasure = number;
    state.activeMidis = new Set(midis || []);

    if (sheet && sheet.highlights) {
      Object.keys(sheet.highlights).forEach(function (key) {
        sheet.highlights[key].style.display = Number(key) === number ? '' : 'none';
      });
    }
    window.App.KeyboardRender.applyActive(dom.pianoFrame, state.activeMidis);
    updateProgress();
  }

  function updateProgress() {
    const total = score ? score.measures.length : 0;
    dom.progress.textContent = 'Measure ' + state.activeMeasure + ' / ' + total;
  }

  window.App.onNoteClick = function (measureNumber, midi) {
    const measure = layout.byNumber[measureNumber];
    setActiveMeasure(measureNumber, window.App.ScoreLoader.targetMidis(measure));
    playNote(midi);
  };

  window.App.onKeyClick = function (midi) {
    state.activeMidis = new Set([midi]);
    window.App.KeyboardRender.applyActive(dom.pianoFrame, state.activeMidis);
    playNote(midi);
  };

  // ---------------------------------------------------------------- scrolling

  function bindScroll() {
    dom.sheetArea.addEventListener('scroll', function () {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(function () {
        scrollQueued = false;
        updateRulerViewport();
      });
    });
  }

  function layoutRuler() {
    if (!dom.rulerLayer || !sheet) return;
    const offsets = layout.systems.map(function (system) {
      const element = sheet.systems[system.index];
      return offsetInScroll(element);
    });
    window.App.Ruler.layout(offsets, dom.sheetArea.scrollHeight, dom.sheetArea.clientHeight);
    updateRulerViewport();
  }

  /** How far an element sits below the top of the scrolling content. */
  function offsetInScroll(element) {
    const area = dom.sheetArea.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return box.top - area.top + dom.sheetArea.scrollTop;
  }

  function updateRulerViewport() {
    window.App.Ruler.updateViewport(dom.sheetArea.scrollTop, dom.sheetArea.clientHeight);
  }

  /** Called by the ruler when it is pressed or dragged. */
  window.App.scrollToRatio = function (ratio) {
    const top = window.App.Ruler.scrollTopForRatio(ratio, dom.sheetArea.clientHeight);
    dom.sheetArea.scrollTop = top;
  };

  function jumpToMeasure(number) {
    const element = sheet.systems[Math.floor((number - 1) / Config.layout.measuresPerSystem)];
    if (!element) return;
    const offset = offsetInScroll(element);
    // Only move when it is not already in view, so practising does not jerk the page.
    const top = dom.sheetArea.scrollTop;
    const bottom = top + dom.sheetArea.clientHeight;
    if (offset < top + 8 || offset + element.offsetHeight > bottom) {
      dom.sheetArea.scrollTop = Math.max(0, offset - 12);
    }
  }

  function onResize() {
    layoutRuler();
    updateRulerViewport();
  }

  // ---------------------------------------------------------------- sound
  // A plain tone for now; the recorded piano samples arrive with the audio engine.

  function playNote(midi) {
    if (!window.App.Pitch.isValidMidi(midi)) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = window.App.Pitch.frequency(midi);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.7);
  }

  window.App.state = state;
  window.App.score = function () { return score; };
  window.App.layoutOf = function () { return layout; };
  window.App.setActiveMeasure = setActiveMeasure;
  window.App.playNote = playNote;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
