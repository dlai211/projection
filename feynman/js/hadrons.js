// js/hadrons.js
// Light hadrons: mesons and baryons (plus their distinct antiparticles).
//
// A hadron is a colour singlet, so these carry no colour charge and are drawn as a
// single line ending in a "hadronic blob". `quarks` records the valence content used
// for the brace grouping -- it is NOT used for the mass, because a baryon's mass
// (e.g. 938 MeV for the proton) is nothing like the sum of its constituent quark
// masses (u+u+d is about 9 MeV).
//
// quarks: null means the particle has no definite valence quark content -- pi0 and
// eta are flavour superpositions -- so it can never be inferred from a quark list.

import { PARTICLES, formatMass } from './particles.js';

export const HADRONS = {
    // ------------------------------------------------------------------ mesons
    'π⁺': { name: 'Pion +',  type: 'meson', group: 'meson', spin: 0, Q:  1, B: 0, S: 0, m: 139.57039,
            quarks: ['u', 'd̄'], anti: 'π⁻', label: 'π⁺', massLabel: '139.57 MeV' },
    'π⁻': { name: 'Pion -',  type: 'meson', group: 'meson', spin: 0, Q: -1, B: 0, S: 0, m: 139.57039,
            quarks: ['d', 'ū'], anti: 'π⁺', label: 'π⁻', massLabel: '139.57 MeV' },
    'π⁰': { name: 'Pion 0',  type: 'meson', group: 'meson', spin: 0, Q:  0, B: 0, S: 0, m: 134.9768,
            quarks: null, anti: 'π⁰', label: 'π⁰', massLabel: '134.98 MeV',
            note: '(uū − dd̄)/√2 — flavour superposition' },

    'K⁺': { name: 'Kaon +',  type: 'meson', group: 'meson', spin: 0, Q:  1, B: 0, S:  1, m: 493.677,
            quarks: ['u', 's̄'], anti: 'K⁻', label: 'K⁺', massLabel: '493.68 MeV' },
    'K⁻': { name: 'Kaon -',  type: 'meson', group: 'meson', spin: 0, Q: -1, B: 0, S: -1, m: 493.677,
            quarks: ['s', 'ū'], anti: 'K⁺', label: 'K⁻', massLabel: '493.68 MeV' },
    'K⁰': { name: 'Kaon 0',  type: 'meson', group: 'meson', spin: 0, Q:  0, B: 0, S:  1, m: 497.611,
            quarks: ['d', 's̄'], anti: 'K̄⁰', label: 'K⁰', massLabel: '497.61 MeV' },
    'K̄⁰': { name: 'Anti-Kaon 0', type: 'meson', group: 'meson', spin: 0, Q: 0, B: 0, S: -1, m: 497.611,
            quarks: ['s', 'd̄'], anti: 'K⁰', label: 'K̄⁰', massLabel: '497.61 MeV' },

    'η':  { name: 'Eta',     type: 'meson', group: 'meson', spin: 0, Q: 0, B: 0, S: 0, m: 547.862,
            quarks: null, anti: 'η', label: 'η', massLabel: '547.86 MeV',
            note: '(uū + dd̄ − 2ss̄)/√6 — flavour singlet' },

    // ---------------------------------------------------------------- baryons
    'p':  { name: 'Proton',  type: 'baryon', group: 'baryon', spin: 0.5, Q:  1, B: 1, S: 0, m: 938.27209,
            quarks: ['u', 'u', 'd'], anti: 'p̄', label: 'p', massLabel: '938.27 MeV' },
    'n':  { name: 'Neutron', type: 'baryon', group: 'baryon', spin: 0.5, Q:  0, B: 1, S: 0, m: 939.56542,
            quarks: ['u', 'd', 'd'], anti: 'n̄', label: 'n', massLabel: '939.57 MeV' },
    'Λ':  { name: 'Lambda',  type: 'baryon', group: 'baryon', spin: 0.5, Q:  0, B: 1, S: -1, m: 1115.683,
            quarks: ['u', 'd', 's'], anti: 'Λ̄', label: 'Λ', massLabel: '1115.68 MeV' },
    'Σ⁺': { name: 'Sigma +', type: 'baryon', group: 'baryon', spin: 0.5, Q:  1, B: 1, S: -1, m: 1189.37,
            quarks: ['u', 'u', 's'], anti: 'Σ̄⁻', label: 'Σ⁺', massLabel: '1189.37 MeV' },
    'Σ⁰': { name: 'Sigma 0', type: 'baryon', group: 'baryon', spin: 0.5, Q:  0, B: 1, S: -1, m: 1192.642,
            quarks: ['u', 'd', 's'], anti: 'Σ̄⁰', label: 'Σ⁰', massLabel: '1192.64 MeV' },
    'Σ⁻': { name: 'Sigma -', type: 'baryon', group: 'baryon', spin: 0.5, Q: -1, B: 1, S: -1, m: 1197.449,
            quarks: ['d', 'd', 's'], anti: 'Σ̄⁺', label: 'Σ⁻', massLabel: '1197.45 MeV' },
    'Ξ⁰': { name: 'Xi 0',    type: 'baryon', group: 'baryon', spin: 0.5, Q:  0, B: 1, S: -2, m: 1314.86,
            quarks: ['u', 's', 's'], anti: 'Ξ̄⁰', label: 'Ξ⁰', massLabel: '1314.86 MeV' },
    'Ξ⁻': { name: 'Xi -',    type: 'baryon', group: 'baryon', spin: 0.5, Q: -1, B: 1, S: -2, m: 1321.71,
            quarks: ['d', 's', 's'], anti: 'Ξ̄⁺', label: 'Ξ⁻', massLabel: '1321.71 MeV' },
    'Ω⁻': { name: 'Omega -', type: 'baryon', group: 'baryon', spin: 0.5, Q: -1, B: 1, S: -3, m: 1672.45,
            quarks: ['s', 's', 's'], anti: 'Ω̄⁺', label: 'Ω⁻', massLabel: '1672.45 MeV' },

    // ------------------------------------------------------------ antibaryons
    'p̄':  { name: 'Anti-Proton',  type: 'baryon', group: 'antibaryon', spin: 0.5, Q: -1, B: -1, S: 0, m: 938.27209,
            quarks: ['ū', 'ū', 'd̄'], anti: 'p', label: 'p̄', massLabel: '938.27 MeV' },
    'n̄':  { name: 'Anti-Neutron', type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  0, B: -1, S: 0, m: 939.56542,
            quarks: ['ū', 'd̄', 'd̄'], anti: 'n', label: 'n̄', massLabel: '939.57 MeV' },
    'Λ̄':  { name: 'Anti-Lambda',  type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  0, B: -1, S:  1, m: 1115.683,
            quarks: ['ū', 'd̄', 's̄'], anti: 'Λ', label: 'Λ̄', massLabel: '1115.68 MeV' },
    'Σ̄⁻': { name: 'Anti-Sigma -', type: 'baryon', group: 'antibaryon', spin: 0.5, Q: -1, B: -1, S:  1, m: 1189.37,
            quarks: ['ū', 'ū', 's̄'], anti: 'Σ⁺', label: 'Σ̄⁻', massLabel: '1189.37 MeV' },
    'Σ̄⁰': { name: 'Anti-Sigma 0', type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  0, B: -1, S:  1, m: 1192.642,
            quarks: ['ū', 'd̄', 's̄'], anti: 'Σ⁰', label: 'Σ̄⁰', massLabel: '1192.64 MeV' },
    'Σ̄⁺': { name: 'Anti-Sigma +', type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  1, B: -1, S:  1, m: 1197.449,
            quarks: ['d̄', 'd̄', 's̄'], anti: 'Σ⁻', label: 'Σ̄⁺', massLabel: '1197.45 MeV' },
    'Ξ̄⁰': { name: 'Anti-Xi 0',    type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  0, B: -1, S:  2, m: 1314.86,
            quarks: ['ū', 's̄', 's̄'], anti: 'Ξ⁰', label: 'Ξ̄⁰', massLabel: '1314.86 MeV' },
    'Ξ̄⁺': { name: 'Anti-Xi +',    type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  1, B: -1, S:  2, m: 1321.71,
            quarks: ['d̄', 's̄', 's̄'], anti: 'Ξ⁻', label: 'Ξ̄⁺', massLabel: '1321.71 MeV' },
    'Ω̄⁺': { name: 'Anti-Omega +', type: 'baryon', group: 'antibaryon', spin: 0.5, Q:  1, B: -1, S:  3, m: 1672.45,
            quarks: ['s̄', 's̄', 's̄'], anti: 'Ω⁻', label: 'Ω̄⁺', massLabel: '1672.45 MeV' }
};

