/**
 * signage.js — everything in the scene with letters or a logo on it.
 *
 * Kept apart from textures.js because it is a different job: textures.js is
 * about surfaces and frequency, this is about typography and layout, and the art
 * direction is won or lost here rather than in the noise functions.
 *
 * Nothing is fetched and no webfont is loaded — a downloaded font would break
 * the "works with no network" rule, add megabytes, and drag in a licence. Text
 * is drawn with whatever the system has, through a stack that covers the common
 * Japanese faces.
 *
 * The trick that makes small signage read is the one model-makers use: at a few
 * centimetres on screen a shop sign is a colour band, a mark and a couple of
 * legible characters, so it is drawn as SHAPES at high contrast, with the
 * keyline baked into the texture rather than left to the outline pass. An
 * emissive sign with a geometry outline gets its contour smeared away by the
 * bloom, so the dark border has to be painted in.
 */

import * as THREE from 'three';
import { PALETTE, BRAND } from './config.js';

const JP_FONT = "'Yu Gothic UI', 'Yu Gothic', Meiryo, 'MS PGothic', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
const EN_FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const cache = new Map();

function sheet(width, height, draw) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  draw(context, width, height);
  return element;
}

function toTexture(element, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(element);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function hex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** The dark keyline, painted in rather than left to the outline pass. */
function keyline(context, x, y, w, h, weight = 6) {
  context.strokeStyle = '#10131f';
  context.lineWidth = weight;
  context.strokeRect(x + weight / 2, y + weight / 2, w - weight, h - weight);
}

/* --------------------------------------------------------------- fascia -- */

/**
 * The long sign above the glass, running the full frontage. White, with the
 * blue and green stripe under it — the livery reads as a colour band long before
 * any of the letters resolve, which is exactly how it works on a real street.
 */
export function fasciaSign() {
  return cached('fascia', () => {
    const width = 2048;
    const height = 232;
    const element = sheet(width, height, (context) => {
      context.fillStyle = hex(PALETTE.signWhite);
      context.fillRect(0, 0, width, height);

      // The livery stripe, along the bottom.
      const stripe = 46;
      context.fillStyle = hex(PALETTE.brandBlue);
      context.fillRect(0, height - stripe, width, stripe);
      context.fillStyle = hex(PALETTE.brandGreen);
      context.fillRect(0, height - stripe, width, 12);
      context.fillStyle = hex(PALETTE.brandDeep);
      context.fillRect(0, height - 10, width, 10);

      // A faint seam every so often, so the band is not one flat field.
      context.strokeStyle = 'rgba(20,26,44,0.07)';
      context.lineWidth = 2;
      for (let x = 256; x < width; x += 256) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height - stripe);
        context.stroke();
      }

      context.textBaseline = 'middle';

      // Wordmark.
      context.fillStyle = hex(PALETTE.brandBlue);
      context.font = `600 108px ${EN_FONT}`;
      context.textAlign = 'left';
      context.fillText(BRAND.latin, 96, height / 2 - 8);

      // Kana, small and to the right of it.
      context.fillStyle = hex(PALETTE.brandDeep);
      context.font = `500 54px ${JP_FONT}`;
      context.fillText(BRAND.name, 96 + context.measureText(BRAND.latin).width + 330, height / 2 - 4);

      // The 24H badge.
      const bx = width - 300;
      context.fillStyle = hex(PALETTE.brandGreen);
      context.beginPath();
      context.roundRect(bx, 34, 208, 112, 14);
      context.fill();
      context.fillStyle = '#ffffff';
      context.font = `700 76px ${EN_FONT}`;
      context.textAlign = 'center';
      context.fillText(BRAND.sub, bx + 104, 92);

      context.fillStyle = hex(PALETTE.brandBlue);
      context.font = `500 30px ${EN_FONT}`;
      context.textAlign = 'right';
      context.fillText(BRAND.slogan, width - 96, height / 2 + 78);

      keyline(context, 0, 0, width, height, 8);
    });
    return toTexture(element);
  });
}

/* ---------------------------------------------------------------- pylon -- */

/**
 * The pole sign at the corner. This is the one seen from a long way off, and it
 * has to be the brightest thing in frame — if the street lamps are competing
 * with it, the composition dies. It gets its own emissive material rather than
 * relying on the scene lights.
 */
