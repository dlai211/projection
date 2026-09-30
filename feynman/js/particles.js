// js/particles.js
// Elementary particles of the Standard Model.
//   m          : mass in MeV (numeric, used by the kinematic check)
//   massLabel  : display string, preserves the original PDG precision
//   unc        : uncertainty string for the tooltip
//   label      : HTML shown inside the draggable icon
//   panel      : 'elementary' | 'hadron'  (which tab it belongs to)

export const PARTICLES = {
    // Leptons (Generations 1-3)
    'e⁻':  { name: 'Electron', type: 'fermion', spin: 0.5, Q: -1, Le:  1, Lmu:  0, Ltau:  0, B: 0, color: 'singlet', anti: 'e⁺',
             m: 0.51099895069, massLabel: '0.511 MeV', unc: '0.00000000016', label: 'e⁻', panel: 'elementary' },
    'e⁺':  { name: 'Positron', type: 'fermion', spin: 0.5, Q:  1, Le: -1, Lmu:  0, Ltau:  0, B: 0, color: 'singlet', anti: 'e⁻',
             m: 0.51099895069, massLabel: '0.511 MeV', unc: '0.00000000016', label: 'e⁺', panel: 'elementary' },
    'νe':  { name: 'Electron Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le:  1, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'ν̄e',
             m: 0, massLabel: '<27 eV', unc: '0', label: 'ν<sub>e</sub>', panel: 'elementary' },
    'ν̄e':  { name: 'Anti-Electron Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: -1, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'νe',
             m: 0, massLabel: '<0.45 eV', unc: '0', label: 'ν̄<sub>e</sub>', panel: 'elementary' },

    'μ⁻':  { name: 'Muon', type: 'fermion', spin: 0.5, Q: -1, Le:  0, Lmu:  1, Ltau:  0, B: 0, color: 'singlet', anti: 'μ⁺',
             m: 105.6583755, massLabel: '105.65 MeV', unc: '0.00000023', label: 'μ⁻', panel: 'elementary' },
    'μ⁺':  { name: 'Anti-Muon', type: 'fermion', spin: 0.5, Q:  1, Le:  0, Lmu: -1, Ltau:  0, B: 0, color: 'singlet', anti: 'μ⁻',
             m: 105.6583755, massLabel: '105.65 MeV', unc: '0.00000023', label: 'μ⁺', panel: 'elementary' },
    'νμ':  { name: 'Muon Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu:  1, Ltau: 0, B: 0, color: 'singlet', anti: 'ν̄μ',
             m: 0, massLabel: '<0.19 MeV', unc: '0', label: 'ν<sub>μ</sub>', panel: 'elementary' },
    'ν̄μ':  { name: 'Anti-Muon Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu: -1, Ltau: 0, B: 0, color: 'singlet', anti: 'νμ',
             m: 0, massLabel: '--', unc: '0', label: 'ν̄<sub>μ</sub>', panel: 'elementary' },

    'τ⁻':  { name: 'Tau', type: 'fermion', spin: 0.5, Q: -1, Le:  0, Lmu:  0, Ltau:  1, B: 0, color: 'singlet', anti: 'τ⁺',
             m: 1776.93, massLabel: '1776.93 MeV', unc: '0.09', label: 'τ⁻', panel: 'elementary' },
    'τ⁺':  { name: 'Anti-Tau', type: 'fermion', spin: 0.5, Q:  1, Le:  0, Lmu:  0, Ltau: -1, B: 0, color: 'singlet', anti: 'τ⁻',
             m: 1776.93, massLabel: '1776.93 MeV', unc: '0.09', label: 'τ⁺', panel: 'elementary' },
    'ντ':  { name: 'Tau Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu: 0, Ltau: 1, B: 0, color: 'singlet', anti: 'ν̄τ',
             m: 0, massLabel: '<18.2 MeV', unc: '0', label: 'ν<sub>τ</sub>', panel: 'elementary' },
    'ν̄τ':  { name: 'Anti-Tau Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu: 0, Ltau: -1, B: 0, color: 'singlet', anti: 'ντ',
             m: 0, massLabel: '--', unc: '0', label: 'ν̄<sub>τ</sub>', panel: 'elementary' },

    // Quarks (Generations 1-3)
    'u':   { name: 'Up Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'ū',
             m: 2.16, massLabel: '2.16 MeV', unc: '0.04', label: 'u', panel: 'elementary' },
    'ū':   { name: 'Anti-Up',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'u',
             m: 2.16, massLabel: '2.16 MeV', unc: '0.04', label: 'ū', panel: 'elementary' },
    'd':   { name: 'Down Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'd̄',
             m: 4.70, massLabel: '4.70 MeV', unc: '0.04', label: 'd', panel: 'elementary' },
    'd̄':   { name: 'Anti-Down',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'd',
             m: 4.70, massLabel: '4.70 MeV', unc: '0.04', label: 'd̄', panel: 'elementary' },

    'c':   { name: 'Charm Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'c̄',
             m: 1272.9, massLabel: '1.2729 GeV', unc: '0.0027', label: 'c', panel: 'elementary' },
    'c̄':   { name: 'Anti-Charm',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'c',
             m: 1272.9, massLabel: '1.2729 GeV', unc: '0.0027', label: 'c̄', panel: 'elementary' },
    's':   { name: 'Strange Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 's̄',
             m: 92.9, massLabel: '92.9 MeV', unc: '0.4', label: 's', panel: 'elementary' },
    's̄':   { name: 'Anti-Strange',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 's',
             m: 92.9, massLabel: '92.9 MeV', unc: '0.4', label: 's̄', panel: 'elementary' },

    't':   { name: 'Top Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 't̄',
             m: 172600, massLabel: '172.60 GeV', unc: '0.27', label: 't', panel: 'elementary' },
    't̄':   { name: 'Anti-Top',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 't',
             m: 172600, massLabel: '172.60 GeV', unc: '0.27', label: 't̄', panel: 'elementary' },
    'b':   { name: 'Bottom Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'b̄',
             m: 4185.9, massLabel: '4.1859 GeV', unc: '0.0034', label: 'b', panel: 'elementary' },
    'b̄':   { name: 'Anti-Bottom',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'b',
             m: 4185.9, massLabel: '4.1859 GeV', unc: '0.0034', label: 'b̄', panel: 'elementary' },

    // Gauge & Scalar Bosons
    'γ':   { name: 'Photon', type: 'boson', spin: 1, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'γ',
             m: 0, massLabel: '0', unc: '0', label: 'γ', panel: 'elementary' },
    'g':   { name: 'Gluon',  type: 'gluon', spin: 1, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'octet',   anti: 'g',
             m: 0, massLabel: '0', unc: '0', label: 'g', panel: 'elementary' },
    'W⁺':  { name: 'W+ Boson', type: 'boson', spin: 1, Q:  1, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'W⁻',
             m: 80362.5, massLabel: '80.3625 GeV', unc: '0.0077', label: 'W⁺', panel: 'elementary' },
    'W⁻':  { name: 'W- Boson', type: 'boson', spin: 1, Q: -1, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'W⁺',
             m: 80362.5, massLabel: '80.3625 GeV', unc: '0.0077', label: 'W⁻', panel: 'elementary' },
    'Z⁰':  { name: 'Z Boson',  type: 'boson', spin: 1, Q:  0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'Z⁰',
             m: 91187.9, massLabel: '91.1879 GeV', unc: '0.0020', label: 'Z⁰', panel: 'elementary' },
    'h':   { name: 'Higgs',    type: 'scalar', spin: 0, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'h',
             m: 125130, massLabel: '125.13 GeV', unc: '0.11', label: 'h', panel: 'elementary' }
};

