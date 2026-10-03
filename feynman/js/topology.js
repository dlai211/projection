// js/topology.js
// Diagram search. Replaces the old brute-force "try every combination of every
// particle" approach, which was about to fall over once hadrons and 4-body decays
// multiplied the particle list.
//
// The core idea is a recursive expansion of one particle into a decay tree:
//
//   grow(P, budget) = every way P can become exactly `budget` external particles
//
// A node is either a LEAF (it stays as an observed final-state particle) or a
// BRANCH (it decays through one vertex into k children, each of which gets a share
// of the budget). Because a branch always splits the budget between at least two
// children, every child's budget is strictly smaller, so the recursion terminates
// without needing a cycle guard.
//
// This one rule generates every tree-level shape. Verified against the tree
// identity 3*V3 + 4*V4 = E + 2*I, which says a 1->4 decay has either three 3-point
// vertices or one 4-point plus one 3-point -- exactly the shapes below:
//
//   1->2  direct vertex                 P -> a b
//   1->3  cascade                       P -> a X, X -> b c
//   1->3  direct / contact              P -> a b c              (4-point vertex)
//   1->4  linear chain                  P -> a X, X -> b Y, Y -> c d
//   1->4  two-mediator                  P -> X Y, X -> a b, Y -> c d
//   1->4  direct-then-decay             P -> a b X, X -> c d
//   1->4  decay-then-direct             P -> a X, X -> b c d
//
// The two-mediator shape is the h -> W+W- -> 4 fermion diagram. It is not reachable
// from the other three and is the one most often missed.

import { splits } from './classifier.js';

const DEFAULTS = {
    maxMultiplicity: 4,
    maxResults: 800
};

/** Stable string form of a tree, with identical siblings sorted, used for dedup. */
function canonical(node) {
    if (!node.children) return node.symbol;
    const inner = node.children.map(canonical).sort().join(',');
    return `${node.symbol}(${inner})`;
}

/** The external (leaf) particles of a tree. */
function leaves(node, out = []) {
    if (!node.children) { out.push(node.symbol); return out; }
    for (const child of node.children) leaves(child, out);
    return out;
}

/** Flatten a tree into the list of internal vertices, parent first. */
function steps(node, out = []) {
    if (!node.children) return out;
    out.push({
        parent: node.symbol,
        children: node.children.map(c => c.symbol),
        effective: Boolean(node.effective),
        process: node.process
    });
    for (const child of node.children) steps(child, out);
    return out;
}

/**
 * True when every leaf occurs in `target` at least as many times as in `leaves`.
 *
 * The filter has to be a sub-multiset test, not an equality test. An intermediate
 * subtree sees only part of the final state -- the W- branch of
 * mu- -> e- anti-nu_e nu_mu produces just [e-, anti-nu_e] -- so demanding an exact
 * match at every node would prune away every cascade. At the root the leaf count
 * equals the target length, so the sub-multiset test becomes an exact match.
 */
function isSubMultiset(leafList, target) {
    if (!target) return true;
    const pool = new Map();
    for (const t of target) pool.set(t, (pool.get(t) || 0) + 1);
    for (const leaf of leafList) {
        const left = pool.get(leaf) || 0;
        if (left === 0) return false;
        pool.set(leaf, left - 1);
    }
    return true;
}

/**
 * Enumerates every decay tree of `parent` producing exactly `budget` external
 * particles.
 *
 * `remaining` is the mass still available to this subtree. It is a pruning bound
 * only: a subtree is skipped when its lightest possible final state already
 * outweighs what is left. Nothing here decides whether the diagram is physical --
 * that is checked once at the root, because internal lines are off-shell.
 */
