// js/draw.js
// All canvas rendering: one line style per particle type, the hadronic blob with
// its brace, and one renderer per diagram topology.

import { isAntiQuark } from './hadrons.js';
import { findHadronTransition } from './quarkflow.js';

export const CANVAS_W = 720;
export const CANVAS_H = 420;

const INK = '#1b221c';
const VECTOR = '#b45309';
const WEAK = '#e74c3c';
const NEUTRAL = '#8e44ad';
const GLUON = '#27ae60';
const HADRON_COLOUR = '#1f5e8e';

const COLOURS = { 'W⁺': WEAK, 'W⁻': WEAK, 'Z⁰': NEUTRAL, 'γ': VECTOR, 'g': GLUON };

const FONT = (size) => `bold ${size}px 'Segoe UI', system-ui, sans-serif`;

/**
 * Sizes the backing store for the screen's pixel density. Without this the canvas
 * is a fixed bitmap stretched by CSS and looks soft on high-DPI displays.
 */
export function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    canvas.style.aspectRatio = `${CANVAS_W} / ${CANVAS_H}`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    return ctx;
}

// --------------------------------------------------------------- primitives

export function drawBlob(ctx, x, y, radius, fill = 'rgba(0, 0, 0, 0.62)') {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}

/** Open marker for a phenomenological (effective) vertex. */
function drawEffectiveBlob(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    drawBlob(ctx, x, y, radius);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(27, 34, 28, 0.4)';
    ctx.stroke();
}

function arrowHead(ctx, x, y, angle, size = 11) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle - Math.PI / 6), y - size * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * Math.cos(angle + Math.PI / 6), y - size * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function text(ctx, str, x, y, colour = INK, size = 30, align = 'left') {
    ctx.save();
    ctx.font = FONT(size);
    ctx.fillStyle = colour;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
}

/**
 * Curly brace drawn as two quadratic arcs meeting in a central cusp.
 * `x` is the spine, spanning yTop..yBottom, opening toward `dir` (+1 right, -1 left).
 */
export function drawBrace(ctx, x, yTop, yBottom, dir, colour = HADRON_COLOUR, width = 2.2) {
    const mid = (yTop + yBottom) / 2;
    const depth = 7;
    const cusp = depth * 1.5;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.quadraticCurveTo(x + dir * depth, yTop, x + dir * depth, (yTop + mid) / 2);
    ctx.quadraticCurveTo(x + dir * depth, mid, x + dir * cusp, mid);
    ctx.quadraticCurveTo(x + dir * depth, mid, x + dir * depth, (mid + yBottom) / 2);
    ctx.quadraticCurveTo(x + dir * depth, yBottom, x, yBottom);
    ctx.stroke();
    ctx.restore();
}

/**
 * A hadron: thick line into a filled blob, then its valence quarks as short stubs
 * grouped by a brace carrying the hadron's name.
 *
 * (x2, y2) is the FREE end -- the end away from the interaction -- because that is
 * where the quark content belongs. Everything is drawn in a rotated frame whose +x
 * runs outward along the line, so the same code serves an incoming hadron on the
 * left and an outgoing one on the right.
 */
export function drawHadron(ctx, engine, x1, y1, x2, y2, symbol, opts = {}) {
    const info = engine.getParticleInfo(symbol);
    const quarks = (info.quarks || []).slice(0, 3);
    const showContent = opts.showContent !== false && quarks.length > 0;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = HADRON_COLOUR;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, 6, 0, Math.PI * 2);
    ctx.fillStyle = HADRON_COLOUR;
    ctx.fill();
    ctx.restore();

    if (!showContent) return;

    const angle = Math.atan2(y2 - y1, x2 - x1);   // outward, away from the vertex
    const stubLen = 30;
    const spread = quarks.length > 2 ? 0.66 : 0.52;

    // Stubs and their labels are placed in screen coordinates, not in a rotated
    // frame: a frame rotated past 90 degrees flips the text direction and the
    // labels end up running back over the diagram.
    quarks.forEach((q, i) => {
        const t = quarks.length === 1 ? 0 : (i / (quarks.length - 1)) * 2 - 1;
        const sa = angle + t * spread;
        const tipX = x2 + Math.cos(sa) * stubLen;
        const tipY = y2 + Math.sin(sa) * stubLen;

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(tipX, tipY);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = INK;
        ctx.stroke();

        text(ctx, q, x2 + Math.cos(sa) * (stubLen + 13), y2 + Math.sin(sa) * (stubLen + 13),
             INK, 17, 'center');
    });

    // The brace is the one thing that does want the rotated frame: it must sit
    // square across the fan of stubs whatever direction the line runs.
    const braceDist = stubLen + 30;
    const half = Math.sin(spread) * (stubLen + 13) + 10;
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    drawBrace(ctx, braceDist, -half, half, 1, HADRON_COLOUR, 2.2);
    ctx.restore();

    const nameDist = braceDist + 26;
    text(ctx, info.label || symbol,
         x2 + Math.cos(angle) * nameDist, y2 + Math.sin(angle) * nameDist,
         HADRON_COLOUR, 21, 'center');
}

