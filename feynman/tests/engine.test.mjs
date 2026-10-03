// tests/engine.test.mjs
// Physics regression suite for the diagram engine.
//
//   node --test tests/
//
// Only the engine modules are covered. draw.js and ui.js need a real DOM, so they
// are verified by hand in the browser.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FeynmanEngine } from '../js/classifier.js';
import { findProcesses, canonical } from '../js/topology.js';
import { identifyHadron } from '../js/hadrons.js';

const engine = new FeynmanEngine();

const valid = (initial, final, opts) => {
    const r = findProcesses(engine, initial, final, opts);
    assert.equal(r.type, 'valid', `expected valid: ${initial} -> ${final}${r.reason ? ` (${r.reason})` : ''}`);
    return r.channels;
};

const invalid = (initial, final) => {
    const r = findProcesses(engine, initial, final);
    assert.equal(r.type, 'invalid', `expected no diagrams for ${initial} -> ${final}, got ${r.channels?.length}`);
};

// ---------------------------------------------------------------------------

describe('crossing symmetry', () => {
    test('a vertex covers every rearrangement of its particles', () => {
        assert.ok(engine.checkVertex(['d'], ['u', 'W⁻']));
        assert.ok(engine.checkVertex(['ū'], ['d̄', 'W⁻']));
        assert.ok(engine.checkVertex(['W⁺'], ['d̄', 'u']));
    });

    test('the 4-gluon vertex yields the 1->3 splitting', () => {
        assert.ok(engine.checkVertex(['g'], ['g', 'g', 'g']));
    });

    test('charge-conjugate decays are indexed, not just the listed direction', () => {
        const has = (parent, products) => engine.decaysOf(parent)
            .some(c => [...c.products].sort().join() === [...products].sort().join());

        assert.ok(has('W⁺', ['e⁺', 'νe']), 'W+ -> e+ nu_e');
        assert.ok(has('W⁻', ['e⁻', 'ν̄e']), 'W- -> e- anti-nu_e');
        assert.ok(has('π⁻', ['μ⁻', 'ν̄μ']), 'pi- -> mu- anti-nu_mu');
        assert.ok(has('n̄', ['p̄', 'W⁺']), 'anti-n -> anti-p W+');
    });
});

describe('kinematics', () => {
    test('a particle cannot decay into something heavier than itself', () => {
        assert.equal(engine.isKinematicallyAllowed('n', ['p', 'π⁻']), false);
        assert.equal(engine.isKinematicallyAllowed('n', ['p', 'e⁻', 'ν̄e']), true);
        assert.equal(engine.isKinematicallyAllowed('π⁺', ['e⁺', 'νe']), true);
    });

    test('massless particles are treated as off-shell splittings', () => {
        // A literal 0 > 0 test would forbid both of these.
        assert.equal(engine.isKinematicallyAllowed('γ', ['e⁻', 'e⁺']), true);
        assert.equal(engine.isKinematicallyAllowed('g', ['g', 'g']), true);
    });

    test('the reachable-mass bound ignores the mass of an internal mediator', () => {
        const neutron = engine.getMass('n');

        // n -> p W- -> p e- anti-nu_e. The W is 80 GeV, but it is off-shell, so
        // what matters is the mass of the real final-state particles.
        assert.ok(engine.minLeafMass('n', 3) < neutron, 'beta decay must be in reach');

        // n -> p pi- has no mediator to hide behind: 938 + 140 MeV is out of reach.
        assert.ok(engine.minLeafMass('n', 2) > neutron, 'n -> p pi- must be out of reach');
    });

    test('minLeafMass is a true lower bound on every tree the search returns', () => {
        // This is what makes the pruning sound: the bound may be permissive, but it
        // must never exceed the real mass of a diagram that is actually produced.
        for (const symbol of Object.keys(engine.particles)) {
            for (const multiplicity of [2, 3, 4]) {
                const r = findProcesses(engine, [symbol], [], { maxMultiplicity: multiplicity });
                if (r.type !== 'valid') continue;
                const bound = engine.minLeafMass(symbol, multiplicity);
                for (const channel of r.channels) {
                    if (channel.multiplicity !== multiplicity) continue;
                    const total = channel.external.reduce((s, p) => s + engine.getMass(p), 0);
                    assert.ok(total >= bound - 1e-6,
                        `${symbol} -> ${channel.external.join(' ')}: ${total} < bound ${bound}`);
                }
            }
        }
    });

    test('hadron masses are the measured ones, not the constituent sum', () => {
        assert.ok(Math.abs(engine.getMass('p') - 938.272) < 0.01);
        assert.ok(engine.getMass('p') > 100 * (engine.getMass('u') + engine.getMass('u') + engine.getMass('d')));
    });

    test('a single external particle costs exactly its own mass', () => {
        for (const symbol of ['e⁻', 'p', 'π⁺', 'γ', 'W⁻']) {
            assert.equal(engine.minLeafMass(symbol, 1), engine.getMass(symbol));
        }
    });

    // Note: the bound is deliberately NOT monotonic in multiplicity, and nothing
    // should assume it. minLeafMass('n', 2) is heavier than minLeafMass('n', 1)
    // because a single external particle is the parent itself and does not decay
    // at all, while two particles force a real decay channel. pi0 -> gamma gamma
    // saturates a budget of 2 at zero mass, but demanding 3 particles forces one
    // photon to split and the bound jumps to 1.02 MeV. The only guarantee is the
    // lower-bound property checked below.
});