function grow(engine, parent, budget, ctx, remaining) {
    const results = [];
    if (ctx.aborted || remaining <= 0) return results;

    // Necessary condition: can this subtree fit in the mass still available?
    if (engine.minLeafMass(parent, budget) >= remaining) return results;

    // Leaf: this particle is itself one of the observed final-state particles.
    if (budget === 1) {
        if (!ctx.target || ctx.target.includes(parent)) {
            results.push({ symbol: parent, leaf: true });
        }
        return results;
    }

    for (const channel of engine.decaysOf(parent)) {
        if (ctx.aborted || results.length >= ctx.maxResults) break;
        const products = channel.products;
        const k = products.length;
        if (k > budget) continue;

        for (const dist of splits(budget, k)) {
            if (ctx.aborted || results.length >= ctx.maxResults) break;

            // Mass each sibling needs, so a child knows what is left for it.
            const childFloor = dist.map((d, i) => engine.minLeafMass(products[i], d));
            if (childFloor.some(v => !isFinite(v))) continue;
            const totalFloor = childFloor.reduce((a, b) => a + b, 0);
            if (totalFloor >= remaining) continue;

            const childOptions = [];
            let viable = true;
            for (let i = 0; i < k; i++) {
                const options = grow(engine, products[i], dist[i], ctx,
                                     remaining - (totalFloor - childFloor[i]));
                if (options.length === 0) { viable = false; break; }
                childOptions.push(options);
            }
            if (!viable) continue;

            // Cartesian product across the children's option lists.
            const combine = (index, picked) => {
                if (ctx.aborted || results.length >= ctx.maxResults) return;
                if (index === childOptions.length) {
                    const node = { symbol: parent, children: picked.slice(),
                                   effective: channel.effective, process: channel.process,
                                   quarkFlow: channel.quarkFlow };
                    if (!isSubMultiset(leaves(node), ctx.target)) return;
                    const key = canonical(node);
                    if (ctx.seen.has(key)) return;
                    ctx.seen.add(key);
                    results.push(node);
                    return;
                }
                for (const option of childOptions[index]) {
                    picked.push(option);
                    combine(index + 1, picked);
                    picked.pop();
                }
            };
            combine(0, []);
        }
    }

    return results;
}

/** Wraps a raw tree into the channel object the renderer consumes. */
function toChannel(engine, root, tree) {
    const external = leaves(tree).sort();
    const vertexSteps = steps(tree);

    // The mediator is the first decay product that is NOT itself observed, i.e.
    // the internal line. A contact decay like n -> p e- anti-nu_e has no internal
    // line at all, so it correctly reports none rather than naming a final-state
    // particle as the mediator.
    const externalSet = new Set(external);
    let mediator = null;
    for (const step of vertexSteps) {
        const internal = step.children.find(c => !externalSet.has(c));
        if (internal) { mediator = internal; break; }
    }

    return {
        type: 'decay',
        multiplicity: external.length,
        parent: root,
        external,
        tree,
        steps: vertexSteps,
        effective: vertexSteps.some(s => s.effective),
        mediator
    };
}

/**
 * All decay topologies of `parent` into exactly `target` (or into anything when
 * target is null, for multiplicities 2..maxMultiplicity).
 */
export function decayTopologies(engine, parent, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const results = [];
    const globalSeen = new Set();

    const multiplicities = opts.target
        ? [opts.target.length]
        : Array.from({ length: opts.maxMultiplicity - 1 }, (_, i) => i + 2);

    for (const m of multiplicities) {
        if (m < 2 || m > opts.maxMultiplicity) continue;
        const ctx = {
            target: opts.target || null,
            seen: new Set(),
            aborted: false,
            maxResults: opts.maxResults - results.length
        };
        if (ctx.maxResults <= 0) break;

        // Only the root is on-shell. A massless root is a virtual splitting, so it
        // gets no mass budget at all -- otherwise gamma -> e+ e- would be pruned.
        const rootMass = engine.getMass(parent);
        const remaining = rootMass > 0 ? rootMass : Infinity;

        const trees = grow(engine, parent, m, ctx, remaining);
        for (const tree of trees) {
            const key = canonical(tree);
            if (globalSeen.has(key)) continue;
            globalSeen.add(key);
            const channel = toChannel(engine, parent, tree);

            // The one exact kinematic test: the finished final state must be
            // lighter than the decaying particle.
            if (!engine.isKinematicallyAllowed(parent, channel.external)) continue;
            results.push(channel);
        }
    }

    return { channels: results, truncated: results.length >= opts.maxResults };
}