/** `flip` reverses the arrowhead, for the cases where fermion flow runs backwards. */
export function drawFermion(ctx, engine, x1, y1, x2, y2, symbol, flip = false) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    arrowHead(ctx, mx, my, flip ? angle + Math.PI : angle);
}

export function drawBoson(ctx, engine, x1, y1, x2, y2, symbol) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLOURS[symbol] || VECTOR;
    for (let i = 0; i <= len; i += 1) ctx.lineTo(i, Math.sin(i * 0.42) * 5);
    ctx.stroke();
    ctx.restore();
}

export function drawScalar(ctx, engine, x1, y1, x2, y2) {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
}

export function drawGluon(ctx, engine, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.max(Math.hypot(dx, dy), 1);
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = GLUON;
    const loops = Math.max(1, Math.floor(len / 14));
    const freq = (loops * Math.PI * 2) / len;
    const amp = 7;
    ctx.moveTo(0, 0);
    for (let xb = 0; xb <= len; xb += 0.5) {
        ctx.lineTo(xb - amp * 0.75 * Math.sin(xb * freq), amp * Math.cos(xb * freq) - amp);
    }
    ctx.stroke();
    ctx.restore();
}

export function isHadronSymbol(engine, symbol) {
    const info = engine.getParticleInfo(symbol);
    return info.panel === 'hadron';
}

/**
 * Canvas units a hadron needs beyond its free end: stub (30) + brace + name.
 * Layouts must reserve this on any side where a hadron terminates, or the
 * valence quarks and the brace get clipped off the edge of the canvas.
 */
const HADRON_PAD = 122;
// A plain line still needs room for its symbol label, which is drawn outside the
// free end and is roughly 30 units wide.
const PLAIN_PAD = 48;

function padFor(engine, symbols) {
    return symbols.some(s => isHadronSymbol(engine, s)) ? HADRON_PAD : PLAIN_PAD;
}

/** Draws one particle line, dispatching on the particle type. */
export function drawParticleLine(ctx, engine, x1, y1, x2, y2, symbol, flipArrow = false) {
    const info = engine.getParticleInfo(symbol);
    if (info.panel === 'hadron') drawHadron(ctx, engine, x1, y1, x2, y2, symbol);
    else if (info.type === 'boson') drawBoson(ctx, engine, x1, y1, x2, y2, symbol);
    else if (info.type === 'scalar') drawScalar(ctx, engine, x1, y1, x2, y2, symbol);
    else if (info.type === 'gluon') drawGluon(ctx, engine, x1, y1, x2, y2, symbol);
    else drawFermion(ctx, engine, x1, y1, x2, y2, symbol, flipArrow);
}

/**
 * Draws an external (observed) line and labels it. Callers pass the FREE end first
 * and the vertex second, so the hadron decoration lands on the outside of the
 * diagram where there is room.
 *
 * Fermion arrows follow particle flow, which depends on which side of the diagram
 * the line is on: an outgoing particle and an incoming antiparticle both point away
 * from the vertex, while an outgoing antiparticle and an incoming particle both
 * point into it. Getting this from the free-end argument order alone would point
 * every outgoing particle's arrow backwards.
 */
function externalLine(ctx, engine, freeX, freeY, vertexX, vertexY, symbol, isIncoming = true) {
    const antiparticle = engine.isAntiparticle(symbol);
    const pointOutward = isIncoming ? antiparticle : !antiparticle;

    if (isHadronSymbol(engine, symbol)) {
        drawHadron(ctx, engine, vertexX, vertexY, freeX, freeY, symbol);
    } else {
        drawParticleLine(ctx, engine, vertexX, vertexY, freeX, freeY, symbol, !pointOutward);
        const dx = freeX - vertexX, dy = freeY - vertexY;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        text(ctx, symbol, freeX + ux * 10, freeY + uy * 10, INK, 30, ux >= 0 ? 'left' : 'right');
    }
}