export function pylonSign() {
  return cached('pylon', () => {
    const size = 512;
    const element = sheet(size, size, (context) => {
      context.fillStyle = hex(PALETTE.signWhite);
      context.fillRect(0, 0, size, size);

      context.fillStyle = hex(PALETTE.brandBlue);
      context.fillRect(0, 0, size, 26);
      context.fillStyle = hex(PALETTE.brandGreen);
      context.fillRect(0, size - 92, size, 92);
      context.fillStyle = hex(PALETTE.brandDeep);
      context.fillRect(0, size - 26, size, 26);

      context.textAlign = 'center';
      context.textBaseline = 'middle';

      context.fillStyle = hex(PALETTE.brandBlue);
      context.font = `600 82px ${EN_FONT}`;
      context.fillText('AOI', size / 2, 150);
      context.fillText('MART', size / 2, 238);

      context.fillStyle = hex(PALETTE.brandDeep);
      context.font = `500 44px ${JP_FONT}`;
      context.fillText(BRAND.name, size / 2, 322);

      context.fillStyle = '#ffffff';
      context.font = `700 58px ${EN_FONT}`;
      context.fillText(BRAND.sub, size / 2, size - 46);

      keyline(context, 0, 0, size, size, 10);
    });
    return toTexture(element);
  });
}

/* --------------------------------------------------------------- posters -- */

/**
 * A few small posters for the window and the notice board. Deliberately
 * different from each other and slightly faded — a board of identical, crisp
 * posters reads as a texture, not as a place.
 */
export function poster(index = 0) {
  return cached(`poster${index}`, () => {
    const width = 256;
    const height = 360;
    const variants = [
      { bg: '#e8556a', ink: '#fff4f2', accent: '#ffd166', title: 'SALE', sub: '今週のおすすめ' },
      { bg: '#2f6fd0', ink: '#f2f7ff', accent: '#7fe3c0', title: 'NEW', sub: '新発売' },
      { bg: '#f0c53f', ink: '#2b2410', accent: '#e8556a', title: 'HOT', sub: 'あたたかい' },
      { bg: '#1f9d78', ink: '#f0fff8', accent: '#ffd166', title: '24H', sub: 'いつでも' },
    ];
    const v = variants[index % variants.length];

    const element = sheet(width, height, (context) => {
      context.fillStyle = v.bg;
      context.fillRect(0, 0, width, height);

      context.fillStyle = v.accent;
      context.beginPath();
      context.arc(width * 0.72, height * 0.26, 62, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = v.ink;
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.font = `700 88px ${EN_FONT}`;
      context.fillText(v.title, 22, 92);

      context.font = `500 40px ${JP_FONT}`;
      context.fillText(v.sub, 22, 190);

      // A couple of ruled lines standing in for body copy.
      context.fillStyle = v.ink;
      context.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        context.fillRect(22, 250 + i * 22, width - 44 - (i === 3 ? 70 : 0), 8);
      }
      context.globalAlpha = 1;

      // Faded and sun-bleached at one corner, as posters are.
      context.fillStyle = 'rgba(255,255,255,0.16)';
      context.beginPath();
      context.moveTo(width, 0);
      context.lineTo(width, height * 0.45);
      context.lineTo(width * 0.62, 0);
      context.fill();

      keyline(context, 0, 0, width, height, 5);
    });
    return toTexture(element);
  });
}

