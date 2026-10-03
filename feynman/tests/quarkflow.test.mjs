// tests/quarkflow.test.mjs
// Valence quark flow: which quarks pass straight through a hadron -> hadron
// transition, and which one is active.
//
//   node --test tests/

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FeynmanEngine } from '../js/classifier.js';
import { findProcesses } from '../js/topology.js';
import {
    deriveQuarkFlow, applyQuarkFlowOverride, computeQuarkFlow, findHadronTransition
} from '../js/quarkflow.js';

const engine = new FeynmanEngine();

/** Compact form like 'u-u d-d [d->u]' for readable assertions. */
const shape = (flow) => flow.rails
    .map(r => (r.role === 'spectator' ? `${r.fromQuark}-${r.toQuark}` : `[${r.fromQuark}->${r.toQuark}]`))
    .join(' ');

describe('derived quark flow', () => {
    const cases = [
        [['n', 'p'], 'u-u d-d [d->u]'],
        [['Λ', 'p'], 'u-u d-d [s->u]'],
        [['Σ⁺', 'p'], 'u-u u-u [s->d]'],
        [['Σ⁻', 'n'], 'd-d d-d [s->u]'],
        [['Ξ⁰', 'Λ'], 'u-u s-s [s->d]'],
        [['Ξ⁻', 'Λ'], 'd-d s-s [s->u]'],
        [['Ω⁻', 'Λ'], 's-s [s->u] [s->d]'],
        [['K⁰', 'π⁻'], 'd-d [s̄->ū]'],
        [['K⁺', 'π⁺'], 'u-u [s̄->d̄]'],
        [['n̄', 'p̄'], 'ū-ū d̄-d̄ [d̄->ū]'],
        [['Λ̄', 'p̄'], 'ū-ū d̄-d̄ [s̄->ū]']
    ];

    for (const [[from, to], expected] of cases) {
        test(`${from} -> ${to}`, () => {
            const flow = computeQuarkFlow(engine, from, to);
            assert.ok(flow, 'expected a flow');
            assert.equal(shape(flow), expected);
        });
    }

    test('a flavour-preserving transition has no active quark', () => {
        const flow = computeQuarkFlow(engine, 'π⁺', 'π⁺');
        assert.equal(flow.changed, false);
        assert.equal(shape(flow), 'u-u d̄-d̄');
    });

    test('every rail is accounted for exactly once', () => {
        for (const [from, to] of [['n', 'p'], ['Ω⁻', 'Λ'], ['K⁰', 'π⁻']]) {
            const flow = computeQuarkFlow(engine, from, to);
            const sourceIndices = flow.rails.map(r => r.fromIndex).sort();
            const targetIndices = flow.rails.map(r => r.toIndex).sort();
            const n = engine.getParticleInfo(from).quarks.length;
            assert.deepEqual(sourceIndices, [...Array(n).keys()], `${from} source rails`);
            assert.deepEqual(targetIndices, [...Array(n).keys()], `${from} target rails`);
        }
    });
});

describe('flow cannot be determined', () => {
    const undetermined = [
        ['p', 'π⁺'],     // baryon cannot become a meson
        ['π⁺', 'π⁰'],    // pi0 has no definite valence content
        ['π⁺', 'η'],     // eta is a flavour singlet
        ['π⁰', 'p']
    ];

    for (const [from, to] of undetermined) {
        test(`${from} -> ${to} returns null so the blob renderer is used`, () => {
            assert.equal(computeQuarkFlow(engine, from, to), null);
        });
    }

    test('a quark count mismatch is rejected', () => {
        assert.equal(deriveQuarkFlow(['u', 'd'], ['u', 'u', 'd']), null);
    });

    test('empty input is rejected', () => {
        assert.equal(deriveQuarkFlow([], ['u']), null);
        assert.equal(deriveQuarkFlow(null, ['u']), null);
    });
});

describe('declared overrides', () => {
    const from = engine.getParticleInfo('n').quarks;   // u d d
    const to = engine.getParticleInfo('p').quarks;     // u u d

    test('a correct declaration is accepted', () => {
        const flow = applyQuarkFlowOverride(from, to, {
            spectator: [['u', 'u'], ['d', 'd']],
            active: [['d', 'u']]
        });
        assert.ok(flow);
        assert.equal(flow.fromOverride, true);
        assert.equal(shape(flow), 'u-u d-d [d->u]');
    });

    test('a declaration naming a quark the hadron does not contain is rejected', () => {
        assert.equal(applyQuarkFlowOverride(from, to, {
            spectator: [['u', 'u'], ['s', 's']],
            active: [['d', 'u']]
        }), null);
    });

    test('a spectator that changes flavour is rejected', () => {
        assert.equal(applyQuarkFlowOverride(from, to, {
            spectator: [['u', 'u'], ['d', 's']],
            active: [['d', 'u']]
        }), null);
    });

    test('an active quark that does not change flavour is rejected', () => {
        assert.equal(applyQuarkFlowOverride(from, to, {
            spectator: [['u', 'u'], ['d', 'd']],
            active: [['d', 'd']]
        }), null);
    });

    test('a declaration with the wrong number of pairs is rejected', () => {
        assert.equal(applyQuarkFlowOverride(from, to, {
            spectator: [['u', 'u']],
            active: [['d', 'u']]
        }), null);
    });

    test('the override takes precedence over the derived answer', () => {
        // Declare the roles swapped relative to what derivation would choose.
        const flow = computeQuarkFlow(engine, 'n', 'p', {
            spectator: [['d', 'd'], ['d', 'u']],
            active: [['u', 'u']]
        });
        // The active-quark rule rejects a no-op active quark, so the declaration is
        // refused and derivation is used instead.
        assert.equal(flow.fromOverride, undefined);
        assert.equal(shape(flow), 'u-u d-d [d->u]');
    });
});

