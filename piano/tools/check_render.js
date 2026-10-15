#!/usr/bin/env node
/**
 * Drive the whole page without a browser.
 *
 * There is no DOM here, so this file brings a very small one — enough elements,
 * attributes, events, an AudioContext and an AnalyserNode for everything to run
 * exactly as it does in the page. It then does what a person would: switch notation,
 * change the spacing, swap the keyboard range, click notes and measures, play the
 * score back, turn the microphone on and play measure 1 correctly to watch the page
 * move on by itself.
 *
 * The microphone is fed a synthesised spectrum, so the listening path — spectrum,
 * detection, judging, advancing — is exercised end to end rather than mocked.
 *
 * Usage:  node tools/check_render.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { synthSpectrum } = require('./check_detect.js');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = [
  'music-sheet/flower-day.js',
  'js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js',
  'js/score-loader.js', 'js/layout.js', 'js/sheet-render.js', 'js/keyboard-render.js',
  'js/ruler.js', 'js/pitch-detect.js', 'js/piano-sound.js', 'js/audio-engine.js',
  'js/practice.js', 'js/playback.js', 'js/app.js'
];

// ---------------------------------------------------------------- tiny DOM

class ClassList {
  constructor() { this.set = new Set(); }
  add(...names) { names.forEach((name) => this.set.add(name)); }
  remove(...names) { names.forEach((name) => this.set.delete(name)); }
  contains(name) { return this.set.has(name); }
  toggle(name, on) {
    const want = on === undefined ? !this.set.has(name) : !!on;
    if (want) this.set.add(name); else this.set.delete(name);
    return want;
  }
}

class Element {
  constructor(name) {
    this.nodeName = name;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.classes = new ClassList();
    this.listeners = {};
    this.parentNode = null;
    this.text = '';
    this.hidden = false;
    this.value = '0';
    this.width = 68;
    this.height = 240;
    const style = { setProperty(key, value) { style[key] = value; }, removeProperty() {} };
    this.style = style;
  }
  // Writing textContent replaces everything inside, as it does in a browser.
  get textContent() { return this.text; }
  set textContent(value) { this.children = []; this.text = String(value); }
  get classList() { return this.classes; }
  get className() { return Array.from(this.classes.set).join(' '); }
  set className(value) { this.classes.set = new Set(String(value).split(/\s+/).filter(Boolean)); }
  setAttribute(key, value) { if (key === 'class') this.className = value; else this.attributes[key] = String(value); }
  getAttribute(key) { return key === 'class' ? this.className : this.attributes[key]; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    return child;
  }
  addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
  dispatch(name, event) {
    const details = Object.assign({ target: this, stopPropagation() {}, preventDefault() {} }, event);
    (this.listeners[name] || []).forEach((fn) => fn(details));
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains && child.contains(node));
  }
  get firstChild() { return this.children[0] || null; }
  get clientHeight() { return 620; }
  get offsetHeight() { return 235; }
  get scrollHeight() { return 4200; }
  get scrollTop() { return this.top || 0; }
  set scrollTop(value) { this.top = value; }
  getBoundingClientRect() { return { top: this.top || 0, left: 0, width: 1200, height: 235, right: 1200, bottom: 235 }; }
  getContext() {
    const noop = () => {};
    return {
      lineCap: '', strokeStyle: '', lineWidth: 0, fillStyle: '', globalCompositeOperation: '',
      beginPath: noop, moveTo: noop, bezierCurveTo: noop, lineTo: noop, stroke: noop,
      arc: noop, fill: noop, strokeRect: noop
    };
  }
  toDataURL() { return 'data:image/png;base64,stub'; }

  /** Only the two selectors the page uses: "[data-x]" and ".some-class". */
  querySelectorAll(selector) {
    const attribute = selector.startsWith('[') ? selector.replace(/[[\]]/g, '').replace(/^data-/, '') : null;
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    const found = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (attribute && child.dataset && Object.prototype.hasOwnProperty.call(child.dataset, attribute)) found.push(child);
        else if (className && child.classList && child.classList.contains(className)) found.push(child);
        walk(child);
      });
    };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const IDS = ['sheet-area', 'sheet-canvas', 'piano-frame', 'ruler-layer', 'progress',
  'song-title', 'song-subtitle', 'song-meta', 'btn-num', 'btn-let', 'btn-compact',
  'btn-keys-default', 'btn-keys-full', 'btn-mic', 'btn-reset', 'btn-play', 'btn-stop',
  'btn-panel', 'measure-menu', 'menu-here', 'menu-onward', 'diag', 'diag-source',
  'diag-target', 'diag-heard', 'diag-notes', 'diag-chroma', 'btn-test', 'test-seek'];

