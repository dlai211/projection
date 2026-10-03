// js/classifier.js
// Engine primitives: particle lookup, crossing, conservation laws and kinematics.
//
// The actual diagram search lives in topology.js, which builds on this class.

import { PARTICLES } from './particles.js';
import { HADRONS } from './hadrons.js';
import { ALL_VERTICES } from './vertices.js';

/** Tolerance in MeV when comparing masses, so exact-threshold decays are not lost. */
const MASS_TOLERANCE = 0.5;

/** Every way to write `total` as an ordered sum of `parts` positive integers. */
export function splits(total, parts) {
    const out = [];
    if (parts > total) return out;
    const current = new Array(parts).fill(1);
    const walk = (index, remaining) => {
        if (index === parts - 1) {
            if (remaining >= 1) {
                current[index] = remaining;
                out.push(current.slice());
            }
            return;
        }
        const max = remaining - (parts - index - 1);
        for (let v = 1; v <= max; v++) {
            current[index] = v;
            walk(index + 1, remaining - v);
        }
    };
    walk(0, total);
    return out;
}

export class FeynmanEngine {
    constructor() {
        this.particles = { ...PARTICLES, ...HADRONS };
        this.vertices = ALL_VERTICES;
        this.decayIndex = this.buildDecayIndex();
        this.fusionIndex = this.buildFusionIndex();
        this._minLeafCache = new Map();
    }

    // ------------------------------------------------------------- lookup

    getParticleInfo(symbol) {
        const found = this.particles[symbol];
        if (!found) return { type: 'unknown', symbol, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0, m: 0 };
        return found;
    }

    exists(symbol) {
        return Boolean(this.particles[symbol]);
    }

    getAnti(symbol) {
        const info = this.particles[symbol];
        return (info && info.anti) || symbol;
    }

    /** Mass in MeV. Returns 0 for unknown particles. */
    getMass(symbol) {
        const info = this.particles[symbol];
        return info && typeof info.m === 'number' ? info.m : 0;
    }

    isHadron(symbol) {
        return Boolean(HADRONS[symbol]);
    }

    /**
     * True when `symbol` is the antiparticle form of itself. Uses the `anti` field
     * rather than guessing from charge -- the old charge-based heuristic would give
     * a baryon arrow to a pi+.
     */
    isSelfConjugate(symbol) {
        return this.getAnti(symbol) === symbol;
    }

    /**
     * Which member of a particle/antiparticle pair is the antiparticle, decided by
     * the conserved charges rather than by guessing from the name. Baryon number
     * settles baryons and quarks, lepton number settles leptons, and charge then
     * strangeness settle the neutral mesons (K0 vs anti-K0 have no charge to go on).
     */
    isAntiparticle(symbol) {
        const info = this.particles[symbol];
        if (!info || !info.anti || info.anti === symbol) return false;
        if (info.B) return info.B < 0;
        const leptonNumber = (info.Le || 0) + (info.Lmu || 0) + (info.Ltau || 0);
        if (leptonNumber) return leptonNumber < 0;
        if (info.Q) return info.Q < 0;
        if (info.S) return info.S < 0;
        return false;
    }

    // ------------------------------------------------------- crossing

    // Creates a canonical "all incoming" state for symmetry matching.
    getCanonical(inParts, outParts) {
        const canonical = [...inParts, ...outParts.map(p => this.getAnti(p))];
        return canonical.sort();
    }

    /**
     * The "all incoming" signature of a vertex, as a sorted array.
     * { in:['d'], out:['u','W⁻'] } -> ['W⁺','d','ū']
     */
    vertexSignature(vertex) {
        return this.getCanonical(vertex.in || [], vertex.out || []);
    }