// Fill in the fields every particle entry is expected to carry, so hadrons and
// elementary particles are interchangeable inside the engine.
Object.entries(HADRONS).forEach(([symbol, h]) => {
    h.symbol = symbol;
    h.Le = 0; h.Lmu = 0; h.Ltau = 0;
    h.color = 'singlet';
    h.panel = 'hadron';
    h.massLabel = h.massLabel || formatMass(h.m);
});

export const HADRON_PANEL = [
    { group: 'meson',      title: 'Mesons',      badge: 'Spin 0' },
    { group: 'baryon',     title: 'Baryons',     badge: 'Spin 1/2' },
    { group: 'antibaryon', title: 'Antibaryons', badge: 'Spin 1/2' }
];

// --------------------------------------------------------------- quark content

const FLAVOURS = ['u', 'd', 's', 'c', 'b', 't'];
const MACRON = '̄';   // combining macron

/**
 * Symbols are inconsistent in the source data: 'ū' is stored precomposed as
 * U+016B, while 'd̄', 's̄' and 'ν̄e' use a combining macron (U+0304). Decomposing
 * with NFD first makes both spellings behave the same.
 */
export function isAntiQuark(symbol) {
    return typeof symbol === 'string' && symbol.normalize('NFD').includes(MACRON);
}