/** A hanging promo card for inside the shop, seen through the glass. */
export function shelfCard(index = 0) {
  return cached(`shelfCard${index}`, () => {
    const width = 256;
    const height = 128;
    const palette = [
      ['#e8556a', '#ffffff'],
      ['#2f6fd0', '#ffffff'],
      ['#f0c53f', '#2b2410'],
      ['#1f9d78', '#ffffff'],
    ][index % 4];

    const element = sheet(width, height, (context) => {
      context.fillStyle = palette[0];
      context.fillRect(0, 0, width, height);
      context.fillStyle = palette[1];
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 52px ${JP_FONT}`;
      context.fillText(['おすすめ', '新発売', 'セール', '限定'][index % 4], width / 2, height / 2 - 8);
      context.font = `500 24px ${EN_FONT}`;
      context.globalAlpha = 0.8;
      context.fillText(['RECOMMEND', 'NEW', 'SALE', 'LIMITED'][index % 4], width / 2, height / 2 + 34);
      context.globalAlpha = 1;
      keyline(context, 0, 0, width, height, 4);
    });
    return toTexture(element);
  });
}

/** The dark green back-of-house door and the staff notice beside it. */
export function backDoorSign() {
  return cached('backDoor', () => {
    const element = sheet(256, 128, (context) => {
      context.fillStyle = '#2f4f43';
      context.fillRect(0, 0, 256, 128);
      context.fillStyle = '#e8eef0';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `600 34px ${JP_FONT}`;
      context.fillText('関係者以外', 128, 46);
      context.fillText('立入禁止', 128, 86);
      keyline(context, 0, 0, 256, 128, 4);
    });
    return toTexture(element);
  });
}

/** The livery down each side of the delivery truck's box. */
export function liverySide() {
  return cached('livery', () => {
    const element = sheet(1024, 512, (context) => {
      context.fillStyle = '#f2f5fa';
      context.fillRect(0, 0, 1024, 512);

      // The shop's own stripe, so the truck obviously belongs to it.
      context.fillStyle = hex(PALETTE.brandBlue);
      context.fillRect(0, 300, 1024, 74);
      context.fillStyle = hex(PALETTE.brandGreen);
      context.fillRect(0, 374, 1024, 26);

      context.textBaseline = 'middle';
      context.textAlign = 'left';
      context.fillStyle = hex(PALETTE.brandDeep);
      context.font = `700 108px ${EN_FONT}`;
      context.fillText('AOI LOGISTICS', 64, 160);

      context.fillStyle = hex(PALETTE.brandBlue);
      context.font = `600 62px ${JP_FONT}`;
      context.fillText('24H 配送', 66, 252);

      context.fillStyle = '#ffffff';
      context.font = `600 44px ${EN_FONT}`;
      context.fillText('COLD CHAIN  ·  冷蔵', 64, 337);

      // A little road grime along the bottom, because nothing in a yard is clean.
      const grime = context.createLinearGradient(0, 420, 0, 512);
      grime.addColorStop(0, 'rgba(40,44,56,0)');
      grime.addColorStop(1, 'rgba(40,44,56,0.35)');
      context.fillStyle = grime;
      context.fillRect(0, 420, 1024, 92);

      keyline(context, 0, 0, 1024, 512, 8);
    });
    return toTexture(element);
  });
}

/* ----------------------------------------------------------- road signs -- */

/**
 * A Japanese road arrow: long, thin, and straight. Drawn flat on a canvas and
 * used as a texture on a zero-thickness plane — the earlier version built these
 * out of a box and a cone, which gave them a visible thickness and a contour
 * and made them read as objects lying on the road.
 */
export function roadArrow() {
  return cached('roadArrow', () => {
    const element = sheet(256, 512, (context) => {
      context.clearRect(0, 0, 256, 512);
      context.fillStyle = '#ffffff';
      // A 4.5 m arrow at 256x512: shaft plus a wide, blunt head.
      context.fillRect(104, 190, 48, 300);
      context.beginPath();
      context.moveTo(128, 26);
      context.lineTo(212, 200);
      context.lineTo(44, 200);
      context.closePath();
      context.fill();
    });
    return toTexture(element);
  });
}

/** The white P painted inside a parking bay. */
export function parkingSign() {
  return cached('parking', () => {
    const element = sheet(128, 160, (context) => {
      context.clearRect(0, 0, 128, 160);
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 150px ${EN_FONT}`;
      context.fillText('P', 64, 86);
    });
    return toTexture(element);
  });
}

/**
 * A Japanese road sign on a blue ground: the one-way arrow, the parking plate,
 * and the red inverted triangle for 止まれ. Drawn as shapes at high contrast,
 * because at a few centimetres on screen a sign is a colour and a silhouette.
 */
export function roadSign(kind) {
  return cached(`roadSign:${kind}`, () => {
    const element = sheet(256, 256, (context) => {
      const plate = (fill) => {
        context.fillStyle = fill;
        context.beginPath();
        context.roundRect(10, 10, 236, 236, 22);
        context.fill();
        context.strokeStyle = '#f2f6ff';
        context.lineWidth = 8;
        context.stroke();
      };

      if (kind === 'oneway') {
        plate('#1b4fa8');
        context.fillStyle = '#f2f6ff';
        // A long arrow, pointing right.
        context.fillRect(44, 112, 128, 32);
        context.beginPath();
        context.moveTo(160, 78);
        context.lineTo(216, 128);
        context.lineTo(160, 178);
        context.closePath();
        context.fill();
        context.font = `600 40px ${JP_FONT}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('一方通行', 128, 210);
      } else if (kind === 'parking') {
        plate('#1b4fa8');
        context.fillStyle = '#f2f6ff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `700 150px ${EN_FONT}`;
        context.fillText('P', 128, 122);
        context.font = `600 34px ${JP_FONT}`;
        context.fillText('駐車場', 128, 210);
      } else {
        // 止まれ: a red inverted triangle.
        context.clearRect(0, 0, 256, 256);
        context.fillStyle = '#c0392b';
        context.beginPath();
        context.moveTo(12, 30);
        context.lineTo(244, 30);
        context.lineTo(128, 240);
        context.closePath();
        context.fill();
        context.strokeStyle = '#f2f6ff';
        context.lineWidth = 10;
        context.stroke();
        context.fillStyle = '#f2f6ff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `700 62px ${JP_FONT}`;
        context.fillText('止まれ', 128, 92);
      }

      keyline(context, 0, 0, 256, 256, 6);
    });
    return toTexture(element);
  });
}

function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