/** Scattering channels: 2->2 contact, s / t / u, and s-channel to more than 2. */
function scatteringTopologies(engine, initial, target) {
    const [A, B] = initial;
    const channels = [];

    if (target && target.length === 2) {
        const [C, D] = target;

        const contact = engine.matchVertex(initial, target);
        if (contact && ((contact.in || []).length === 2 && (contact.out || []).length === 2)) {
            channels.push({ type: 'contact', mediator: 'none', effective: Boolean(contact.effective),
                            external: [...target] });
        }

        for (const fusion of engine.fusionsOf(A, B)) {
            const X = fusion.products[0];
            if (engine.checkVertex([X], target)) {
                channels.push({ type: 's-channel', mediator: X, external: [...target] });
            }
        }

        for (const vertex of engine.vertices) {
            for (const part of engine.partitions(vertex, 1)) {
                if (part.outputs.length !== 2) continue;
                const [p1, p2] = part.outputs;
                if (part.inputs[0] !== A) continue;
                if ((p1 === C && engine.checkVertex([B, p2], [D])) ||
                    (p2 === C && engine.checkVertex([B, p1], [D]))) {
                    channels.push({ type: 't-channel', mediator: p1 === C ? p2 : p1, external: [...target] });
                }
                if ((p1 === D && engine.checkVertex([B, p2], [C])) ||
                    (p2 === D && engine.checkVertex([B, p1], [C]))) {
                    channels.push({ type: 'u-channel', mediator: p1 === D ? p2 : p1, external: [...target] });
                }
            }
        }
    }

    // s-channel into three or more particles: the mediator decays on. The `fusion`
    // marker tells the renderer that the two initial particles converge on the
    // mediator, rather than the mediator being the decaying particle itself.
    if (!target || target.length > 2) {
        for (const fusion of engine.fusionsOf(A, B)) {
            const X = fusion.products[0];
            const found = decayTopologies(engine, X, { target: target || null });
            for (const channel of found.channels) {
                if (target && channel.external.length !== target.length) continue;
                if (!engine.checkConservation(initial, channel.external).valid) continue;
                channels.push({ type: 's-channel', mediator: X, fusion: [A, B],
                                ...channel, external: channel.external });
            }
        }
    }

    return channels;
}

/**
 * Main entry point. Returns { type, channels, reason }.
 *   initial: array of particle symbols (1 or 2 of them)
 *   final:   array of particle symbols, or [] to search for every possibility
 */
export function findProcesses(engine, initial, final, options = {}) {
    if (!initial.length) return { type: 'invalid', reason: 'Add initial particles' };

    if (final.length) {
        const conservation = engine.checkConservation(initial, final);
        if (!conservation.valid) return { type: 'invalid', reason: conservation.reason };

        let channels = [];
        if (initial.length === 1) {
            channels = decayTopologies(engine, initial[0], { ...options, target: final }).channels;
        } else if (initial.length === 2) {
            channels = scatteringTopologies(engine, initial, final);
        }

        channels = dedupe(channels).map(c => tagPair(c, initial, final));
        if (!channels.length) {
            return { type: 'invalid', reason: 'No valid tree-level Feynman diagrams found.' };
        }
        return { type: 'valid', channels };
    }

    // No final state given: enumerate everything reachable.
    let channels = [];

    if (initial.length === 1) {
        const found = decayTopologies(engine, initial[0], options);
        channels = found.channels.filter(c => engine.checkConservation(initial, c.external).valid);
        channels = dedupe(channels);
        if (!channels.length) {
            return { type: 'invalid', reason: 'No valid tree-level decays found for this initial state.' };
        }
        return { type: 'valid', channels, truncated: found.truncated };
    }

    if (initial.length === 2) {
        for (const fusion of engine.fusionsOf(initial[0], initial[1])) {
            const X = fusion.products[0];
            const found = decayTopologies(engine, X, options);
            for (const channel of found.channels) {
                if (!engine.checkConservation(initial, channel.external).valid) continue;
                channels.push({ type: 's-channel', mediator: X, fusion: [...initial], ...channel });
            }
        }
        channels = dedupe(channels);
        if (!channels.length) {
            return { type: 'invalid', reason: 'No valid tree-level processes found for this initial state.' };
        }
        return { type: 'valid', channels };
    }

    return { type: 'invalid', reason: 'Unsupported number of initial particles.' };
}

/**
 * Marks t- and u-channel diagrams that are the same picture because the two
 * final-state particles are identical (Moller scattering is the standard case).
 * Collapsing them is a large readability win in the output grid.
 */
function tagPair(channel, initial, final) {
    const [C, D] = final || [];
    if (!C || C !== D) return channel;
    if (channel.type === 't-channel') return { ...channel, type: 't/u-channel' };
    if (channel.type === 'u-channel') return { ...channel, type: 't/u-channel' };
    return channel;
}

/** Collapses channels that describe the same physics. */
function dedupe(channels) {
    const seen = new Set();
    const out = [];
    for (const channel of channels) {
        const key = [
            channel.type,
            channel.mediator || '',
            [...(channel.external || [])].sort().join(','),
            channel.tree ? canonical(channel.tree) : ''
        ].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(channel);
    }
    return out;
}

export { canonical, leaves };