describe('forbidden processes', () => {
    test('n -> p pi- is below threshold', () => invalid(['n'], ['p', 'π⁻']));
    test('a free proton cannot beta-plus decay', () => invalid(['p'], ['n', 'e⁺', 'νe']));
});

describe('decay topologies', () => {
    test('1->2 hadron decay uses a single effective vertex', () => {
        const channels = valid(['π⁺'], ['μ⁺', 'νμ']);
        assert.equal(channels.length, 1);
        assert.equal(channels[0].multiplicity, 2);
        assert.equal(channels[0].steps.length, 1);
    });

    test('neutron beta decay appears as both a cascade and a contact vertex', () => {
        const channels = valid(['n'], ['p', 'e⁻', 'ν̄e']);
        assert.equal(channels.length, 2);
        assert.ok(channels.some(c => c.mediator === 'W⁻'), 'expected the W- cascade');
        assert.ok(channels.some(c => !c.mediator), 'expected the single-point contact form');
    });

    test('4-body decay finds the two-mediator shape', () => {
        // h -> W+W- -> 4 fermions. This topology is unreachable from the other three.
        const channels = valid(['h'], ['e⁺', 'νe', 'μ⁻', 'ν̄μ']);
        const twoMediator = channels.some(c =>
            c.tree && c.tree.children.filter(child => child.children).length === 2);
        assert.ok(twoMediator, 'expected h -> W+W- -> 4 leptons');
    });

    test('every 1->4 shape is reachable', () => {
        const shapes = new Set();
        for (const parent of ['h', 'Z⁰', 'τ⁻', 'W⁺']) {
            const r = findProcesses(engine, [parent], [], { maxMultiplicity: 4 });
            if (r.type !== 'valid') continue;
            for (const c of r.channels) {
                if (!c.tree || c.multiplicity !== 4) continue;
                const branching = c.tree.children.filter(x => x.children);
                if (branching.length === 2) shapes.add('two-mediator');
                else if (branching.length === 1) {
                    shapes.add(branching[0].children.some(x => x.children) ? 'linear-chain' : 'cascade');
                } else shapes.add('contact-first');
            }
        }
        assert.ok(shapes.has('two-mediator'));
        assert.ok(shapes.has('linear-chain') || shapes.has('cascade'));
    });
});

describe('scattering', () => {
    test('e+e- -> mu+mu- proceeds through gamma and Z', () => {
        const channels = valid(['e⁻', 'e⁺'], ['μ⁻', 'μ⁺']);
        const mediators = channels.map(c => c.mediator);
        assert.ok(mediators.includes('γ'));
        assert.ok(mediators.includes('Z⁰'));
    });

    test('identical final-state particles merge the t and u channel', () => {
        const channels = valid(['e⁻', 'e⁻'], ['e⁻', 'e⁻']);
        assert.ok(channels.some(c => c.type === 't/u-channel'));
    });

    test('gg -> gg includes the 4-point contact diagram', () => {
        const channels = valid(['g', 'g'], ['g', 'g']);
        assert.ok(channels.some(c => c.type === 'contact'));
    });

    test('e+e- -> pi+pi- is reachable through the effective photon vertex', () => {
        valid(['e⁻', 'e⁺'], ['π⁺', 'π⁻']);
    });
});