const byId = {};
IDS.forEach((id) => { byId[id] = new Element('div'); });
// The same inner markup index.html gives these two, so the page finds what it expects.
const playingIcon = new Element('svg');
playingIcon.className = 'icon-play';
const pausedIcon = new Element('svg');
pausedIcon.className = 'icon-pause';
byId['btn-play'].appendChild(playingIcon);
byId['btn-play'].appendChild(pausedIcon);

const menuTitle = new Element('span');
menuTitle.className = 'menu-title';
byId['measure-menu'].appendChild(menuTitle);
byId['menu-here'].textContent = 'Play just this measure';
byId['menu-onward'].textContent = 'Play from here to the end';

const documentStub = {
  readyState: 'complete',
  body: new Element('body'),
  createElement: (name) => new Element(name),
  createElementNS: (ns, name) => new Element(name),
  getElementById: (id) => byId[id] || null,
  addEventListener: () => {}
};

// ------------------------------------------------------- tiny audio stack

class FakeAnalyser {
  constructor() { this.fftSize = 4096; this.smoothingTimeConstant = 0.4; this.spectrum = null; }
  get frequencyBinCount() { return this.fftSize / 2; }
  connect() {}
  disconnect() {}
  getFloatFrequencyData(array) {
    if (this.spectrum) array.set(this.spectrum.subarray(0, Math.min(array.length, this.spectrum.length)));
    else array.fill(-140);
  }
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.state = 'running';
    this.currentTime = 0;
    this.destination = { name: 'destination' };
    this.oscillatorsStarted = 0;
    this.analyser = null;
  }
  resume() {}
  createAnalyser() { this.analyser = new FakeAnalyser(); return this.analyser; }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {}
    };
  }
  createOscillator() {
    const self = this;
    return { type: '', frequency: { value: 0 }, connect() {}, start() { self.oscillatorsStarted++; }, stop() {} };
  }
  createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createMediaElementSource() { return { connect() {}, disconnect() {} }; }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
}

class FakeAudioElement {
  constructor() {
    this.src = '';
    this.paused = true;
    this.currentTime = 0;
    this.duration = 100;
    this.dataset = {};
    this.listeners = {};
  }
  addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

// ---------------------------------------------------------------- run it

let clock = 0;                       // milliseconds, advanced by hand
let frameQueue = [];
const audioContexts = [];

const sandbox = {
  console: console,
  document: documentStub,
  AudioContext: function () { const context = new FakeAudioContext(); audioContexts.push(context); return context; },
  Audio: FakeAudioElement,
  performance: { now: () => clock },
  requestAnimationFrame: (fn) => { frameQueue.push(fn); return frameQueue.length; },
  cancelAnimationFrame: () => { frameQueue = []; },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  fetch: () => Promise.reject(new Error('no files here')),   // as if opened from disk
  navigator: {
    mediaDevices: {
      getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] })
    }
  },
  location: { protocol: 'http:' }
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

