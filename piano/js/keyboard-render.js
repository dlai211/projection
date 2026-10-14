/**
 * The keyboard along the bottom of the page.
 *
 * test.html's keyboard, kept whole: white keys are flex children with a pencil outline,
 * black keys are positioned by percentage and filled with a scraped-graphite texture
 * drawn on a canvas. Two ranges are offered — test.html's own octaves 2 to 6, and the
 * full 88 keys — and the black-key formula works unchanged for both, because it is
 * written in terms of the white key below rather than of an octave number.
 */
window.App = window.App || {};

window.App.KeyboardRender = (function () {
  'use strict';

  const Config = window.App.Config;

  /** The white keys of an octave, with the scale steps test.html uses. */
  const WHITE_STEPS = [
    { letter: 'C', step: 0 },
    { letter: 'D', step: 2 },
    { letter: 'E', step: 4 },
    { letter: 'F', step: 5 },
    { letter: 'G', step: 7 },
    { letter: 'A', step: 9 },
    { letter: 'B', step: 11 }
  ];

  /** The black keys of an octave: which white key each sits to the right of. */
  const BLACK_STEPS = [
    { step: 1, after: 0 },
    { step: 3, after: 1 },
    { step: 6, after: 3 },
    { step: 8, after: 4 },
    { step: 10, after: 5 }
  ];

  /**
   * PROCEDURAL PENCIL-SCRAPING GENERATOR FOR BLACK KEYS (Matches test.html exactly)
   * A dense, dark diagonal charcoal rubbing with specks of paper tooth left showing.
   */
  function createScrapedPencilDataURL() {
    const canvas = document.createElement('canvas');
    canvas.width = 68;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    // 1. Base layered back-and-forth diagonal pencil shading
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 420; pass++) {
      const yCenter = Math.random() * 234 + 3;
      const tilt = (Math.random() - 0.5) * 18 - 10;
      const xLeft = 2 + Math.random() * 6;
      const xRight = 66 - Math.random() * 6;

      ctx.beginPath();
      ctx.moveTo(xLeft, yCenter - tilt * 0.5);
      ctx.bezierCurveTo(
        22, yCenter - 2 + (Math.random() - 0.5) * 4,
        46, yCenter + 2 + (Math.random() - 0.5) * 4,
        xRight, yCenter + tilt * 0.5
      );

      const darkness = 26 + Math.floor(Math.random() * 22);
      const alpha = 0.22 + Math.random() * 0.34;
      ctx.strokeStyle = 'rgba(' + darkness + ', ' + (darkness - 1) + ', ' + (darkness - 2) + ', ' + alpha + ')';
      ctx.lineWidth = 2.2 + Math.random() * 3.8;
      ctx.stroke();
    }

    // 2. Vertical core shading so the key feels dark and full
    for (let v = 0; v < 95; v++) {
      const x = 6 + Math.random() * 56;
      ctx.beginPath();
      ctx.moveTo(x, 2 + Math.random() * 8);
      ctx.lineTo(x + (Math.random() - 0.5) * 6, 232 - Math.random() * 8);
      ctx.strokeStyle = 'rgba(30, 28, 26, ' + (0.18 + Math.random() * 0.25) + ')';
      ctx.lineWidth = 1.5 + Math.random() * 2.5;
      ctx.stroke();
    }

    // 3. Subtle paper tooth specks (tiny un-inked valleys in the coarse paper)
    ctx.globalCompositeOperation = 'destination-out';
    for (let speck = 0; speck < 340; speck++) {
      const sx = Math.random() * 68;
      const sy = Math.random() * 240;
      const r = 0.4 + Math.random() * 1.1;
      ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.18 + Math.random() * 0.38) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Hand-sketched graphite outline around the key
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(28, 26, 24, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(2.5, 1, 63, 235);

    return canvas.toDataURL();
  }

  // Five organic textures, so neighbouring black keys look uniquely hand-shaded.
  let textures = null;
  function scrapedTextures() {
    if (!textures) textures = [0, 1, 2, 3, 4].map(createScrapedPencilDataURL);
    return textures;
  }

  /** Every white key of a range, in order. */
  function whiteKeysOf(low, high) {
    const keys = [];
    for (let midi = low; midi <= high; midi++) {
      if (isWhite(midi)) keys.push(midi);
    }
    return keys;
  }

  function isWhite(midi) {
    const pc = ((midi % 12) + 12) % 12;
    return [0, 2, 4, 5, 7, 9, 11].indexOf(pc) !== -1;
  }

  /** Which range the current mode asks for. */
  function rangeOf(mode) {
    if (mode === 'full') return { low: Config.piano.fullRange.low, high: Config.piano.fullRange.high };
    const octaves = Config.piano.defaultOctaves;
    return { low: (octaves[0] + 1) * 12, high: (octaves[1] + 1) * 12 + 11 };
  }

  function renderKeyboard(frame, state) {
    const range = rangeOf(state.keyboardRange);
    const whites = whiteKeysOf(range.low, range.high);

    frame.textContent = '';
    frame.classList.toggle('keys-dense', whites.length > 40);

    whites.forEach(function (midi) {
      const key = document.createElement('div');
      key.className = 'white-key' + (state.activeMidis.has(midi) ? ' active' : '');
      key.dataset.midi = midi;
      key.addEventListener('click', function () { window.App.onKeyClick(midi); });

      const label = document.createElement('span');
      label.dataset.num = window.App.NotesNumber.keyLabel(midi);
      label.dataset.let = window.App.NotesLetter.keyLabel(midi);
      label.textContent = state.mode === 'number' ? label.dataset.num : label.dataset.let;
      key.appendChild(label);
      frame.appendChild(key);
    });

    const blackWidth = Config.piano.blackKeyWidthPct;
    const adjust = Config.piano.blackKeyLeftAdjust;
    const palette = scrapedTextures();
    let painted = 0;

    for (let midi = range.low; midi <= range.high; midi++) {
      if (isWhite(midi)) continue;

      // The white key immediately below decides where the black key sits.
      const below = whites.indexOf(midi - 1);
      if (below === -1) continue;

      const key = document.createElement('div');
      key.className = 'black-key' + (state.activeMidis.has(midi) ? ' active' : '');
      key.dataset.midi = midi;
      key.style.left = (((below + 1) / whites.length) * 100 - adjust) + '%';
      key.style.width = blackWidth + '%';
      key.style.backgroundImage = 'url(' + palette[painted % palette.length] + ')';
      painted++;
      key.addEventListener('click', function (event) {
        event.stopPropagation();
        window.App.onKeyClick(midi);
      });

      const label = document.createElement('span');
      label.dataset.num = window.App.NotesNumber.keyLabel(midi);
      label.dataset.let = window.App.NotesLetter.keyLabel(midi);
      label.textContent = state.mode === 'number' ? label.dataset.num : label.dataset.let;
      key.appendChild(label);
      frame.appendChild(key);
    }
  }

  /** Switch the key labels between 123 and ABC without rebuilding the keyboard. */
  function applyMode(frame, mode) {
    const labels = frame.querySelectorAll('[data-num]');
    Array.prototype.forEach.call(labels, function (label) {
      label.textContent = mode === 'number' ? label.dataset.num : label.dataset.let;
    });
  }

  /** Light up the keys a measure asks for. */
  function applyActive(frame, activeMidis) {
    Array.prototype.forEach.call(frame.children, function (key) {
      const midi = Number(key.dataset.midi);
      key.classList.toggle('active', activeMidis.has(midi));
    });
  }

  return {
    renderKeyboard: renderKeyboard,
    applyMode: applyMode,
    applyActive: applyActive,
    rangeOf: rangeOf
  };
})();