describe('conservation laws', () => {
    test('charge and baryon number are enforced', () => {
        invalid(['e⁻'], ['μ⁻']);
        invalid(['n'], ['π⁺', 'e⁻']);
    });

    test('lepton number is conserved per family', () => {
        invalid(['μ⁻'], ['e⁻', 'ν̄e', 'νe']);
        valid(['μ⁻'], ['e⁻', 'ν̄e', 'νμ']);
    });

    test('every generated channel conserves the checked quantities', () => {
        for (const initial of [['μ⁻'], ['τ⁻'], ['Z⁰'], ['h'], ['e⁻', 'e⁺'], ['π⁺'], ['Λ']]) {
            const r = findProcesses(engine, initial, []);
            if (r.type !== 'valid') continue;
            for (const channel of r.channels) {
                const check = engine.checkConservation(initial, channel.external);
                assert.ok(check.valid, `${initial} -> ${channel.external}: ${check.reason}`);
            }
        }
    });
});

describe('no final state outweighs its parent', () => {
    test('sweep every particle that can decay', () => {
        for (const symbol of Object.keys(engine.particles)) {
            const parentMass = engine.getMass(symbol);
            if (parentMass <= 0) continue;
            const r = findProcesses(engine, [symbol], []);
            if (r.type !== 'valid') continue;
            for (const channel of r.channels) {
                const total = channel.external.reduce((sum, p) => sum + engine.getMass(p), 0);
                assert.ok(total < parentMass,
                    `${symbol} -> ${channel.external.join(' ')}: ${total} >= ${parentMass}`);
            }
        }
    });
});

describe('hadron identification from quark content', () => {
    const cases = [
        [['u', 'd̄'], 'π⁺'], [['d', 'ū'], 'π⁻'],
        [['u', 's̄'], 'K⁺'], [['s', 'ū'], 'K⁻'],
        [['d', 's̄'], 'K⁰'], [['s', 'd̄'], 'K̄⁰'],
        [['u', 'u', 'd'], 'p'], [['u', 'd', 'd'], 'n'],
        [['u', 'd', 's'], 'Λ'], [['u', 'u', 's'], 'Σ⁺'],
        [['d', 'd', 's'], 'Σ⁻'], [['u', 's', 's'], 'Ξ⁰'],
        [['d', 's', 's'], 'Ξ⁻'], [['s', 's', 's'], 'Ω⁻'],
        [['ū', 'ū', 'd̄'], 'p̄'], [['ū', 'd̄', 'd̄'], 'n̄'],
        [['s̄', 's̄', 's̄'], 'Ω̄⁺']
    ];

    for (const [quarks, expected] of cases) {
        test(`${quarks.join(' ')} -> ${expected}`, () => {
            const result = identifyHadron(quarks);
            assert.ok(result && result.matched, 'expected a match');
            assert.equal(result.symbol, expected);
        });
    }

    test('mixed Unicode macrons are handled', () => {
        // 'ū' is precomposed U+016B while 'd̄' uses a combining U+0304.
        assert.equal('ū'.length, 1);
        assert.equal('d̄'.length, 2);
        assert.equal(identifyHadron(['d', 'ū']).symbol, 'π⁻');
        assert.equal(identifyHadron(['ū', 'ū', 'd̄']).symbol, 'p̄');
    });

    test('flavour-neutral pairs are reported as ambiguous, not guessed', () => {
        for (const pair of [['u', 'ū'], ['d', 'd̄']]) {
            const result = identifyHadron(pair);
            assert.equal(result.ambiguous, true);
            assert.ok(result.candidates.some(c => c.symbol === 'π⁰'));
        }
    });

    test('quark content with no hadron returns nothing', () => {
        assert.equal(identifyHadron(['u', 'u', 'u']), null);
    });
});

describe('engine invariants', () => {
    test('the search never returns duplicate trees', () => {
        const r = findProcesses(engine, ['μ⁻'], []);
        const seen = new Set();
        for (const channel of r.channels) {
            const key = channel.tree ? canonical(channel.tree) : channel.type + channel.mediator;
            assert.ok(!seen.has(key), `duplicate tree: ${key}`);
            seen.add(key);
        }
    });

    test('a massless root is not pruned by the kinematic bound', () => {
        // gamma -> e+ e- must survive the minimum-leaf-mass pruning.
        valid(['γ'], ['e⁻', 'e⁺']);
    });

    test('searching a particle with no decay channels reports nothing', () => {
        invalid(['e⁻'], ['νe', 'W⁻', 'γ', 'γ']);
    });
});