/** Run the page's animation frames, moving the clock on as real frames would. */
function pumpFrames(count, stepMs) {
  for (let i = 0; i < count; i++) {
    clock += stepMs || 50;
    const queue = frameQueue;
    frameQueue = [];
    queue.forEach((fn) => fn());
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function count(node, name) {
  let total = node.nodeName === name ? 1 : 0;
  node.children.forEach((child) => { total += count(child, name); });
  return total;
}

function countClass(node, className) {
  let total = node.classList && node.classList.contains(className) ? 1 : 0;
  node.children.forEach((child) => { total += countClass(child, className); });
  return total;
}

function report(label, value) { console.log('  ' + label.padEnd(36) + value); }

async function main() {
  SCRIPTS.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  });

  const App = sandbox.App;
  const canvas = byId['sheet-canvas'];
  const frame = byId['piano-frame'];
  const ruler = byId['ruler-layer'];
  const menu = byId['measure-menu'];

  console.log('the score, drawn');
  report('systems', canvas.children.length);
  report('staff lines (10 a system)', countClass(canvas, 'staff-line') - countClass(canvas, 'ledger-line'));
  report('ledger strokes', countClass(canvas, 'ledger-line'));
  report('barlines (5 a system)', countClass(canvas, 'bar-line'));
  report('beams', countClass(canvas, 'note-beam'));
  report('key-signature sharps', countClass(canvas, 'key-sharp'));
  report('clefs', countClass(canvas, 'clef'));
  report('measure smudges', count(canvas, 'rect') - countClass(canvas, 'measure-hit'));
  report('click targets', countClass(canvas, 'measure-hit'));
  report('noteheads (melody + bass)', count(canvas, 'ellipse'));
  report('handwritten labels', canvas.querySelectorAll('[data-num]').length);

  console.log('');
  console.log('the keyboard');
  report('keys in the default range', frame.children.length);
  report('white keys', frame.children.filter((k) => k.classList.contains('white-key')).length);
  report('black keys', frame.children.filter((k) => k.classList.contains('black-key')).length);
  report('labels use 123', JSON.stringify(frame.children[0].children[0].textContent));
  report('black key label', JSON.stringify(frame.children.find((k) => k.classList.contains('black-key')).children[0].textContent));

  console.log('');
  console.log('the controls');
  byId['btn-let'].dispatch('click');
  report('after ABC, melody label', JSON.stringify(canvas.querySelectorAll('[data-num]')[0].textContent));
  byId['btn-num'].dispatch('click');

  byId['btn-compact'].dispatch('click');
  report('spacing after one press', byId['btn-compact'].dataset.setting + ' -> ' + canvas.style['--system-gap']);
  byId['btn-compact'].dispatch('click');
  report('spacing after two presses', byId['btn-compact'].dataset.setting + ' -> ' + canvas.style['--system-gap']);
  byId['btn-compact'].dispatch('click');

  byId['btn-keys-full'].dispatch('click');
  report('88-key view, keys', frame.children.length);
  report('88-key view, first / last', JSON.stringify(frame.children[0].children[0].textContent) + ' … ' +
    JSON.stringify(frame.children[frame.children.length - 1].children[0].textContent));
  byId['btn-keys-default'].dispatch('click');
  report('back to the default range', frame.children.length + ' keys');

  console.log('');
  console.log('the ruler');
  const rulerSvg = ruler.children[0];
  App.scrollToRatio(0.5);
  report('dragging it scrolls to', Math.round(byId['sheet-area'].scrollTop));
  report('ticks', countClass(rulerSvg, 'ruler-tick-major') + ' major, ' + countClass(rulerSvg, 'ruler-tick-minor') + ' minor');

  console.log('');
  console.log('listening mode — the microphone is off');
  App.onMeasureClick(3, { clientX: 300, clientY: 300 });
  report('clicking a measure opens', menu.hidden ? 'nothing' : 'the measure menu');
  report('and offers', JSON.stringify(byId['menu-here'].textContent) + ' / ' + JSON.stringify(byId['menu-onward'].textContent));
  byId['menu-onward'].dispatch('click');
  report('playing from it to the end', App.Playback.isPlaying() ? 'started' : 'did not start');
  report('the transport switched to', byId['btn-play'].querySelector('.icon-pause').style.display === '' ? 'pause' : 'play');
  byId['btn-stop'].dispatch('click');
  report('stop leaves it', App.Playback.isPlaying() ? 'still playing' : 'stopped');
  report('menu closed again', menu.hidden ? 'yes' : 'no');

  console.log('');
  console.log('learning mode — the microphone is on');
  byId['btn-mic'].dispatch('click');
  await settle();
  report('microphone button', byId['btn-mic'].classList.contains('mic-active') ? 'live' : 'off');
  report('listening panel opened', byId['diag'].hidden ? 'no' : 'yes');
  report('judging starts at', 'measure ' + App.state.activeMeasure);

  // Feed the analyser what measure 1 asks for: B4 A4 over E3/B2.
  const spectrum = synthSpectrum([71, 69, 52, 47], { fftSize: App.Config.audio.fftSize });
  audioContexts[0].analyser.spectrum = spectrum.decibels;
  pumpFrames(20, 50);
  report('after playing measure 1', 'measure ' + App.state.activeMeasure);
  report('panel says', JSON.stringify(byId['diag-heard'].textContent));
  report('and the target was', JSON.stringify(byId['diag-target'].textContent));

  pumpFrames(20, 50);
  report('holding the next notes does not advance', 'measure ' + App.state.activeMeasure);

  // Now play what measure 2 asks for instead.
  const next = sandbox.App.ScoreLoader.targetMidis(App.layoutOf().byNumber[2]);
  audioContexts[0].analyser.spectrum = synthSpectrum(next, { fftSize: App.Config.audio.fftSize }).decibels;
  pumpFrames(20, 50);
  report('playing measure 2 advances to', 'measure ' + App.state.activeMeasure);

  byId['btn-mic'].dispatch('click');
  await settle();
  report('microphone off again', byId['btn-mic'].classList.contains('mic-active') ? 'still live' : 'off');

  console.log('');
  console.log('the test recording');
  byId['btn-panel'].dispatch('click');
  report('panel toggles', byId['diag'].hidden ? 'closed' : 'open');
  byId['btn-test'].dispatch('click');
  await settle();
  report('sound source is now', sandbox.App.AudioEngine.currentMode());
  report('button reads', JSON.stringify(byId['btn-test'].textContent));
  byId['btn-test'].dispatch('click');
  await settle();
  report('and toggles back to', JSON.stringify(byId['btn-test'].textContent));

  sandbox.App.Playback.stop();
  console.log('');
  console.log('smoke test finished without a single error');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