/** Labels an internal (mediator) line, offset along the normal. */
function mediatorLine(ctx, engine, x1, y1, x2, y2, symbol, side = 1, offset = 24) {
    drawParticleLine(ctx, engine, x1, y1, x2, y2, symbol);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2 - Math.sin(angle) * offset * side;
    const my = (y1 + y2) / 2 + Math.cos(angle) * offset * side;
    text(ctx, symbol, mx, my, INK, 27, 'center');
}

// ------------------------------------------------------- 2 -> 2 renderers

function drawSChannel(ctx, engine, initial, final, channel) {
    const w = CANVAS_W, h = CANVAS_H;
    const v1 = w * 0.38, v2 = w * 0.62, mid = h * 0.5, top = h * 0.27, bot = h * 0.73;
    const L = padFor(engine, initial);
    const R = w - padFor(engine, final);

    drawBlob(ctx, v1, mid, 5);
    drawBlob(ctx, v2, mid, 5);
    externalLine(ctx, engine, L, top, v1, mid, initial[0]);
    externalLine(ctx, engine, L, bot, v1, mid, initial[1]);
    mediatorLine(ctx, engine, v1, mid, v2, mid, channel.mediator, -1, 28);
    externalLine(ctx, engine, R, top, v2, mid, final[0], false);
    externalLine(ctx, engine, R, bot, v2, mid, final[1], false);
}

function drawTChannel(ctx, engine, initial, final, channel) {
    const w = CANVAS_W, h = CANVAS_H;
    const v1 = w * 0.45, v2 = w * 0.55, top = h * 0.28, bot = h * 0.72;
    const L = padFor(engine, initial);
    const R = w - padFor(engine, final);

    drawBlob(ctx, v1, top, 6);
    drawBlob(ctx, v2, bot, 6);
    externalLine(ctx, engine, L, top, v1, top, initial[0]);
    externalLine(ctx, engine, L, bot, v2, bot, initial[1]);
    mediatorLine(ctx, engine, v1, top, v2, bot, channel.mediator, 1, 22);
    externalLine(ctx, engine, R, top, v1, top, final[0], false);
    externalLine(ctx, engine, R, bot, v2, bot, final[1], false);
}

function drawUChannel(ctx, engine, initial, final, channel) {
    const w = CANVAS_W, h = CANVAS_H;
    const v1 = w * 0.45, v2 = w * 0.55, top = h * 0.28, bot = h * 0.72;
    const L = padFor(engine, initial);
    const R = w - padFor(engine, final);

    drawBlob(ctx, v1, top, 6);
    drawBlob(ctx, v2, bot, 6);
    externalLine(ctx, engine, L, top, v1, top, initial[0]);
    externalLine(ctx, engine, L, bot, v2, bot, initial[1]);
    mediatorLine(ctx, engine, v1, top, v2, bot, channel.mediator, -1, 22);
    externalLine(ctx, engine, R, top, v2, bot, final[0], false);
    externalLine(ctx, engine, R, bot, v1, top, final[1], false);
}

function drawContactChannel(ctx, engine, initial, final) {
    const w = CANVAS_W, h = CANVAS_H;
    const cx = w * 0.5, cy = h * 0.5, top = h * 0.22, bot = h * 0.78;
    const L = padFor(engine, initial);
    const R = w - padFor(engine, final);

    drawBlob(ctx, cx, cy, 6);
    externalLine(ctx, engine, L, top, cx, cy, initial[0]);
    externalLine(ctx, engine, L, bot, cx, cy, initial[1]);
    externalLine(ctx, engine, R, top, cx, cy, final[0], false);
    externalLine(ctx, engine, R, bot, cx, cy, final[1], false);
}

// -------------------------------------------------------- decay renderer

/**
 * Lays a decay tree out left to right. Leaves get evenly spaced vertical slots and
 * each internal node sits at the mean height of its children, so no lines cross.
 */
function layoutTree(tree) {
    const leafNodes = [];
    const collect = (node) => {
        if (!node.children) { leafNodes.push(node); return; }
        node.children.forEach(collect);
    };
    collect(tree);

    const slots = new Map();
    leafNodes.forEach((leaf, i) => slots.set(leaf, i));

    const depthOf = new Map();
    const assignDepth = (node, d) => {
        depthOf.set(node, d);
        if (node.children) node.children.forEach(c => assignDepth(c, d + 1));
    };
    assignDepth(tree, 0);

    return { leafNodes, slots, depthOf, maxDepth: Math.max(...depthOf.values()) };
}

