/**
 * Wiring: the score goes in, the page comes out, and the controls change things.
 *
 * Everything visual lives in the other modules; this file holds the state, calls the
 * renderers when something changes, keeps the ruler and the scroll position in step,
 * and runs the two modes:
 *
 *   Learning Mode  (microphone on)  — the measure is shaded, its keys are lit, and the
 *                                     page moves on when the notes have been played;
 *   Listening Mode (microphone off) — clicking a measure offers to play it, or to play
 *                                     from there to the end.
 *
 * Where a change can be made without redrawing — the notation switch, the measure
 * highlight, the compactness gap — it is made in place, so the sheet never flickers.
 */
window.App = window.App || {};

(function () {
  'use strict';

  const Config = window.App.Config;
  const Pitch = window.App.Pitch;
  const Loader = window.App.ScoreLoader;
  const Sheet = window.App.SheetRender;
  const Keys = window.App.KeyboardRender;
  const Ruler = window.App.Ruler;
  const Engine = window.App.AudioEngine;
  const Detect = window.App.PitchDetect;
  const Practice = window.App.Practice;
  const Playback = window.App.Playback;
  const Sound = window.App.PianoSound;

  const COMPACT_CYCLE = ['normal', 'tight', 'loose'];
  const TEST_RECORDING = 'test-music/flower_day.mp3';

  const state = {
    mode: 'number',                                    // 'number' | 'letter'
    activeMeasure: 1,
    activeMidis: new Set(),
    micActive: false,
    compact: Config.defaultCompact,                    // 'normal' | 'tight' | 'loose'
    keyboardRange: 'default',                          // 'default' | 'full'
    panelOpen: false
  };

  let score = null;
  let layout = null;
  let sheet = null;
  const dom = {};
  let scrollQueued = false;
  let judgeFrame = null;
  let frameCount = 0;
  let menuMeasure = null;
  let highlightTimer = null;

  // ---------------------------------------------------------------- start up

  function init() {
    ['sheet-area', 'sheet-canvas', 'piano-frame', 'ruler-layer', 'progress', 'song-title',
      'song-subtitle', 'song-meta', 'btn-num', 'btn-let', 'btn-compact', 'btn-keys-default',
      'btn-keys-full', 'btn-mic', 'btn-reset', 'btn-play', 'btn-stop', 'btn-panel',
      'measure-menu', 'menu-here', 'menu-onward', 'diag', 'diag-source', 'diag-target',
      'diag-heard', 'diag-notes', 'diag-chroma', 'btn-test', 'test-seek'
    ].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });

    const raw = window[Config.scoreGlobal];
    if (!raw) return;

    score = Loader.load(raw);
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
    buildChromaBars();
    Ruler.mount(dom['ruler-layer']);
    setCompact(state.compact);
    renderAll();
    bindControls();
    bindScroll();
    window.addEventListener('resize', onResize);
  }

  function renderHeader() {
    const meta = score.meta;
    dom['song-title'].textContent = meta.title || '';
    dom['song-subtitle'].textContent = meta.subtitle || '';
    dom['song-meta'].textContent = [
      meta.tempoDottedQuarter ? '♩. = ' + meta.tempoDottedQuarter : '',
      meta.timeSignature || ''
    ].filter(Boolean).join(' • ');
  }

  /** Draw everything from scratch. Only needed when the score or a range changes. */
  function renderAll() {
    sheet = Sheet.renderSheet(dom['sheet-canvas'], layout, state);
    Keys.renderKeyboard(dom['piano-frame'], state);
    layoutRuler();
    updateProgress();
    updateRangeButtons();
    updateTransport();
  }

  // ---------------------------------------------------------------- controls

  function bindControls() {
    dom['btn-num'].addEventListener('click', function () { setMode('number'); });
    dom['btn-let'].addEventListener('click', function () { setMode('letter'); });
    dom['btn-compact'].addEventListener('click', function () {
      setCompact(COMPACT_CYCLE[(COMPACT_CYCLE.indexOf(state.compact) + 1) % COMPACT_CYCLE.length]);
    });
    dom['btn-keys-default'].addEventListener('click', function () { setKeyboardRange('default'); });
    dom['btn-keys-full'].addEventListener('click', function () { setKeyboardRange('full'); });

    dom['btn-mic'].addEventListener('click', function () { toggleMicrophone(); });
    dom['btn-reset'].addEventListener('click', function () { resetScore(); });
    dom['btn-play'].addEventListener('click', function () { toggleTransport(); });
    dom['btn-stop'].addEventListener('click', function () { stopEverything(); });
    dom['btn-panel'].addEventListener('click', function () { setPanel(!state.panelOpen); });

    dom['btn-test'].addEventListener('click', function () { toggleTestRecording(); });
    dom['test-seek'].addEventListener('input', function () {
      const element = Engine.testElement();
      if (element && element.duration) element.currentTime = element.duration * (dom['test-seek'].value / 1000);
    });

    dom['menu-here'].addEventListener('click', function () { startPlayback(menuMeasure, false); closeMenu(); });
    dom['menu-onward'].addEventListener('click', function () { startPlayback(menuMeasure, true); closeMenu(); });

    document.addEventListener('click', function (event) {
      if (!dom['measure-menu'].hidden && !dom['measure-menu'].contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeMenu(); setPanel(false); }
    });
  }

  function setMode(mode) {
    state.mode = mode;
    dom['btn-num'].classList.toggle('active', mode === 'number');
    dom['btn-let'].classList.toggle('active', mode === 'letter');
    // Only the writing changes, so the sheet is not redrawn.
    Sheet.applyMode(dom['sheet-canvas'], mode);
    Keys.applyMode(dom['piano-frame'], mode);
  }

  function setCompact(compact) {
    state.compact = compact;
    dom['sheet-canvas'].style.setProperty('--system-gap', Config.systemGapPx[compact] + 'px');
    dom['btn-compact'].dataset.setting = compact;
    dom['btn-compact'].title = 'Spacing between systems: ' + compact;
    layoutRuler();
  }

  function setKeyboardRange(range) {
    state.keyboardRange = range;
    Keys.renderKeyboard(dom['piano-frame'], state);
    Keys.applyMode(dom['piano-frame'], state.mode);
    updateRangeButtons();
  }

  function updateRangeButtons() {
    dom['btn-keys-default'].classList.toggle('active', state.keyboardRange === 'default');
    dom['btn-keys-full'].classList.toggle('active', state.keyboardRange === 'full');
  }

  function setPanel(open) {
    state.panelOpen = open;
    dom['diag'].hidden = !open;
    dom['btn-panel'].classList.toggle('active', open);
  }

  function resetScore() {
    stopEverything();
    setActiveMeasure(1, Loader.targetMidis(layout.byNumber[1]));
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
    Keys.applyActive(dom['piano-frame'], state.activeMidis);
    updateProgress();
  }

  function updateProgress() {
    dom.progress.textContent = 'Measure ' + state.activeMeasure + ' / ' + (score ? score.measures.length : 0);
  }

  /** Clicking a measure: jump there to practise, or offer to play it. */
  window.App.onMeasureClick = function (measureNumber, event) {
    if (state.micActive) {
      stopPlayback();
      Practice.goTo(measureNumber);
      setActiveMeasure(measureNumber, Loader.targetMidis(layout.byNumber[measureNumber]));
      jumpToMeasure(measureNumber);
      return;
    }
    openMenu(measureNumber, event);
  };

  window.App.onNoteClick = function (measureNumber, midi) {
    setActiveMeasure(measureNumber, Loader.targetMidis(layout.byNumber[measureNumber]));
    if (state.micActive) Practice.goTo(measureNumber);
    playNote(midi);
  };

  window.App.onKeyClick = function (midi) {
    state.activeMidis = new Set([midi]);
    Keys.applyActive(dom['piano-frame'], state.activeMidis);
    playNote(midi);
  };

  // ---------------------------------------------------------------- the measure menu

  function openMenu(measureNumber, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    menuMeasure = measureNumber;
    dom['measure-menu'].hidden = false;
    dom['measure-menu'].querySelector('.menu-title').textContent = 'Measure ' + measureNumber;

    const point = event || { clientX: 200, clientY: 200 };
    const width = 210;
    const height = 108;
    dom['measure-menu'].style.left = Math.max(8, Math.min(point.clientX, window.innerWidth - width - 8)) + 'px';
    dom['measure-menu'].style.top = Math.max(8, Math.min(point.clientY, window.innerHeight - height - 8)) + 'px';
  }

  function closeMenu() {
    dom['measure-menu'].hidden = true;
    menuMeasure = null;
  }

  // ---------------------------------------------------------------- listening

  function startPlayback(from, toEnd) {
    if (!from) return;
    stopLearning();
    const context = Engine.ensure();
    const total = score.measures.length;

    Sound.preload(context, Loader.targetMidis(layout.byNumber[from]));

    Playback.play({
      context: context,
      destination: context.destination,
      total: total,
      measure: from,
      toEnd: toEnd,
      measureAt: function (number) { return layout.byNumber[number]; },
      onMeasure: function (number, at) {
        // Move the highlight in step with the sound, not before it.
        const delay = Math.max(0, (at - context.currentTime) * 1000);
        clearTimeout(highlightTimer);
        highlightTimer = setTimeout(function () {
          setActiveMeasure(number, Loader.targetMidis(layout.byNumber[number]));
          jumpToMeasure(number);
          Sound.preload(context, Loader.targetMidis(layout.byNumber[number + 1] || layout.byNumber[number]));
        }, delay);
      },
      onFinish: function () { updateTransport(); }
    });
    updateTransport();
  }

  function toggleTransport() {
    if (Playback.isPlaying()) Playback.pause();
    else if (Playback.isPaused()) Playback.resume();
    else startPlayback(state.activeMeasure, true);
    updateTransport();
  }

  function stopPlayback() {
    clearTimeout(highlightTimer);
    Playback.stop();
    updateTransport();
  }

  function updateTransport() {
    const playing = Playback.isPlaying();
    dom['btn-play'].classList.toggle('active', playing);
    dom['btn-play'].title = playing ? 'Pause' : 'Play from this measure to the end';
    dom['btn-play'].setAttribute('aria-label', playing ? 'Pause' : 'Play');
    dom['btn-play'].querySelector('.icon-play').style.display = playing ? 'none' : '';
    dom['btn-play'].querySelector('.icon-pause').style.display = playing ? '' : 'none';
  }

  // ---------------------------------------------------------------- learning

  function toggleMicrophone() {
    if (state.micActive) stopLearning();
    else startLearning();
  }

  function startLearning() {
    stopPlayback();
    Engine.startMicrophone().then(function (started) {
      state.micActive = started;
      dom['btn-mic'].classList.toggle('mic-active', started);
      dom['btn-mic'].setAttribute('aria-pressed', String(started));

      if (!started) {
        showMessage(Engine.lastMessage());
        return;
      }
      closeMenu();
      setPanel(true);
      Practice.start(state.activeMeasure, score.measures.length);
      startJudging();
    });
  }

  function stopLearning() {
    if (!state.micActive && !judgeFrame) return;
    state.micActive = false;
    dom['btn-mic'].classList.remove('mic-active');
    dom['btn-mic'].setAttribute('aria-pressed', 'false');
    Engine.stopMicrophone();
    Practice.stop();
    stopJudging();
  }

  /** Playback of the test recording counts as listening too: same loop, same judging. */
  function startJudging() {
    if (judgeFrame) return;
    frameCount = 0;
    judgeFrame = window.requestAnimationFrame(judge);
  }

  function stopJudging() {
    if (judgeFrame) window.cancelAnimationFrame(judgeFrame);
    judgeFrame = null;
  }

  function judge() {
    judgeFrame = window.requestAnimationFrame(judge);

    const spectrum = Engine.read();
    if (!spectrum) return;

    const detection = Detect.analyse(spectrum.decibels, spectrum.binHz);
    const measure = layout.byNumber[state.activeMeasure];
    if (!measure) return;

    const status = Practice.tick(detection.chroma, Loader.targetPitchClasses(measure));

    if (status && status.advanced) {
      if (status.finished) {
        Practice.stop();
        stopLearning();
        Engine.pauseTestAudio();
        updateTestButton();
        showMessage('That is the whole piece — all 64 measures.');
        return;
      }
      const next = status.measure;
      setActiveMeasure(next, Loader.targetMidis(layout.byNumber[next]));
      jumpToMeasure(next);
    }

    // The readout does not need sixty updates a second.
    frameCount++;
    if (state.panelOpen && frameCount % 4 === 0) updateDiagnostics(detection, status);
  }

  // ---------------------------------------------------------------- test recording

  function toggleTestRecording() {
    stopPlayback();
    const element = Engine.useTestAudio(TEST_RECORDING);

    if (element.paused) {
      Engine.playTestAudio().then(function (started) {
        updateTestButton();
        if (!started) { showMessage(Engine.lastMessage()); return; }
        setPanel(true);
        Practice.start(state.activeMeasure, score.measures.length);
        startJudging();
        bindTestProgress();
      });
    } else {
      Engine.pauseTestAudio();
      updateTestButton();
    }
  }

  function bindTestProgress() {
    const element = Engine.testElement();
    if (!element || element.dataset.bound) return;
    element.dataset.bound = '1';
    element.addEventListener('timeupdate', function () {
      if (!element.duration) return;
      dom['test-seek'].value = Math.round((element.currentTime / element.duration) * 1000);
    });
    element.addEventListener('ended', function () {
      updateTestButton();
      Practice.stop();
      stopJudging();
    });
  }

  function updateTestButton() {
    const element = Engine.testElement();
    const playing = element && !element.paused;
    dom['btn-test'].textContent = playing ? 'Pause the test recording' : 'Play the test recording';
    dom['btn-test'].classList.toggle('active', !!playing);
  }

  // ---------------------------------------------------------------- diagnostics

  function buildChromaBars() {
    dom['diag-chroma'].textContent = '';
    for (let i = 0; i < 12; i++) {
      const column = document.createElement('div');
      column.className = 'chroma-column';
      const bar = document.createElement('div');
      bar.className = 'chroma-bar';
      const label = document.createElement('span');
      label.textContent = Pitch.SHARP_NAMES[i];
      column.appendChild(bar);
      column.appendChild(label);
      dom['diag-chroma'].appendChild(column);
    }
  }

  function updateDiagnostics(detection, status) {
    const bars = dom['diag-chroma'].querySelectorAll('.chroma-bar');
    for (let i = 0; i < 12 && i < bars.length; i++) {
      bars[i].style.height = Math.round(detection.chroma[i] * 100) + '%';
    }

    const source = Engine.currentMode();
    dom['diag-source'].textContent = source === 'microphone' ? 'Listening to the microphone'
      : source === 'test' ? 'Listening to the test recording'
        : 'Not listening — press the microphone';

    const measure = layout.byNumber[state.activeMeasure];
    const wanted = Loader.targetMidis(measure).map(Pitch.letterName).join(' ');
    dom['diag-target'].textContent = 'Measure ' + measure.m + ' needs ' + wanted;

    dom['diag-notes'].textContent = 'heard: ' + (Detect.describeNotes(detection.notes).join(' ') || '—');

    if (status) {
      const missing = status.missing.map(function (pc) { return Pitch.SHARP_NAMES[pc]; });
      dom['diag-heard'].textContent = status.waiting ? 'get ready…'
        : status.complete ? 'all notes heard'
          : Math.round(status.score * 100) + '% — still missing ' + (missing.join(' ') || '—');
    }
  }

  function showMessage(text) {
    if (!text) return;
    setPanel(true);
    dom['diag-source'].textContent = text;
  }

  // ---------------------------------------------------------------- scrolling

  function bindScroll() {
    dom['sheet-area'].addEventListener('scroll', function () {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(function () {
        scrollQueued = false;
        updateRulerViewport();
      });
    });
  }

  function layoutRuler() {
    if (!dom['ruler-layer'] || !sheet) return;
    const offsets = layout.systems.map(function (system) {
      return offsetInScroll(sheet.systems[system.index]);
    });
    Ruler.layout(offsets, dom['sheet-area'].scrollHeight, dom['sheet-area'].clientHeight);
    updateRulerViewport();
  }

  /** How far an element sits below the top of the scrolling content. */
  function offsetInScroll(element) {
    const area = dom['sheet-area'].getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return box.top - area.top + dom['sheet-area'].scrollTop;
  }

  function updateRulerViewport() {
    Ruler.updateViewport(dom['sheet-area'].scrollTop, dom['sheet-area'].clientHeight);
  }

  /** Called by the ruler when it is pressed or dragged. */
  window.App.scrollToRatio = function (ratio) {
    dom['sheet-area'].scrollTop = Ruler.scrollTopForRatio(ratio, dom['sheet-area'].clientHeight);
  };

  function jumpToMeasure(number) {
    const element = sheet.systems[Math.floor((number - 1) / Config.layout.measuresPerSystem)];
    if (!element) return;
    const offset = offsetInScroll(element);
    const top = dom['sheet-area'].scrollTop;
    const bottom = top + dom['sheet-area'].clientHeight;
    // Only move when it is not already in view, so practising does not jerk the page.
    if (offset < top + 8 || offset + element.offsetHeight > bottom) {
      dom['sheet-area'].scrollTop = Math.max(0, offset - 12);
    }
  }

  function onResize() {
    layoutRuler();
    updateRulerViewport();
  }

  /** Everything off: the microphone, the playback and the test recording. */
  function stopEverything() {
    stopLearning();
    stopPlayback();
    Engine.pauseTestAudio();
    updateTestButton();
  }

  // ---------------------------------------------------------------- sound

  /** One note, from the recordings when they are available. */
  function playNote(midi) {
    if (!Pitch.isValidMidi(midi)) return;
    const context = Engine.ensure();
    Sound.play(context, context.destination, midi, context.currentTime + 0.01, 1.1, 0.7);
  }

  window.App.state = state;
  window.App.score = function () { return score; };
  window.App.layoutOf = function () { return layout; };
  window.App.setActiveMeasure = setActiveMeasure;
  window.App.playNote = playNote;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