    /**
     * Finds the vertex connecting these particles, or null. Crossing symmetry is
     * handled by comparing against both the signature and its fully-antiparticle
     * partner, so a single entry covers every rearrangement.
     */
    matchVertex(inParts, outParts, { includeEffective = true } = {}) {
        const target = this.getCanonical(inParts, outParts);
        const targetAnti = target.map(p => this.getAnti(p)).sort();
        const key = target.join('|');
        const keyAnti = targetAnti.join('|');

        for (const vertex of this.vertices) {
            if (!includeEffective && vertex.effective) continue;
            const base = this.vertexSignature(vertex);
            const baseKey = base.join('|');
            if (baseKey === key || baseKey === keyAnti) return vertex;
        }
        return null;
    }

    checkVertex(inParts, outParts, opts) {
        return Boolean(this.matchVertex(inParts, outParts, opts));
    }

    // ------------------------------------------------- indices

    /**
     * Every partition of a vertex signature with the left-hand side holding
     * `leftSize` particles. Writing S for the signature, a partition into L and R is
     * the process  L -> anti(R).
     *
     * With leftSize 1 the results are the decay forms of the vertex, so
     * { in:['d'], out:['u','W⁻'] } yields d -> u W⁻, ū -> d̄ W⁻ and W⁺ -> d̄ u.
     */
    *partitions(vertex, leftSize) {
        const signature = this.vertexSignature(vertex);
        const n = signature.length;
        if (leftSize > n) return;

        const seen = new Set();
        const indices = [];

        function* choose(start, remaining) {
            if (remaining === 0) {
                yield indices.slice();
                return;
            }
            for (let i = start; i < n; i++) {
                indices.push(i);
                yield* choose(i + 1, remaining - 1);
                indices.pop();
            }
        }

        // Both the signature and its charge conjugate must be walked. Crossing a
        // vertex by antiparticles gives the conjugate process, which is a genuinely
        // different decay -- W+ -> e+ nu_e does not by itself tell you that
        // W- -> e- anti-nu_e exists.
        const signatures = [signature, signature.map(p => this.getAnti(p))];

        for (const sig of signatures) {
            for (const chosen of choose(0, leftSize)) {
                const chosenSet = new Set(chosen);
                const left = chosen.map(i => sig[i]);
                const rightParticles = [];
                for (let i = 0; i < n; i++) if (!chosenSet.has(i)) rightParticles.push(sig[i]);

                const outputs = rightParticles.map(p => this.getAnti(p));
                const key = [...left].sort().join(',') + '->' + [...outputs].sort().join(',');
                if (seen.has(key)) continue;
                seen.add(key);
                yield { inputs: left, outputs, vertex };
            }
        }
    }

    /** Map: particle -> [{ parent, products, effective, vertex }] for every 1->2 or 1->3 decay. */
    buildDecayIndex() {
        const index = new Map();
        const add = (parent, products, vertex) => {
            if (!index.has(parent)) index.set(parent, []);
            const list = index.get(parent);
            const key = [...products].sort().join(',');
            if (list.some(e => [...e.products].sort().join(',') === key)) return;
            list.push({ parent, products, effective: Boolean(vertex.effective),
                        process: vertex.process, points: vertex.points || (products.length + 1),
                        // Optional hand-declared valence quark flow, used by the renderer
                        // in preference to deriving it. See js/quarkflow.js.
                        quarkFlow: vertex.quarkFlow });
        };

        for (const vertex of this.vertices) {
            for (const part of this.partitions(vertex, 1)) {
                if (part.outputs.length < 2) continue;
                add(part.inputs[0], part.outputs, vertex);
            }
        }
        return index;
    }

    /** Map: 'A,B' -> [{ products, effective }] for every 2->1 fusion. */
    buildFusionIndex() {
        const index = new Map();
        for (const vertex of this.vertices) {
            for (const part of this.partitions(vertex, 2)) {
                if (part.outputs.length !== 1) continue;
                const key = [...part.inputs].sort().join(',');
                if (!index.has(key)) index.set(key, []);
                const list = index.get(key);
                if (list.some(e => e.products[0] === part.outputs[0])) continue;
                list.push({ products: part.outputs, inputs: part.inputs,
                            effective: Boolean(vertex.effective), process: vertex.process });
            }
        }
        return index;
    }