/** 'ū' or 'd̄' -> 'u' / 'd'. Returns null if the symbol is not a known flavour. */
export function quarkFlavour(symbol) {
    if (typeof symbol !== 'string' || !symbol) return null;
    const bare = symbol.normalize('NFD').split(MACRON).join('').normalize('NFC');
    return FLAVOURS.includes(bare) ? bare : null;
}

/**
 * Canonical key for a valence quark list: up-type flavours of the quarks, then a
 * '|', then the flavours of the antiquarks. Sorting makes the key order-independent.
 *   ['u','d̄']  -> 'u|d'      ['ū','ū','d̄'] -> '|uud'
 */
export function quarkKey(quarks) {
    const q = [], aq = [];
    for (const s of quarks) {
        const f = quarkFlavour(s);
        if (f === null) return null;
        (isAntiQuark(s) ? aq : q).push(f);
    }
    const byFlavour = (x, y) => FLAVOURS.indexOf(x) - FLAVOURS.indexOf(y);
    return q.sort(byFlavour).join('') + '|' + aq.sort(byFlavour).join('');
}

// Build the identification table. Where two hadrons share a quark content (Lambda
// and Sigma0 are both uds) the lighter ground state wins and the alternative is
// recorded so the UI can mention it.
const QUARK_INDEX = new Map();
for (const h of Object.values(HADRONS)) {
    if (!h.quarks) continue;
    const key = quarkKey(h.quarks);
    if (!key) continue;
    const existing = QUARK_INDEX.get(key);
    if (!existing) {
        QUARK_INDEX.set(key, { symbol: h.symbol, alternatives: [] });
    } else {
        const incumbent = HADRONS[existing.symbol];
        const [winner, loser] = h.m < incumbent.m ? [h, incumbent] : [incumbent, h];
        QUARK_INDEX.set(key, { symbol: winner.symbol, alternatives: [...existing.alternatives, loser.symbol] });
    }
}

/**
 * Flavour-neutral quark pairs cannot be resolved: pi0 is the superposition
 * (uū − dd̄)/√2, so seeing a uū pair does not determine the particle. These keys
 * return a generic label instead of a wrong particle name.
 */
const AMBIGUOUS_PAIRS = {
    'u|u': ['π⁰', 'η'], 'd|d': ['π⁰', 'η'], 's|s': ['η'], 'c|c': [], 'b|b': [], 't|t': []
};

/**
 * Identifies a hadron from a list of valence quark symbols.
 * Returns one of:
 *   { matched: true, symbol, alternatives }        confident match
 *   { ambiguous: true, candidates, genericLabel }  flavour-neutral pair, do not guess
 *   null                                           no hadron of this content
 */
export function identifyHadron(quarks) {
    if (!Array.isArray(quarks) || quarks.length < 2 || quarks.length > 3) return null;
    const key = quarkKey(quarks);
    if (!key) return null;

    const nQuarks = quarks.filter(s => !isAntiQuark(s)).length;
    const nAnti = quarks.length - nQuarks;
    const isMeson = nQuarks === 1 && nAnti === 1;
    const isBaryon = quarks.length === 3 && (nQuarks === 3 || nAnti === 3);
    if (!isMeson && !isBaryon) return null;

    if (isMeson && AMBIGUOUS_PAIRS[key] !== undefined) {
        return { ambiguous: true,
                 candidates: AMBIGUOUS_PAIRS[key].map(s => HADRONS[s]).filter(Boolean),
                 genericLabel: formatGenericPair(key) };
    }

    const hit = QUARK_INDEX.get(key);
    if (!hit) return null;
    return { matched: true, symbol: hit.symbol, alternatives: hit.alternatives };
}

/** 'u|u' -> 'u ū'. Used when a flavour-neutral pair is too ambiguous to name. */
function formatGenericPair(key) {
    const [q, aq] = key.split('|');
    return aq ? `${q} ${aq}${MACRON}` : q;
}

/** Quark list in the canonical order used for keys, for display. */
export function canonicalQuarkList(quarks) {
    return [...quarks].sort((a, b) => {
        const fa = FLAVOURS.indexOf(quarkFlavour(a));
        const fb = FLAVOURS.indexOf(quarkFlavour(b));
        if (isAntiQuark(a) !== isAntiQuark(b)) return isAntiQuark(a) ? 1 : -1;
        return fa - fb;
    });
}

/** 'u d̄' style display string for a hadron's valence content. */
export function quarkContentLabel(symbol) {
    const h = HADRONS[symbol];
    if (!h) return '';
    if (!h.quarks) return h.note || '';
    return h.quarks.join(' ');
}

/** Every hadron symbol, in panel order. */
export function hadronSymbols() {
    return HADRON_PANEL.flatMap(g => Object.values(HADRONS).filter(h => h.group === g.group).map(h => h.symbol));
}

/** Combined lookup over elementary particles and hadrons. */
export const ALL_PARTICLES = { ...PARTICLES, ...HADRONS };
