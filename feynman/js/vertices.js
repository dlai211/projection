// // js/vertices.js
// export const SM_VERTICES = [
//     // --- QED (Fermion-Antifermion-Photon) ---
//     // Charged leptons
//     { particles: ['e⁻', 'e⁺', 'γ'], interaction: 'QED' },
//     { particles: ['μ⁻', 'μ⁺', 'γ'], interaction: 'QED' },
//     { particles: ['τ⁻', 'τ⁺', 'γ'], interaction: 'QED' },
//     // Quarks (flavor conserving)
//     { particles: ['u', 'ū', 'γ'], interaction: 'QED' },
//     { particles: ['d', 'd̄', 'γ'], interaction: 'QED' },
//     { particles: ['s', 's̄', 'γ'], interaction: 'QED' },
//     { particles: ['c', 'c̄', 'γ'], interaction: 'QED' },
//     { particles: ['b', 'b̄', 'γ'], interaction: 'QED' },
//     { particles: ['t', 't̄', 'γ'], interaction: 'QED' },

//     // --- Weak Neutral Current (NC: Fermion-Antifermion-Z0) ---
//     { particles: ['e⁻', 'e⁺', 'Z⁰'], interaction: 'Weak-NC' },
//     { particles: ['νe', 'ν̄e', 'Z⁰'], interaction: 'Weak-NC' },
//     { particles: ['μ⁻', 'μ⁺', 'Z⁰'], interaction: 'Weak-NC' },
//     { particles: ['νμ', 'ν̄μ', 'Z⁰'], interaction: 'Weak-NC' },
//     { particles: ['u', 'ū', 'Z⁰'], interaction: 'Weak-NC' },
//     { particles: ['d', 'd̄', 'Z⁰'], interaction: 'Weak-NC' },

//     // --- Weak Charged Current (CC: Leptons & Quarks via W±) ---
//     // Leptons (strictly conserve family lepton number)
//     { particles: ['e⁻', 'ν̄e', 'W⁺'], interaction: 'Weak-CC' }, // or e- -> νe + W-
//     { particles: ['e⁺', 'νe', 'W⁻'], interaction: 'Weak-CC' },
//     { particles: ['μ⁻', 'ν̄μ', 'W⁺'], interaction: 'Weak-CC' },
//     { particles: ['μ⁺', 'νμ', 'W⁻'], interaction: 'Weak-CC' },
//     // Quarks (CKM mixing allows cross-generation transitions)
//     { particles: ['u', 'd̄', 'W⁺'], interaction: 'Weak-CC' },
//     { particles: ['u', 's̄', 'W⁺'], interaction: 'Weak-CC' },
//     { particles: ['c', 's̄', 'W⁺'], interaction: 'Weak-CC' },
//     { particles: ['c', 'd̄', 'W⁺'], interaction: 'Weak-CC' },

//     // --- Strong / QCD ---
//     // Quark-Gluon (color-changing, strictly flavor-conserving)
//     { particles: ['u', 'ū', 'g'], interaction: 'QCD' },
//     { particles: ['d', 'd̄', 'g'], interaction: 'QCD' },
//     { particles: ['s', 's̄', 'g'], interaction: 'QCD' },
//     { particles: ['g', 'g', 'g'], interaction: 'QCD-3gluon' },
//     { particles: ['g', 'g', 'g', 'g'], interaction: 'QCD-4gluon' }
// ];


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
    // By defining the base decay, crossing symmetry handles all 2->1 and 1->2 variants.
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
    { in: ['g'], out: ['g', 'g'] },       // 3-gluon
    { in: ['g', 'g'], out: ['g', 'g'] },  // 4-gluon

    // --- Higgs ---
    { in: ['h'], out: ['W⁺', 'W⁻'] },
    { in: ['h'], out: ['Z⁰', 'Z⁰'] },
    { in: ['t'], out: ['t', 'h'] },
    { in: ['b'], out: ['b', 'h'] },
];