    /** Decay channels of a particle: [{ parent, products, effective }] */
    decaysOf(symbol) {
        return this.decayIndex.get(symbol) || [];
    }

    /** Fusions that produce `mediator` from exactly these two particles. */
    fusionsOf(a, b) {
        return this.fusionIndex.get([a, b].sort().join(',')) || [];
    }

    // ------------------------------------------------- kinematics

    /**
     * Exact check on the *external* particles of a finished decay.
     * A massless parent is allowed through: gamma -> e+ e- and g -> g g are ordinary
     * off-shell splittings, and a literal 0 > 0 test would forbid them.
     */
    isKinematicallyAllowed(parent, products) {
        const parentMass = this.getMass(parent);
        if (parentMass <= 0) return true;
        const sum = products.reduce((acc, p) => acc + this.getMass(p), 0);
        return parentMass > sum + MASS_TOLERANCE;
    }

    /**
     * Smallest total mass of the external particles a subtree can possibly end up
     * with, for `symbol` producing exactly `budget` of them.
     *
     *   minLeafMass(P, 1) = m(P)                       P is itself observed
     *   minLeafMass(P, b) = min over decay channels of
     *                       sum over budget splits of minLeafMass(child, share)
     *
     * Infinity when P simply cannot produce that many particles.
     *
     * This is the correct pruning quantity, and it is deliberately NOT a per-node
     * mass comparison. Only the root of the diagram is on-shell -- every internal
     * line is a virtual propagator whose virtuality is unconstrained, so an
     * internal line may radiate even when it "cannot afford to" on mass shell.
     * That is why Z0 -> mu+ mu- with the mu+ radiating a photon into e+ e- is a
     * legitimate diagram, and why a naive m(parent) > m(children) test at every
     * node wrongly deletes it. What must hold is the global statement: the total
     * mass of the final state is below the mass of the initial particle.
     */
    minLeafMass(symbol, budget) {
        const key = `${symbol}|${budget}`;
        if (this._minLeafCache.has(key)) return this._minLeafCache.get(key);

        let result;
        if (budget === 1) {
            result = this.getMass(symbol);
        } else {
            result = Infinity;
            this._minLeafCache.set(key, Infinity); // guard against cycles while recursing
            for (const channel of this.decaysOf(symbol)) {
                const products = channel.products;
                if (products.length > budget) continue;
                for (const dist of splits(budget, products.length)) {
                    let sum = 0;
                    for (let i = 0; i < products.length; i++) {
                        const sub = this.minLeafMass(products[i], dist[i]);
                        if (!isFinite(sub)) { sum = Infinity; break; }
                        sum += sub;
                    }
                    if (sum < result) result = sum;
                }
            }
        }
        this._minLeafCache.set(key, result);
        return result;
    }

    // ------------------------------------------------- conservation

    checkConservation(initial, final) {
        let dQ = 0, dLe = 0, dLmu = 0, dLtau = 0, dB = 0;

        initial.forEach(p => {
            const info = this.getParticleInfo(p);
            dQ += info.Q; dLe += info.Le; dLmu += info.Lmu; dLtau += info.Ltau; dB += info.B;
        });

        final.forEach(p => {
            const info = this.getParticleInfo(p);
            dQ -= info.Q; dLe -= info.Le; dLmu -= info.Lmu; dLtau -= info.Ltau; dB -= info.B;
        });

        const isZero = (val) => Math.abs(val) < 1e-5;

        if (!isZero(dQ)) return { valid: false, reason: `Charge not conserved (ΔQ = ${dQ.toFixed(2)})` };
        if (!isZero(dB)) return { valid: false, reason: `Baryon number not conserved (ΔB = ${dB.toFixed(2)})` };
        if (!isZero(dLe)) return { valid: false, reason: `Electron number not conserved` };
        if (!isZero(dLmu)) return { valid: false, reason: `Muon number not conserved` };
        if (!isZero(dLtau)) return { valid: false, reason: `Tau number not conserved` };

        return { valid: true };
    }
}