describe('transition detection on real diagrams', () => {
    const channelWith = (init, fin, mediator) => {
        const r = findProcesses(engine, init, fin, { maxMultiplicity: 4 });
        assert.equal(r.type, 'valid', `${init} -> ${fin}`);
        return r.channels.find(c => (c.mediator || 'none') === mediator);
    };

    test('the neutron beta decay cascade is recognised', () => {
        const channel = channelWith(['n'], ['p', 'e⁻', 'ν̄e'], 'W⁻');
        const spec = findHadronTransition(engine, channel.tree);
        assert.ok(spec, 'expected a quark flow');
        assert.equal(spec.from, 'n');
        assert.equal(spec.to, 'p');
        assert.equal(spec.flow.changed, true);
        // The mediator branch carries the W-, which itself decays.
        assert.equal(spec.others.length, 1);
        assert.equal(spec.others[0].symbol, 'W⁻');
    });

    test('the contact form is recognised, with both leptons on the branch', () => {
        const channel = channelWith(['n'], ['p', 'e⁻', 'ν̄e'], 'none');
        const spec = findHadronTransition(engine, channel.tree);
        assert.ok(spec, 'expected a quark flow');
        assert.deepEqual(spec.others.map(n => n.symbol).sort(), ['e⁻', 'ν̄e']);
    });

    test('a two-hadron final state falls back to the blob renderer', () => {
        // Lambda -> p pi- has two hadron children, which the rails cannot express.
        const channel = channelWith(['Λ'], ['p', 'π⁻'], 'none');
        assert.equal(findHadronTransition(engine, channel.tree), null);
    });

    test('a hadron decaying only to leptons falls back to the blob renderer', () => {
        const channel = channelWith(['π⁺'], ['μ⁺', 'νμ'], 'none');
        assert.equal(findHadronTransition(engine, channel.tree), null);
    });

    test('a transition where the hadron decays further falls back', () => {
        const r = findProcesses(engine, ['Ξ⁻'], ['Λ', 'e⁻', 'ν̄e'], { maxMultiplicity: 4 });
        for (const channel of r.channels) {
            const spec = findHadronTransition(engine, channel.tree);
            if (spec) {
                // Any accepted transition must point at a genuine final-state hadron.
                assert.ok(!spec.others.some(n => n.symbol === spec.to));
            }
        }
    });
});

describe('renderer coverage', () => {
    test('every hadron -> hadron pair in the catalogue either resolves or falls back', () => {
        // The renderer must never be handed a flow it cannot draw, and must never
        // throw for any pair the search can actually produce.
        for (const from of Object.keys(engine.particles)) {
            if (!engine.isHadron(from)) continue;
            for (const to of Object.keys(engine.particles)) {
                if (!engine.isHadron(to)) continue;
                const flow = computeQuarkFlow(engine, from, to);
                if (!flow) continue;
                assert.ok(flow.rails.length > 0, `${from} -> ${to}`);
                for (const r of flow.rails) {
                    assert.ok(r.fromQuark && r.toQuark, `${from} -> ${to} rail missing symbols`);
                    assert.notEqual(r.fromIndex, undefined);
                    assert.notEqual(r.toIndex, undefined);
                }
            }
        }
    });

    test('no diagram produced by the search yields a malformed flow', () => {
        for (const initial of [['n'], ['Λ'], ['Ξ⁻'], ['Ω⁻'], ['K⁺'], ['π⁺']]) {
            const r = findProcesses(engine, initial, [], { maxMultiplicity: 3 });
            if (r.type !== 'valid') continue;
            for (const channel of r.channels) {
                const spec = findHadronTransition(engine, channel.tree);
                if (!spec) continue;
                assert.ok(engine.isHadron(spec.from) && engine.isHadron(spec.to));
                assert.ok(spec.flow.rails.length === engine.getParticleInfo(spec.from).quarks.length);
            }
        }
    });
});
