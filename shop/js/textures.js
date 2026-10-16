/**
 * textures.js — every surface texture in the scene, drawn on a canvas at load.
 *
 * Nothing is fetched. There are no image files in this project at all, which
 * keeps it working offline, keeps it free of licensing questions, and means the
 * whole thing is one folder you can copy.
 *
 * Colour-space discipline matters here and is the usual cause of a scene that
 * looks washed out: anything used as COLOUR (asphalt, paint, product labels)
 * gets SRGBColorSpace. Anything used as DATA — a mask, a ramp, a roughness
 * lookup — must be left at the default NoColorSpace, or three.js will quietly
 * gamma-correct it and the mask will sit in the wrong place.
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(size) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  return element;
}

function toTexture(element, { repeat = 1, srgb = true, wrap = THREE.RepeatWrapping } = {}) {
  const texture = new THREE.CanvasTexture(element);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Deterministic noise, so the scene looks the same on every reload. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function grain(context, size, amount, random) {
  const image = context.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  context.putImageData(image, 0, 0);
}

/* ------------------------------------------------------------- surfaces -- */

/**
 * Wet asphalt is nearly black and very slightly blue, with the reflection doing
 * all the work. Get this value wrong — pick a mid grey, the way dry concrete
 * looks — and the whole night reads as overcast daytime.
 */
export function asphalt() {
  return cached('asphalt', () => {
    const size = 512;
    const element = canvas(size);
    const context = element.getContext('2d');
    const random = makeRandom(20261016);

    context.fillStyle = '#232a3a';
    context.fillRect(0, 0, size, size);

    // Coarse aggregate.
    for (let i = 0; i < 9000; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 0.5 + random() * 1.8;
      const shade = 26 + random() * 34;
      context.fillStyle = `rgba(${shade},${shade + 4},${shade + 12},${0.25 + random() * 0.4})`;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }

    // A few darker patches where the surface has been dug up and relaid.
    for (let i = 0; i < 14; i++) {
      context.fillStyle = `rgba(16,19,29,${0.16 + random() * 0.2})`;
      context.beginPath();
      context.ellipse(
        random() * size, random() * size,
        20 + random() * 70, 14 + random() * 50,
        random() * Math.PI, 0, Math.PI * 2,
      );
      context.fill();
    }

    grain(context, size, 16, random);
    return toTexture(element, { repeat: 3 });
  });
}

/** Paving slabs, for the pavement. */
export function paving() {
  return cached('paving', () => {
    const size = 512;
    const element = canvas(size);
    const context = element.getContext('2d');
    const random = makeRandom(77123);

    context.fillStyle = '#4b5266';
    context.fillRect(0, 0, size, size);

    const cell = 64;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const tone = 62 + random() * 22;
        context.fillStyle = `rgb(${tone},${tone + 6},${tone + 20})`;
        context.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
      }
    }

    grain(context, size, 12, random);
    return toTexture(element, { repeat: 4 });
  });
}

/** Bare concrete: kerbs, the plinth, the back of the shop. */
export function concrete() {
  return cached('concrete', () => {
    const size = 256;
    const element = canvas(size);
    const context = element.getContext('2d');
    const random = makeRandom(4242);

    context.fillStyle = '#5f6678';
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const shade = 74 + random() * 40;
      context.fillStyle = `rgba(${shade},${shade + 4},${shade + 12},${random() * 0.35})`;
      context.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
    }
    // A tide-mark, so nothing looks freshly poured.
    const stain = context.createLinearGradient(0, size * 0.6, 0, size);
    stain.addColorStop(0, 'rgba(30,34,46,0)');
    stain.addColorStop(1, 'rgba(30,34,46,0.4)');
    context.fillStyle = stain;
    context.fillRect(0, size * 0.6, size, size * 0.4);

    grain(context, size, 10, random);
    return toTexture(element, { repeat: 2 });
  });
}

/* ---------------------------------------------------------------- masks -- */

/**
 * Where the water stands.
 *
 * This is a world-space mask, so it must NOT tile — it is laid over the road
 * once, and the puddles have to be where water would actually collect: along the
 * gutter, in the low corner of the parking bay, in the wheel ruts. Puddles
 * scattered evenly at random across a road surface are an immediate tell.
 */
export function puddleMask() {
  return cached('puddleMask', () => {
    const size = 1024;
    const element = canvas(size);
    const context = element.getContext('2d');
    const random = makeRandom(90210);

    context.fillStyle = '#000000';
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = 'lighter';

    /** The gutter runs along the north kerb of the main street. */
    const gutters = [
      { x: 0.0, y: 0.40, w: 1.0, h: 0.06 },
      { x: 0.0, y: 0.79, w: 1.0, h: 0.09 },
      { x: 0.24, y: 0.0, w: 0.09, h: 0.45 },
    ];

    for (const band of gutters) {
      for (let i = 0; i < 26; i++) {
        const x = (band.x + random() * band.w) * size;
        const y = (band.y + random() * band.h) * size;
        const r = 26 + random() * 62;
        const g = context.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = g;
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Broad shallow wetness everywhere else, so the road is damp rather than
    // either bone dry or a perfect mirror.
    for (let i = 0; i < 90; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 60 + random() * 150;
      const g = context.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.1 + random() * 0.22})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = g;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }

    // Blur, so the edges are not obviously circles.
    context.globalCompositeOperation = 'source-over';
    context.filter = 'blur(9px)';
    context.drawImage(element, 0, 0);
    context.filter = 'none';

    const texture = new THREE.CanvasTexture(element);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // A mask is data, not colour. Leaving it sRGB would gamma-correct it and
    // slide every puddle edge.
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
}

/** Soft irregular noise, used for rain brightness variation and grime. */
export function noise() {
  return cached('noise', () => {
    const size = 256;
    const element = canvas(size);
    const context = element.getContext('2d');
    const random = makeRandom(31337);

    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 520; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 8 + random() * 54;
      const g = context.createRadialGradient(x, y, 0, x, y, r);
      const v = random() < 0.5 ? 0 : 255;
      g.addColorStop(0, `rgba(${v},${v},${v},0.18)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      context.fillStyle = g;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new THREE.CanvasTexture(element);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
}

/** A soft round dot — rain streaks, splashes, contact shadows, steam. */
export function softDot() {
  return cached('softDot', () => {
    const size = 64;
    const element = canvas(size);
    const context = element.getContext('2d');
    const g = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = g;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(element);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
