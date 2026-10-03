// js/quarkflow.js
// Works out the valence quark flow for a hadron -> hadron transition, so the
// renderer can draw one line per quark instead of a single hadron line.
//
// The picture is the standard spectator diagram: quarks that keep their flavour
// run straight through from the source brace to the target brace, while the ones
// that change flavour are "active" and meet at the interaction vertex where the
// mediator is emitted.
//
//   n = u d d  ->  p = u u d
//
//     d ─────────────●────────── u      the active d becomes a u at the vertex
//     u ─────────────┼────────── u      spectators pass straight through
//     d ─────────────┼────────── d
//                    ╲
//                     W⁻ ── e⁻ ν̄e
//
// The flow is derived from the valence content, so no per-vertex data is needed.
// A vertex may still declare `quarkFlow` explicitly, which takes precedence and
// is validated against the real quark content before being trusted.

import { isAntiQuark, quarkFlavour } from './hadrons.js';

/**
 * Describes one quark line running across the diagram.
 *   role 'spectator' — flavour unchanged, drawn straight through
 *   role 'active'    — flavour changes, routed via the interaction vertex
 * `fromIndex` / `toIndex` are positions within the hadrons' valence lists, which
 * fixes the vertical order of the rails.
 */
function rail(role, fromIndex, fromQuark, toIndex, toQuark) {
    return { role, fromIndex, fromQuark, toIndex, toQuark };
}

/** Matches quarks by flavour *and* by particle/antiparticle nature. */
function sameQuark(a, b) {
    return quarkFlavour(a) === quarkFlavour(b) && isAntiQuark(a) === isAntiQuark(b);
}

/**
 * Derives the flow by taking the largest possible set of unchanged quarks as
 * spectators and pairing whatever is left over at the vertex.
 * Returns null when the two hadrons' valence contents cannot be reconciled.
 */
export function deriveQuarkFlow(fromQuarks, toQuarks) {
    if (!Array.isArray(fromQuarks) || !Array.isArray(toQuarks)) return null;
    if (!fromQuarks.length || !toQuarks.length) return null;

    const takenTo = new Set();
    const rails = [];
    const activeFrom = [];
    const activeTo = [];

    // Spectators first: any source quark that reappears in the target.
    fromQuarks.forEach((q, i) => {
        const j = toQuarks.findIndex((t, k) => !takenTo.has(k) && sameQuark(q, t));
        if (j === -1) return;
        takenTo.add(j);
        rails.push(rail('spectator', i, q, j, toQuarks[j]));
    });

    fromQuarks.forEach((q, i) => {
        if (rails.some(r => r.role === 'spectator' && r.fromIndex === i)) return;
        activeFrom.push({ index: i, quark: q });
    });
    toQuarks.forEach((t, j) => {
        if (takenTo.has(j)) return;
        activeTo.push({ index: j, quark: t });
    });

    // The active quarks all meet at one vertex, so the two sides have to balance.
    // A mismatch means this is not a simple spectator transition.
    if (activeFrom.length !== activeTo.length) return null;
    // A baryon cannot become a meson, and vice versa.
    if (fromQuarks.length !== toQuarks.length) return null;

    activeFrom.forEach((s, k) => {
        rails.push(rail('active', s.index, s.quark, activeTo[k].index, activeTo[k].quark));
    });

    rails.sort((a, b) => a.fromIndex - b.fromIndex);

    return {
        rails,
        changed: activeFrom.length > 0,
        activeIn: activeFrom.map(a => a.quark),
        activeOut: activeTo.map(a => a.quark)
    };
}

/**
 * Validates a declared `quarkFlow` against the real valence content.
 *
 * Format on an effective vertex:
 *   quarkFlow: { spectator: [['u','u'], ['d','d']], active: [['d','u']] }
 * where each pair is [sourceQuark, targetQuark].
 *
 * A declaration that does not type-check against the hadrons is rejected rather
 * than drawn, so stale data degrades to the derived result instead of producing
 * a nonsense diagram.
 */
export function applyQuarkFlowOverride(fromQuarks, toQuarks, override) {
    if (!override) return null;

    const pairs = [
        ...(override.spectator || []).map(([a, b]) => ['spectator', a, b]),
        ...(override.active || []).map(([a, b]) => ['active', a, b])
    ];
    if (!pairs.length) return null;
    if (pairs.length !== fromQuarks.length || pairs.length !== toQuarks.length) return null;

    const usedFrom = new Set();
    const usedTo = new Set();
    const rails = [];

    for (const [role, a, b] of pairs) {
        const i = fromQuarks.findIndex((q, k) => !usedFrom.has(k) && sameQuark(q, a));
        const j = toQuarks.findIndex((t, k) => !usedTo.has(k) && sameQuark(t, b));
        if (i === -1 || j === -1) return null;
        if (role === 'spectator' && !sameQuark(a, b)) return null;
        if (role === 'active' && sameQuark(a, b)) return null;
        usedFrom.add(i);
        usedTo.add(j);
        rails.push(rail(role, i, fromQuarks[i], j, toQuarks[j]));
    }

    rails.sort((x, y) => x.fromIndex - y.fromIndex);
    const active = rails.filter(r => r.role === 'active');
    return {
        rails,
        changed: active.length > 0,
        activeIn: active.map(r => r.fromQuark),
        activeOut: active.map(r => r.toQuark),
        fromOverride: true
    };
}

/**
 * Full flow for a transition. `override` is optional and comes from the vertex.
 * Returns null whenever the flow cannot be determined, in which case the caller
 * falls back to the plain hadron-blob rendering.
 */
export function computeQuarkFlow(engine, fromSymbol, toSymbol, override) {
    const from = engine.getParticleInfo(fromSymbol);
    const to = engine.getParticleInfo(toSymbol);
    if (!from.quarks || !to.quarks) return null;

    return applyQuarkFlowOverride(from.quarks, to.quarks, override)
        || deriveQuarkFlow(from.quarks, to.quarks);
}

/**
 * Finds the transition this decay tree describes, or null if it is not the
 * simple one-hadron-to-one-hadron case.
 *
 * Requirements: the decaying particle is a hadron, exactly one of its children is
 * a hadron, that child is a final state (not decaying further), and the quark
 * counts match. Anything else keeps the existing rendering.
 */
export function findHadronTransition(engine, tree) {
    if (!tree || !tree.children) return null;
    if (!engine.isHadron(tree.symbol)) return null;

    const hadronChildren = tree.children.filter(c => engine.isHadron(c.symbol));
    if (hadronChildren.length !== 1) return null;

    const target = hadronChildren[0];
    if (target.children) return null;

    const from = engine.getParticleInfo(tree.symbol);
    const to = engine.getParticleInfo(target.symbol);
    if (!from.quarks || !to.quarks) return null;

    const others = tree.children.filter(c => c !== target);
    const flow = computeQuarkFlow(engine, tree.symbol, target.symbol, tree.quarkFlow);
    if (!flow) return null;

    return {
        from: tree.symbol,
        to: target.symbol,
        others,
        flow,
        effective: Boolean(tree.effective)
    };
}