/**
 * `parentOrFusion` is either the single decaying particle, or the two initial
 * particles that fuse into the mediator at the root of the tree (s-channel with
 * more than two final-state particles).
 */
function drawDecayTree(ctx, engine, parentOrFusion, tree) {
    const w = CANVAS_W, h = CANVAS_H;
    const { leafNodes, slots, depthOf, maxDepth } = layoutTree(tree);
    const n = leafNodes.length;

    const topPad = 62, botPad = 62;
    const usable = h - topPad - botPad;
    const step = n > 1 ? usable / (n - 1) : 0;
    const yOf = (index) => topPad + (n > 1 ? index * step : usable / 2);

    const incoming = Array.isArray(parentOrFusion) ? parentOrFusion : [parentOrFusion];
    const leftPad = padFor(engine, incoming);
    const rightPad = padFor(engine, leafNodes.map(l => l.symbol));
    // Root at xStart, leaves exactly at xEnd, with room for hadron decoration outside both.
    const xStart = leftPad + (incoming.length > 1 ? 120 : 54);
    const xEnd = w - rightPad;
    const xOf = (d) => (maxDepth === 0 ? xStart : xStart + (d / maxDepth) * (xEnd - xStart));

    const pos = new Map();
    const place = (node) => {
        let y;
        if (!node.children) y = yOf(slots.get(node));
        else {
            node.children.forEach(place);
            y = node.children.reduce((a, c) => a + pos.get(c).y, 0) / node.children.length;
        }
        pos.set(node, { x: xOf(depthOf.get(node)), y });
    };
    place(tree);

    const rootPos = pos.get(tree);

    // Incoming particle, or two particles fusing on the root vertex.
    if (incoming.length === 1) {
        externalLine(ctx, engine, leftPad, rootPos.y, rootPos.x, rootPos.y, incoming[0]);
    } else {
        const spread = Math.min(70, usable * 0.35);
        externalLine(ctx, engine, leftPad, rootPos.y - spread, rootPos.x, rootPos.y, incoming[0]);
        externalLine(ctx, engine, leftPad, rootPos.y + spread, rootPos.x, rootPos.y, incoming[1]);
    }

    const walk = (node) => {
        if (!node.children) return;
        const here = pos.get(node);
        if (node.effective) drawEffectiveBlob(ctx, here.x, here.y, 6);
        else drawBlob(ctx, here.x, here.y, 5);

        for (const child of node.children) {
            const there = pos.get(child);
            if (child.children) {
                mediatorLine(ctx, engine, here.x, here.y, there.x, there.y, child.symbol, 1, 22);
            } else {
                externalLine(ctx, engine, there.x, there.y, here.x, here.y, child.symbol, false);
            }
        }
        node.children.forEach(walk);
    };
    walk(tree);
}

// --------------------------------------------------- quark flow renderer

/**
 * Lays out the mediator (and anything else emitted alongside the outgoing
 * hadron) inside a horizontal band above or below the quark rails. Reuses the
 * same slot/mean-height scheme as the decay tree, so it cannot produce crossing
 * lines within the branch.
 */
function layoutBranch(nodes, xStart, xEnd, yTop, yBottom) {
    const pos = new Map();
    if (!nodes.length) return pos;

    const leaves = [];
    const collect = (node) => {
        if (!node.children) { leaves.push(node); return; }
        node.children.forEach(collect);
    };
    nodes.forEach(collect);

    const slots = new Map();
    leaves.forEach((leaf, i) => slots.set(leaf, i));
    const yOf = (i) => (leaves.length > 1
        ? yTop + (i / (leaves.length - 1)) * (yBottom - yTop)
        : (yTop + yBottom) / 2);

    const depthOf = new Map();
    const assign = (node, d) => {
        depthOf.set(node, d);
        if (node.children) node.children.forEach(c => assign(c, d + 1));
    };
    nodes.forEach(node => assign(node, 0));
    const maxDepth = Math.max(...[...depthOf.values()]);

    // The deepest level lands exactly on xEnd, one level back sits halfway in.
    const xOf = (d) => xStart + ((d + 1) / (maxDepth + 1)) * (xEnd - xStart);

    const place = (node) => {
        let y;
        if (!node.children) y = yOf(slots.get(node));
        else {
            node.children.forEach(place);
            y = node.children.reduce((a, c) => a + pos.get(c).y, 0) / node.children.length;
        }
        pos.set(node, { x: xOf(depthOf.get(node)), y });
    };
    nodes.forEach(place);
    return pos;
}