// Layout of the "Elementary" tab. Each row is [particle, antiparticle?].
// Kept as data so index.html no longer duplicates the particle list.
export const ELEMENTARY_PANEL = [
    {
        category: 'quark', title: 'Quarks', badge: 'Spin 1/2', color: '#1f5e8e',
        groups: [
            { label: 'up-type',   rows: [['u', 'ū'], ['c', 'c̄'], ['t', 't̄']] },
            { label: 'down-type', rows: [['d', 'd̄'], ['s', 's̄'], ['b', 'b̄']] }
        ]
    },
    {
        category: 'lepton', title: 'Leptons', badge: 'Spin 1/2', color: '#2b6b5c',
        groups: [
            { label: 'charged',   rows: [['e⁻', 'e⁺'], ['μ⁻', 'μ⁺'], ['τ⁻', 'τ⁺']] },
            { label: 'neutrinos', rows: [['νe', 'ν̄e'], ['νμ', 'ν̄μ'], ['ντ', 'ν̄τ']] }
        ]
    },
    {
        category: 'boson', title: 'Bosons', badge: 'Spin 1', color: '#9b5e3b',
        groups: [
            { label: 'gauge',  rows: [['γ'], ['g'], ['W⁺', 'W⁻'], ['Z⁰']] },
            { label: 'scalar', rows: [['h']] }
        ]
    }
];

// Self-conjugate particles, listed in the footnote under the Bosons panel.
export const SELF_CONJUGATE = ['γ', 'g', 'Z⁰', 'h'];

export const MASS_SOURCE =
    'Mass taken from F. Takahashi et al. (Particle Data Group), to be published in Int. J. Mod. Phys. A41, 2630011 (2026)';

/** Formats a numeric mass in MeV for display, switching to GeV above 1 GeV. */
export function formatMass(mev) {
    if (!mev) return '0';
    return mev >= 1000 ? `${(mev / 1000).toFixed(3)} GeV` : `${mev.toFixed(2)} MeV`;
}
