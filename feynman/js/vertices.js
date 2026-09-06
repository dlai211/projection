// js/vertices.js
export const SM_VERTICES = [
    // --- QED (Fermion-Antifermion-Photon) ---
    // Charged leptons
    { particles: ['e⁻', 'e⁺', 'γ'], interaction: 'QED' },
    { particles: ['μ⁻', 'μ⁺', 'γ'], interaction: 'QED' },
    { particles: ['τ⁻', 'τ⁺', 'γ'], interaction: 'QED' },
    // Quarks (flavor conserving)
    { particles: ['u', 'ū', 'γ'], interaction: 'QED' },
    { particles: ['d', 'd̄', 'γ'], interaction: 'QED' },
    { particles: ['s', 's̄', 'γ'], interaction: 'QED' },
    { particles: ['c', 'c̄', 'γ'], interaction: 'QED' },
    { particles: ['b', 'b̄', 'γ'], interaction: 'QED' },
    { particles: ['t', 't̄', 'γ'], interaction: 'QED' },

    // --- Weak Neutral Current (NC: Fermion-Antifermion-Z0) ---
    { particles: ['e⁻', 'e⁺', 'Z⁰'], interaction: 'Weak-NC' },
    { particles: ['νe', 'ν̄e', 'Z⁰'], interaction: 'Weak-NC' },
    { particles: ['μ⁻', 'μ⁺', 'Z⁰'], interaction: 'Weak-NC' },
    { particles: ['νμ', 'ν̄μ', 'Z⁰'], interaction: 'Weak-NC' },
    { particles: ['u', 'ū', 'Z⁰'], interaction: 'Weak-NC' },
    { particles: ['d', 'd̄', 'Z⁰'], interaction: 'Weak-NC' },

    // --- Weak Charged Current (CC: Leptons & Quarks via W±) ---
    // Leptons (strictly conserve family lepton number)
    { particles: ['e⁻', 'ν̄e', 'W⁺'], interaction: 'Weak-CC' }, // or e- -> νe + W-
    { particles: ['e⁺', 'νe', 'W⁻'], interaction: 'Weak-CC' },
    { particles: ['μ⁻', 'ν̄μ', 'W⁺'], interaction: 'Weak-CC' },
    { particles: ['μ⁺', 'νμ', 'W⁻'], interaction: 'Weak-CC' },
    // Quarks (CKM mixing allows cross-generation transitions)
    { particles: ['u', 'd̄', 'W⁺'], interaction: 'Weak-CC' },
    { particles: ['u', 's̄', 'W⁺'], interaction: 'Weak-CC' },
    { particles: ['c', 's̄', 'W⁺'], interaction: 'Weak-CC' },
    { particles: ['c', 'd̄', 'W⁺'], interaction: 'Weak-CC' },

    // --- Strong / QCD ---
    // Quark-Gluon (color-changing, strictly flavor-conserving)
    { particles: ['u', 'ū', 'g'], interaction: 'QCD' },
    { particles: ['d', 'd̄', 'g'], interaction: 'QCD' },
    { particles: ['s', 's̄', 'g'], interaction: 'QCD' },
    { particles: ['g', 'g', 'g'], interaction: 'QCD-3gluon' },
    { particles: ['g', 'g', 'g', 'g'], interaction: 'QCD-4gluon' }
];