/**
 * A hadron -> hadron transition drawn as independent quark lines.
 *
 *   } n    d ─────────────●─────────── u   } p
 *          u ─────────────┼─────────── u
 *          d ─────────────┼─────────── d
 *                         ╲
 *                          W⁻ ── e⁻ ν̄e
 *
 * Spectators run straight from the source brace to the target brace; the active
 * quark kinks at the interaction vertex, where the mediator branches off. The
 * mediator is sent to whichever side of the rails its vertex is nearer, so its
 * line does not have to cross the other quarks.
 */
function drawQuarkFlowDiagram(ctx, engine, spec) {
    const w = CANVAS_W, h = CANVAS_H;
    const { from, to, others, flow } = spec;
    const rails = flow.rails;

    const leftPad = padFor(engine, [from]);
    const rightPad = padFor(engine, [to]);
    const quarkStart = leftPad - 18;
    const quarkEnd = w - rightPad + 18;
    const vertexX = quarkStart + (quarkEnd - quarkStart) * 0.42;

    // The vertex sits on an active rail so that quark kinks there.
    let activeIdx = rails.findIndex(r => r.role === 'active');
    if (activeIdx < 0) activeIdx = Math.floor(rails.length / 2);

    const railSpacing = 48;
    const railsHeight = (rails.length - 1) * railSpacing;
    const branchHeight = 140;
    const gap = 58;

    // Send the mediator away from the vertex on the nearer side.
    const below = activeIdx >= rails.length / 2;
    const blockHeight = railsHeight + gap + branchHeight;
    const blockTop = Math.max(24, (h - blockHeight) / 2);

    let railsTop, branchTop, branchBottom;
    if (below) {
        railsTop = blockTop;
        branchTop = blockTop + railsHeight + gap;
        branchBottom = branchTop + branchHeight;
    } else {
        branchTop = blockTop;
        branchBottom = blockTop + branchHeight;
        railsTop = branchTop + branchHeight + gap;
    }
    const railY = (i) => railsTop + i * railSpacing;
    const vertexY = railY(activeIdx);

    // ---------------------------------------------------------- quark rails
    rails.forEach((r, i) => {
        const y = railY(i);
        if (r.role === 'spectator') {
            drawFermion(ctx, engine, quarkStart, y, quarkEnd, y, r.fromQuark, isAntiQuark(r.fromQuark));
            text(ctx, r.fromQuark, quarkStart + 16, y - 15, INK, 19, 'left');
        } else {
            drawFermion(ctx, engine, quarkStart, y, vertexX, vertexY, r.fromQuark, isAntiQuark(r.fromQuark));
            drawFermion(ctx, engine, vertexX, vertexY, quarkEnd, y, r.toQuark, isAntiQuark(r.toQuark));
            text(ctx, r.fromQuark, quarkStart + 16, y - 15, INK, 19, 'left');
            text(ctx, r.toQuark, quarkEnd - 16, y - 15, INK, 19, 'right');
        }
    });

    // ------------------------------------------------------------- the vertex
    if (spec.effective) drawEffectiveBlob(ctx, vertexX, vertexY, 6);
    else drawBlob(ctx, vertexX, vertexY, 6);

    // --------------------------------------------- mediator and other products
    const branchPos = layoutBranch(others, vertexX, quarkEnd, branchTop, branchBottom);
    const drawBranch = (node, parentX, parentY) => {
        const here = branchPos.get(node);
        if (!here) return;

        if (node.children) {
            // A mediator that decays on. Drawn as an internal line, so its arrow
            // direction is a convention rather than an observable.
            drawParticleLine(ctx, engine, parentX, parentY, here.x, here.y, node.symbol);
            labelMidway(ctx, node.symbol, parentX, parentY, here.x, here.y);
            if (node.effective) drawEffectiveBlob(ctx, here.x, here.y, 5);
            else drawBlob(ctx, here.x, here.y, 5);
            node.children.forEach(c => drawBranch(c, here.x, here.y));
        } else {
            // A final-state particle leaving the vertex. It is outgoing, so a
            // particle's arrow points away and an antiparticle's points back in.
            drawParticleLine(ctx, engine, parentX, parentY, here.x, here.y, node.symbol,
                             engine.isAntiparticle(node.symbol));
            text(ctx, node.symbol, here.x, here.y + (below ? 20 : -20), INK, 22, 'center');
        }
    };
    others.forEach(node => drawBranch(node, vertexX, vertexY));

    // ------------------------------------------------------------- brackets
    const top = railY(0) - 24;
    const bottom = railY(rails.length - 1) + 24;
    const midY = (railY(0) + railY(rails.length - 1)) / 2;

    // A brace's cusp points away from the quarks it groups.
    drawBrace(ctx, quarkStart - 22, top, bottom, -1, HADRON_COLOUR, 2.2);
    text(ctx, engine.getParticleInfo(from).label || from, quarkStart - 38, midY, HADRON_COLOUR, 22, 'right');

    drawBrace(ctx, quarkEnd + 22, top, bottom, 1, HADRON_COLOUR, 2.2);
    text(ctx, engine.getParticleInfo(to).label || to, quarkEnd + 38, midY, HADRON_COLOUR, 22, 'left');
}

