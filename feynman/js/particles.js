// js/particles.js
export const PARTICLES = {
    // Leptons (Generations 1-3)
    'e⁻':  { name: 'Electron', type: 'fermion', spin: 0.5, Q: -1, Le:  1, Lmu:  0, Ltau:  0, B: 0, color: 'singlet', anti: 'e⁺' },
    'e⁺':  { name: 'Positron', type: 'fermion', spin: 0.5, Q:  1, Le: -1, Lmu:  0, Ltau:  0, B: 0, color: 'singlet', anti: 'e⁻' },
    'νe':  { name: 'Electron Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le:  1, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'ν̄e' },
    'ν̄e':  { name: 'Anti-Electron Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: -1, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'νe' },
    
    'μ⁻':  { name: 'Muon', type: 'fermion', spin: 0.5, Q: -1, Le:  0, Lmu:  1, Ltau:  0, B: 0, color: 'singlet', anti: 'μ⁺' },
    'μ⁺':  { name: 'Anti-Muon', type: 'fermion', spin: 0.5, Q:  1, Le:  0, Lmu: -1, Ltau:  0, B: 0, color: 'singlet', anti: 'μ⁻' },
    'νμ':  { name: 'Muon Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu:  1, Ltau: 0, B: 0, color: 'singlet', anti: 'ν̄μ' },
    'ν̄μ':  { name: 'Anti-Muon Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu: -1, Ltau: 0, B: 0, color: 'singlet', anti: 'νμ' },

    'τ⁻':  { name: 'Tau', type: 'fermion', spin: 0.5, Q: -1, Le:  0, Lmu:  0, Ltau:  1, B: 0, color: 'singlet', anti: 'τ⁺' },
    'τ⁺':  { name: 'Anti-Tau', type: 'fermion', spin: 0.5, Q:  1, Le:  0, Lmu:  0, Ltau: -1, B: 0, color: 'singlet', anti: 'τ⁻' },
    'ντ':  { name: 'Tau Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu:  0, Ltau: 1, B: 0, color: 'singlet', anti: 'ν̄τ' },
    'ν̄τ':  { name: 'Anti-Tau Neutrino', type: 'fermion', spin: 0.5, Q: 0, Le: 0, Lmu:  0, Ltau: -1, B: 0, color: 'singlet', anti: 'ντ' },

    // Quarks (Generations 1-3)
    'u':   { name: 'Up Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'ū' },
    'ū':   { name: 'Anti-Up',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'u' },
    'd':   { name: 'Down Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'd̄' },
    'd̄':   { name: 'Anti-Down',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'd' },
    
    'c':   { name: 'Charm Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'c̄' },
    'c̄':   { name: 'Anti-Charm',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'c' },
    's':   { name: 'Strange Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 's̄' },
    's̄':   { name: 'Anti-Strange',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 's' },
    
    't':   { name: 'Top Quark', type: 'fermion', spin: 0.5, Q:  2/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 't̄' },
    't̄':   { name: 'Anti-Top',  type: 'fermion', spin: 0.5, Q: -2/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 't' },
    'b':   { name: 'Bottom Quark', type: 'fermion', spin: 0.5, Q: -1/3, Le: 0, Lmu: 0, Ltau: 0, B: 1/3, color: 'triplet', anti: 'b̄' },
    'b̄':   { name: 'Anti-Bottom',  type: 'fermion', spin: 0.5, Q:  1/3, Le: 0, Lmu: 0, Ltau: 0, B:-1/3, color: 'triplet', anti: 'b' },

    // Gauge & Scalar Bosons
    'γ':   { name: 'Photon', type: 'boson', spin: 1, Q:  0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'γ' },
    'g':   { name: 'Gluon',  type: 'boson', spin: 1, Q:  0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'octet',   anti: 'g' },
    'W⁺':  { name: 'W+ Boson', type: 'boson', spin: 1, Q:  1, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'W⁻' },
    'W⁻':  { name: 'W- Boson', type: 'boson', spin: 1, Q: -1, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'W⁺' },
    'Z⁰':  { name: 'Z Boson',  type: 'boson', spin: 1, Q:  0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'Z⁰' },
    'h':   { name: 'Higgs',    type: 'scalar', spin: 0, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0, color: 'singlet', anti: 'h' }
};

export const HADRONS = {
    'p':    { name: 'Proton',   type: 'baryon', Q: 1,  B: 1, quarks: ['u', 'u', 'd'] },
    'n':    { name: 'Neutron',  type: 'baryon', Q: 0,  B: 1, quarks: ['u', 'd', 'd'] },
    'π⁺':   { name: 'Pion +',   type: 'meson',  Q: 1,  B: 0, quarks: ['u', 'd̄'] },
    'π⁻':   { name: 'Pion -',   type: 'meson',  Q: -1, B: 0, quarks: ['d', 'ū'] },
    'K⁺':   { name: 'Kaon +',   type: 'meson',  Q: 1,  B: 0, quarks: ['u', 's̄'] }
};