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
    this.started = [];          // every start(when) the page asks for, in seconds
    this.resumed = 0;
    this.analyser = null;
  }
  resume() { this.resumed++; this.state = 'running'; }
  createAnalyser() { this.analyser = new FakeAnalyser(); return this.analyser; }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {}
    };
  }
  createOscillator() {
    const self = this;
    return {
      type: '', frequency: { value: 0 }, connect() {},
      start(when) { self.started.push(when === undefined ? self.currentTime : when); },
      stop() {}
    };
  }
  createBufferSource() {
    const self = this;
    return {
      buffer: null, connect() {},
      start(when) { self.started.push(when === undefined ? self.currentTime : when); },
      stop() {}
    };
  }
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
  report('handwritten labels', countClass(canvas, 'written-note-rh') + countClass(canvas, 'written-note-lh'));

  console.log('');
  console.log('the keyboard');
  report('keys in the default range', frame.children.length);
  report('white keys', frame.children.filter((k) => k.classList.contains('white-key')).length);
  report('black keys', frame.children.filter((k) => k.classList.contains('black-key')).length);
  report('labels use 123', JSON.stringify(frame.children[0].children[0].textContent));
  report('black key label', JSON.stringify(frame.children.find((k) => k.classList.contains('black-key')).children[0].textContent));

  console.log('');
  console.log('the controls');
  const firstLabel = canvas.querySelectorAll('.written-note-rh')[0];
  report('a melody label reads', JSON.stringify(firstLabel.textContent) + ' at ' + firstLabel.style.fontSize + 'px');
  byId['btn-let'].dispatch('click');
  report('after ABC it reads', JSON.stringify(firstLabel.textContent) + ' at ' + firstLabel.style.fontSize + 'px');
  byId['btn-num'].dispatch('click');
  report('and switches back to', JSON.stringify(firstLabel.textContent) + ' at ' + firstLabel.style.fontSize + 'px');

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
  // Every note the page asks the sound engine for, so the count and the pitches can be
  // checked rather than assumed.
  const played = [];
  const realPlay = sandbox.App.PianoSound.play;
  sandbox.App.PianoSound.play = function (context, destination, midi, when, duration, loudness) {
    played.push({ midi: midi, when: when, duration: duration });
    return realPlay.apply(null, arguments);
  };

  byId['menu-onward'].dispatch('click');
  report('playing from it to the end', App.Playback.isPlaying() ? 'started' : 'did not start');

  // The point of the whole exercise: pressing play has to put notes on the audio clock,
  // at the right pitches and the right times.
  const audio = audioContexts[0];
  const started = audio ? audio.started.slice().sort((a, b) => a - b) : [];
  const bar = App.Playback.secondsOf(App.layoutOf().byNumber[3]);
  const first = App.layoutOf().byNumber[3];
  const expected = first.rh.concat(first.lh).reduce((total, event) => total + event.notes.length, 0);
  const notesWanted = first.rh.concat(first.lh).reduce(function (total, event) {
    return total + (event.rest ? 0 : event.notes.length);
  }, 0);
  report('notes sounded, of notes in the bar', played.length + ' of ' + notesWanted);
  report('first note starts at', started.length ? started[0].toFixed(2) + 's' : '—');
  report('last note starts at', started.length ? started[started.length - 1].toFixed(2) + 's' : '—');
  report('the bar is', bar.toFixed(2) + 's long (6/8 at a dotted quarter = 50)');
  // Two sixteenths inside a beat are 0.2 s apart at this tempo; if the units were not
  // converted, everything would be eight times slower.
  const gaps = [];
  for (let i = 1; i < started.length; i++) gaps.push(started[i] - started[i - 1]);
  const smallest = gaps.length ? Math.min.apply(null, gaps.filter((g) => g > 0.001)) : 0;
  report('the shortest gap between notes', smallest.toFixed(3) + 's');

  // An 8va bar is written low and sounds high: every note asked for must be the written
  // pitch an octave up, or the page would be practising the wrong notes.
  played.length = 0;
  const eighthBar = App.layoutOf().byNumber[30];
  App.Playback.stop();
  App.Playback.play({
    context: audio, destination: audio.destination, total: 65, measure: 30, toEnd: false,
    measureAt: function (number) { return App.layoutOf().byNumber[number]; },
    onMeasure: function () {}, onFinish: function () {}
  });
  const written = [];
  eighthBar.rh.concat(eighthBar.lh).forEach(function (event) {
    event.notes.forEach(function (note) { written.push(note.midi); });
  });
  const soundings = played.map(function (note) { return note.midi; });
  report('measure 30 is written under an 8va', eighthBar.octaveShift === 12 ? 'yes' : 'no');
  // Counted, not just looked up: the melody and the bass overlap in range, so a pitch
  // that was written low can legitimately equal another note's sounding pitch.
  const tally = function (list) {
    const counts = {};
    list.forEach(function (value) { counts[value] = (counts[value] || 0) + 1; });
    return counts;
  };
  const wantedCounts = tally(written.map(function (midi) { return midi + 12; }));
  const soundedCounts = tally(soundings);
  const same = Object.keys(wantedCounts).length === Object.keys(soundedCounts).length &&
    Object.keys(wantedCounts).every(function (key) { return wantedCounts[key] === soundedCounts[key]; });
  report('its notes sound an octave higher', same ? 'yes, all of them' : 'NO',
    written.length + ' written, ' + soundings.length + ' sounded');
  App.Playback.stop();

  // A context that the browser has parked must be woken before anything is heard.
  audio.state = 'suspended';
  sandbox.App.AudioEngine.ensure();
  report('a parked audio context is resumed', audio.resumed > 0 ? 'yes' : 'NO — it would stay silent');
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

  // The machinery the full arrangement needs, drawn: chords, a bass staff that changes
  // clef, moving eighths, doubled and tripled beams, grace notes, rests, ties, 8va and
  // a mid-score time change. The model behind this is checked in check_arrangement.js.
  console.log('');
  console.log('the full-arrangement sample, drawn');
  const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/arrangement-sample.json'), 'utf8'));
  const sampleScore = sandbox.App.ScoreLoader.load(sample);
  const sampleLayout = sandbox.App.Layout.build(sampleScore);
  const sampleCanvas = new Element('div');
  sandbox.App.SheetRender.renderSheet(sampleCanvas, sampleLayout, { activeMeasure: 1 });

  report('systems', sampleCanvas.children.length);
  report('noteheads', count(sampleCanvas, 'ellipse'));
  report('stems', countClass(sampleCanvas, 'note-stem'));
  report('beams', countClass(sampleCanvas, 'note-beam'));
  report('…of which second and third strokes', countClass(sampleCanvas, 'beam-secondary'));
  report('ties', countClass(sampleCanvas, 'tie-arc'));
  report('rests', countClass(sampleCanvas, 'rest-stroke'));
  report('grace slashes', countClass(sampleCanvas, 'grace-slash'));
  report('clefs at the head of a system', countClass(sampleCanvas, 'clef'));
  report('cue clefs before a change', countClass(sampleCanvas, 'cue-clef'));
  report('time signatures', countClass(sampleCanvas, 'time-signature'));
  report('8va lines', countClass(sampleCanvas, 'octave-line'));
  report('key signatures, both staves', countClass(sampleCanvas, 'key-sharp'));
  report('leading ledger strokes', countClass(sampleCanvas, 'ledger-line'));

  console.log('');
  console.log('smoke test finished without a single error');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