/** Symbol label offset from the midpoint of a line, clear of the line itself. */
function labelMidway(ctx, symbol, x1, y1, x2, y2) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const mx = (x1 + x2) / 2 - Math.sin(angle) * 22;
    const my = (y1 + y2) / 2 + Math.cos(angle) * 22;
    text(ctx, symbol, mx, my, INK, 22, 'center');
}

// ------------------------------------------------------------- entry point

export function drawDiagram(ctx, engine, channel, initial, final) {
    switch (channel.type) {
        case 's-channel':
            if (channel.fusion && channel.tree) {
                drawDecayTree(ctx, engine, channel.fusion, channel.tree);
            } else if (channel.tree) {
                drawDecayTree(ctx, engine, initial[0], channel.tree);
            } else {
                drawSChannel(ctx, engine, initial, final, channel);
            }
            break;
        case 't-channel':
        case 't/u-channel': drawTChannel(ctx, engine, initial, final, channel); break;
        case 'u-channel': drawUChannel(ctx, engine, initial, final, channel); break;
        case 'contact': drawContactChannel(ctx, engine, initial, final); break;
        case 'decay': {
            // A hadron turning into another hadron is drawn as independent quark
            // lines. Anything the flow cannot describe falls back to the blob.
            const spec = findHadronTransition(engine, channel.tree);
            if (spec) drawQuarkFlowDiagram(ctx, engine, spec);
            else drawDecayTree(ctx, engine, initial[0], channel.tree);
            break;
        }
        default:
            text(ctx, `No renderer for "${channel.type}"`, 20, 30, '#8b3a3a', 16);
    }
}

/** Names the tree shape so the four 1->4 topologies stay distinguishable. */
export function describeShape(channel) {
    const tree = channel.tree;
    if (!tree || !tree.children) return '';
    if (channel.multiplicity <= 2) return '';

    const rootChildren = tree.children;
    if (rootChildren.length === 3) return 'contact vertex';

    const branching = rootChildren.filter(c => c.children);
    if (branching.length === 0) return 'direct';
    if (branching.length === 2) return 'two-mediator';

    const only = branching[0];
    if (only.children.length === 3) return '2-body then contact';
    if (only.children.some(c => c.children)) return 'linear chain';
    return 'cascade';
}

/** Human-readable title for a channel card. */
export function channelTitle(channel, initial, final) {
    const external = channel.external || final;
    const reaction = `${initial.join(' ')} → ${external.join(' ')}`;

    if (channel.type === 'decay') {
        const shape = describeShape(channel);
        return `${reaction} · ${channel.multiplicity}-body decay${shape ? ` · ${shape}` : ''}`;
    }
    if (channel.type === 's-channel' && channel.tree && channel.multiplicity > 2) {
        const shape = describeShape(channel);
        return `${reaction} · s-channel cascade via ${channel.mediator}${shape ? ` · ${shape}` : ''}`;
    }

    const kind = {
        's-channel': 's-channel',
        't-channel': 't-channel',
        'u-channel': 'u-channel',
        't/u-channel': 't / u-channel (identical finals)',
        'contact': 'contact interaction'
    }[channel.type] || channel.type;

    return `${reaction} · ${kind}${channel.mediator && channel.mediator !== 'none' ? ` · ${channel.mediator}` : ''}`;
}
