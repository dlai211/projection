// js/vertices.js
//
// A vertex is written as { in: [...], out: [...] }. Crossing symmetry means the same
// entry covers every rearrangement: the "all incoming" signature of the vertex is
//   S = in ∪ { anti(out) }
// and ANY partition of S into a left part L and a right part R is an equivalent
// process  L -> anti(R).  So { in:['d'], out:['u','W⁻'] } also gives ū -> d̄ W⁻ and
// W⁺ -> ū u, and the 4-gluon entry gives g -> g g g. The engine derives all of these
// automatically -- do not list crossing partners by hand.

export const SM_VERTICES = [
    // --- QED ---
    { in: ['e⁻'], out: ['e⁻', 'γ'] },
    { in: ['μ⁻'], out: ['μ⁻', 'γ'] },
    { in: ['τ⁻'], out: ['τ⁻', 'γ'] },
    { in: ['u'], out: ['u', 'γ'] },
    { in: ['d'], out: ['d', 'γ'] },
    { in: ['c'], out: ['c', 'γ'] },
    { in: ['s'], out: ['s', 'γ'] },
    { in: ['t'], out: ['t', 'γ'] },
    { in: ['b'], out: ['b', 'γ'] },

    // --- Weak Neutral Current (Z0) ---
    { in: ['e⁻'], out: ['e⁻', 'Z⁰'] },
    { in: ['μ⁻'], out: ['μ⁻', 'Z⁰'] },
    { in: ['τ⁻'], out: ['τ⁻', 'Z⁰'] },
    { in: ['νe'], out: ['νe', 'Z⁰'] },
    { in: ['νμ'], out: ['νμ', 'Z⁰'] },
    { in: ['ντ'], out: ['ντ', 'Z⁰'] },
    { in: ['u'], out: ['u', 'Z⁰'] },
    { in: ['d'], out: ['d', 'Z⁰'] },
    { in: ['c'], out: ['c', 'Z⁰'] },
    { in: ['s'], out: ['s', 'Z⁰'] },
    { in: ['t'], out: ['t', 'Z⁰'] },
    { in: ['b'], out: ['b', 'Z⁰'] },

    // --- Weak Charged Current (W±) ---
    // Crossing symmetry handles all 2->1 and 1->2 variants.
    { in: ['e⁻'], out: ['νe', 'W⁻'] },
    { in: ['μ⁻'], out: ['νμ', 'W⁻'] },
    { in: ['τ⁻'], out: ['ντ', 'W⁻'] },
    { in: ['d'], out: ['u', 'W⁻'] },
    { in: ['s'], out: ['u', 'W⁻'] },
    { in: ['d'], out: ['c', 'W⁻'] },
    { in: ['s'], out: ['c', 'W⁻'] },
    { in: ['b'], out: ['t', 'W⁻'] },

    // --- Strong (QCD) ---
    { in: ['u'], out: ['u', 'g'] },
    { in: ['d'], out: ['d', 'g'] },
    { in: ['c'], out: ['c', 'g'] },
    { in: ['s'], out: ['s', 'g'] },
    { in: ['t'], out: ['t', 'g'] },
    { in: ['b'], out: ['b', 'g'] },
    { in: ['g'], out: ['g', 'g'] },                        // 3-gluon
    { in: ['g', 'g'], out: ['g', 'g'], points: 4 },        // 4-gluon — also gives g -> g g g

    // --- Higgs ---
    { in: ['h'], out: ['W⁺', 'W⁻'] },
    { in: ['h'], out: ['Z⁰', 'Z⁰'] },
    { in: ['t'], out: ['t', 'h'] },
    { in: ['b'], out: ['b', 'h'] },
];

// ---------------------------------------------------------------------------
// Effective vertices: phenomenological, hadron-level interactions.
//
// These are NOT fundamental. A hadron is a bound state, so its decay cannot be
// written as a single elementary vertex -- it stands in for a QCD matrix element
// (a decay constant, a form factor) that has been measured, not computed. They are
// tagged `effective: true` and every diagram built from one is drawn with a
// distinct marker so a phenomenological vertex is never mistaken for a
// fundamental one.
//
// The mass check treats internal lines as off-shell, so entries like n -> p W⁻ are
// allowed even though the W is enormously virtual here (80 GeV against a 0.78 MeV
// energy release). That is exactly the regime of Fermi's original contact theory.
// ---------------------------------------------------------------------------
export const EFFECTIVE_VERTICES = [
    // --- Charged pion ---
    { in: ['π⁺'], out: ['μ⁺', 'νμ'], effective: true, process: 'pion leptonic decay' },
    { in: ['π⁺'], out: ['e⁺', 'νe'], effective: true, process: 'pion leptonic decay (helicity suppressed)' },
    { in: ['π⁺'], out: ['π⁰', 'W⁺'], effective: true, process: 'pion beta decay' },
    { in: ['π⁻'], out: ['π⁰', 'W⁻'], effective: true, process: 'pion beta decay' },
    { in: ['π⁰'], out: ['γ', 'γ'],   effective: true, process: 'neutral pion anomaly decay' },

    // --- Charged kaon ---
    { in: ['K⁺'], out: ['μ⁺', 'νμ'], effective: true, process: 'kaon leptonic decay' },
    { in: ['K⁺'], out: ['π⁰', 'W⁺'], effective: true, process: 'kaon semileptonic decay' },
    { in: ['K⁻'], out: ['π⁰', 'W⁻'], effective: true, process: 'kaon semileptonic decay' },

    // --- Neutron beta decay, cascade and direct-contact forms ---
    { in: ['n'], out: ['p', 'W⁻'], effective: true, process: 'neutron beta decay' },
    { in: ['n'], out: ['p', 'e⁻', 'ν̄e'], effective: true, points: 4, process: 'neutron beta decay (Fermi contact)' },

    // --- Hyperon decays ---
    { in: ['Λ'],  out: ['p', 'π⁻'],  effective: true, process: 'Lambda -> p pi-' },
    { in: ['Λ'],  out: ['n', 'π⁰'],  effective: true, process: 'Lambda -> n pi0' },
    { in: ['Σ⁺'], out: ['p', 'π⁰'],  effective: true, process: 'Sigma+ -> p pi0' },
    { in: ['Σ⁺'], out: ['n', 'π⁺'],  effective: true, process: 'Sigma+ -> n pi+' },
    { in: ['Σ⁻'], out: ['n', 'π⁻'],  effective: true, process: 'Sigma- -> n pi-' },
    { in: ['Ξ⁰'], out: ['Λ', 'π⁰'],  effective: true, process: 'Xi0 -> Lambda pi0' },
    { in: ['Ξ⁻'], out: ['Λ', 'π⁻'],  effective: true, process: 'Xi- -> Lambda pi-' },
    { in: ['Ω⁻'], out: ['Λ', 'K⁻'],  effective: true, process: 'Omega- -> Lambda K-' },
    { in: ['Ω⁻'], out: ['Ξ⁰', 'π⁻'], effective: true, process: 'Omega- -> Xi0 pi-' },

    // --- Vector meson dominance: e+e- -> hadrons ---
    { in: ['γ'], out: ['π⁺', 'π⁻'], effective: true, process: 'photon -> pion pair' },
    { in: ['γ'], out: ['K⁺', 'K⁻'], effective: true, process: 'photon -> kaon pair' },
    { in: ['Z⁰'], out: ['π⁺', 'π⁻'], effective: true, process: 'Z -> pion pair' },
];

/** All vertices the engine searches, fundamental first. */
export const ALL_VERTICES = [...SM_VERTICES, ...EFFECTIVE_VERTICES];
