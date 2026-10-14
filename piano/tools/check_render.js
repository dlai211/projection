#!/usr/bin/env node
/**
 * Smoke-test the page without a browser.
 *
 * There is no DOM here, so this file brings a very small one: enough elements,
 * attributes and events for the renderers to run exactly as they do in the page. It
 * then drives the controls the way a person would — switch notation, change the
 * spacing, swap the keyboard range, click a note, drag the ruler, resize — and reports
 * what came out. Anything undefined or misspelled throws, which is the point.
 *
 * Usage:  node tools/check_render.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = [
  'music-sheet/flower-day.js',
  'js/config.js', 'js/pitch-utils.js', 'js/notes-number.js', 'js/notes-letter.js',
  'js/score-loader.js', 'js/layout.js', 'js/sheet-render.js', 'js/keyboard-render.js',
  'js/ruler.js', 'js/app.js'
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
    this.width = 68;
    this.height = 240;
    const style = { setProperty(key, value) { style[key] = value; }, removeProperty() {} };
    this.style = style;
  }
  // Writing textContent replaces everything inside, as it does in a browser.
  get textContent() { return this.text; }
  set textContent(value) { this.children = []; this.text = String(value); }

  // In a browser, writing className and using classList are two views of one thing.
  get classList() { return this.classes; }
  get className() { return Array.from(this.classes.set).join(' '); }
  set className(value) { this.classes.set = new Set(String(value).split(/\s+/).filter(Boolean)); }
  setAttribute(key, value) {
    if (key === 'class') this.className = value;
    else this.attributes[key] = String(value);
  }
  getAttribute(key) { return key === 'class' ? this.className : this.attributes[key]; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    return child;
  }
  addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
  dispatch(name, event) { (this.listeners[name] || []).forEach((fn) => fn(event || {})); }
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
  /** Only the one selector the page uses: "[data-something]". */
  querySelectorAll(selector) {
    const wanted = selector.replace(/[[\]]/g, '').replace(/^data-/, '');
    const found = [];
    const walk = (node) => {
      node.children.forEach((child) => {
        if (child.dataset && Object.prototype.hasOwnProperty.call(child.dataset, wanted)) found.push(child);
        walk(child);
      });
    };
    walk(this);
    return found;
  }
}

const IDS = ['sheet-area', 'sheet-canvas', 'piano-frame', 'ruler-layer', 'progress',
  'song-title', 'song-subtitle', 'song-meta', 'btn-num', 'btn-let', 'btn-compact',
  'btn-keys-default', 'btn-keys-full', 'btn-mic', 'btn-reset'];

const byId = {};
IDS.forEach((id) => { byId[id] = new Element('div'); });

const documentStub = {
  readyState: 'complete',
  body: new Element('body'),
  createElement: (name) => new Element(name),
  createElementNS: (ns, name) => new Element(name),
  getElementById: (id) => byId[id] || null,
  addEventListener: () => {}
};

// ---------------------------------------------------------------- run it

/** Enough of the Web Audio API for a click to make a sound without a browser. */
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; }
  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
}

const sandbox = {
  console: console,
  document: documentStub,
  requestAnimationFrame: (fn) => fn(),
  AudioContext: FakeAudioContext
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

SCRIPTS.forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const App = sandbox.App;
const canvas = byId['sheet-canvas'];
const frame = byId['piano-frame'];
const ruler = byId['ruler-layer'];

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

function report(label, value) { console.log('  ' + label.padEnd(34) + value); }

console.log('the score, drawn');
report('systems', canvas.children.length);
report('staff lines (10 a system)', countClass(canvas, 'staff-line') - countClass(canvas, 'ledger-line'));
report('ledger strokes', countClass(canvas, 'ledger-line'));
report('barlines (5 a system)', countClass(canvas, 'bar-line'));
report('beams', countClass(canvas, 'note-beam'));
report('key-signature sharps', countClass(canvas, 'key-sharp'));
report('clefs', countClass(canvas, 'clef'));
report('measure smudges', count(canvas, 'rect'));
report('noteheads (melody + bass)', count(canvas, 'ellipse'));
report('handwritten labels', canvas.querySelectorAll('[data-num]').length);

console.log('');
console.log('the keyboard');
report('keys in the default range', frame.children.length);
report('white keys', frame.children.filter((k) => k.classList.contains('white-key')).length);
report('black keys', frame.children.filter((k) => k.classList.contains('black-key')).length);
report('first black key left', frame.children.find((k) => k.classList.contains('black-key')).style.left);
report('last black key left', frame.children.filter((k) => k.classList.contains('black-key')).pop().style.left);
report('labels use 123', frame.children[0].children[0].textContent);
report('black key label', frame.children.find((k) => k.classList.contains('black-key')).children[0].textContent);

console.log('');
console.log('the controls');

byId['btn-let'].dispatch('click');
report('after ABC, melody label', canvas.querySelectorAll('[data-num]')[0].textContent);
report('after ABC, key label', frame.children[0].children[0].textContent);
byId['btn-num'].dispatch('click');

byId['btn-compact'].dispatch('click');
report('after one press, spacing', byId['btn-compact'].dataset.setting + ' -> ' + canvas.style['--system-gap']);
byId['btn-compact'].dispatch('click');
report('after two presses, spacing', byId['btn-compact'].dataset.setting + ' -> ' + canvas.style['--system-gap']);
byId['btn-compact'].dispatch('click');

byId['btn-keys-full'].dispatch('click');
report('88-key view, keys', frame.children.length);
report('88-key view, first key label', JSON.stringify(frame.children[0].children[0].textContent));
report('88-key view, last key label', JSON.stringify(frame.children[frame.children.length - 1].children[0].textContent));
report('88-key view, dense labels', frame.classList.contains('keys-dense'));
byId['btn-keys-default'].dispatch('click');
report('back to the default range', frame.children.length + ' keys');

App.onNoteClick(4, 66);
report('clicking a note selects', 'measure ' + App.state.activeMeasure + ', ' + App.state.activeMidis.size + ' key(s) lit');
App.onKeyClick(60);
report('clicking a key lights', App.state.activeMidis.size + ' key(s)');

byId['btn-reset'].dispatch('click');
report('reset returns to', 'measure ' + App.state.activeMeasure);
byId['btn-mic'].dispatch('click');
report('microphone toggles', byId['btn-mic'].classList.contains('mic-active'));

App.scrollToRatio(0.5);
report('ruler drag scrolls to', Math.round(byId['sheet-area'].scrollTop));
byId['sheet-area'].dispatch('scroll');
const rulerSvg = ruler.children[0];
report('ruler strip height', rulerSvg.getAttribute('viewBox'));
report('viewport block sits at', rulerSvg.children[1].getAttribute('y') + ', ' + rulerSvg.children[1].getAttribute('height') + ' tall');
report('ruler ticks', countClass(rulerSvg, 'ruler-tick-major') + ' major, ' + countClass(rulerSvg, 'ruler-tick-minor') + ' minor');

console.log('');
console.log('smoke test finished without a single error');
