/**
 * The pencil ruler down the right margin.
 *
 * The sheet scrolls with its scrollbar hidden, so this is what says where you are: a
 * hand-drawn strip with a long tick at the start of every system, short ticks between
 * them, and a pencil-shaded block over the systems currently on screen. Pressing or
 * dragging on it scrolls there.
 *
 * It is an SVG, not styled HTML: the graphite filter is an SVG filter, and it only
 * applies to SVG elements.
 */
window.App = window.App || {};

window.App.Ruler = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const WIDTH = 20;

  let svg = null;
  let pencil = null;
  let viewportRect = null;
  let hatch = null;
  let geometry = { height: 0, scrollHeight: 0, viewportHeight: 0 };
  let ticks = [];

  function make(name, attributes, className) {
    const node = document.createElementNS(NS, name);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    }
    if (className) node.setAttribute('class', className);
    return node;
  }

  /** Build the strip once, empty. */
  function mount(layer) {
    layer.textContent = '';
    svg = make('svg', { class: 'ruler-svg', preserveAspectRatio: 'none' });
    pencil = make('g', null, 'pencil-stroke');
    svg.appendChild(pencil);

    viewportRect = make('rect', { x: 2, width: WIDTH - 4, y: 0, height: 0, rx: 2 }, 'ruler-viewport');
    hatch = make('g', null, 'pencil-stroke');
    svg.appendChild(viewportRect);
    svg.appendChild(hatch);
    // The two long edges are drawn by layout(), which knows the strip's height.

    layer.appendChild(svg);
    bindPointer(layer);
  }

  function bindPointer(layer) {
    let dragging = false;

    function scrollToEvent(event) {
      const rect = svg.getBoundingClientRect();
      const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
      window.App.scrollToRatio(ratio);
    }

    layer.addEventListener('pointerdown', function (event) {
      dragging = true;
      if (layer.setPointerCapture) layer.setPointerCapture(event.pointerId);
      scrollToEvent(event);
      event.preventDefault();
    });
    layer.addEventListener('pointermove', function (event) {
      if (dragging) scrollToEvent(event);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      layer.addEventListener(name, function () { dragging = false; });
    });
  }

  /**
   * Place the ticks. `systemOffsets` are the systems' distances from the top of the
   * scrolling content, measured from the page itself, so the marks stay truthful
   * however the window is sized.
   */
  function layout(systemOffsets, scrollHeight, viewportHeight) {
    if (!svg) return;

    const height = Math.max(1, Math.round(svg.clientHeight || svg.parentNode.clientHeight || 1));
    geometry = { height: height, scrollHeight: Math.max(1, scrollHeight), viewportHeight: viewportHeight };
    svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + height);

    while (pencil.firstChild) pencil.removeChild(pencil.firstChild);
    pencil.appendChild(make('line', { x1: 0.5, x2: 0.5, y1: 0, y2: height }, 'ruler-edge'));
    pencil.appendChild(make('line', { x1: WIDTH - 0.5, x2: WIDTH - 0.5, y1: 0, y2: height }, 'ruler-edge'));

    const toY = function (offset) { return (offset / geometry.scrollHeight) * height; };
    ticks = systemOffsets.map(toY);

    ticks.forEach(function (y, index) {
      pencil.appendChild(make('line', { x1: 1, x2: 13, y1: y, y2: y }, 'ruler-tick-major'));
      // Three short subdivisions between this system and the next, like a real ruler.
      const next = index + 1 < ticks.length ? ticks[index + 1] : height;
      for (let part = 1; part <= 3; part++) {
        const yy = y + (next - y) * (part / 4);
        pencil.appendChild(make('line', { x1: 1, x2: 7, y1: yy, y2: yy }, 'ruler-tick-minor'));
      }
    });
  }

  /** Slide the shaded block to wherever the sheet is scrolled. */
  function updateViewport(scrollTop, viewportHeight) {
    if (!svg || !geometry.height) return;

    const top = (scrollTop / geometry.scrollHeight) * geometry.height;
    const size = Math.max(12, (viewportHeight / geometry.scrollHeight) * geometry.height);

    viewportRect.setAttribute('y', top);
    viewportRect.setAttribute('height', size);

    // A few diagonal pencil strokes inside the block, so it reads as shading.
    while (hatch.firstChild) hatch.removeChild(hatch.firstChild);
    const spacing = 9;
    for (let y = top - WIDTH; y < top + size + WIDTH; y += spacing) {
      const y1 = Math.max(top, y);
      const y2 = Math.min(top + size, y + WIDTH);
      if (y2 - y1 < 1) continue;
      hatch.appendChild(make('line', {
        x1: 2 + (y1 - y), x2: 2 + (y2 - y), y1: y1, y2: y2
      }, 'ruler-hatch'));
    }
  }

  /** Where a press at `ratio` (0 at the top of the piece) should scroll to. */
  function scrollTopForRatio(ratio, viewportHeight) {
    const target = ratio * geometry.scrollHeight - viewportHeight / 2;
    return Math.max(0, Math.min(geometry.scrollHeight - viewportHeight, target));
  }

  return {
    mount: mount,
    layout: layout,
    updateViewport: updateViewport,
    scrollTopForRatio: scrollTopForRatio,
    WIDTH: WIDTH
  };
})();
