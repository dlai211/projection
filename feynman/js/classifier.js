class FeynmanTopologyClassifier {
    constructor() {
        // Define particle properties
        this.particleDatabase = {
            // Fermions (matter particles)
            'e⁻': { type: 'fermion', charge: -1, generation: 1, lepton: true },
            'e⁺': { type: 'antifermion', charge: 1, generation: 1, lepton: true },
            'μ⁻': { type: 'fermion', charge: -1, generation: 2, lepton: true },
            'μ⁺': { type: 'antifermion', charge: 1, generation: 2, lepton: true },
            'τ⁻': { type: 'fermion', charge: -1, generation: 3, lepton: true },
            'τ⁺': { type: 'antifermion', charge: 1, generation: 3, lepton: true },
            've': { type: 'fermion', charge: 0, generation: 1, neutrino: true },
            'ν̄e': { type: 'antifermion', charge: 0, generation: 1, neutrino: true },
            'vμ': { type: 'fermion', charge: 0, generation: 2, neutrino: true },
            'ν̄μ': { type: 'antifermion', charge: 0, generation: 2, neutrino: true },
            'vt': { type: 'fermion', charge: 0, generation: 3, neutrino: true },
            'ν̄t': { type: 'antifermion', charge: 0, generation: 3, neutrino: true },
            
            // Quarks
            'u': { type: 'fermion', charge: 2/3, generation: 1, quark: true },
            'ū': { type: 'antifermion', charge: -2/3, generation: 1, quark: true },
            'd': { type: 'fermion', charge: -1/3, generation: 1, quark: true },
            'd̄': { type: 'antifermion', charge: 1/3, generation: 1, quark: true },
            'c': { type: 'fermion', charge: 2/3, generation: 2, quark: true },
            'c̄': { type: 'antifermion', charge: -2/3, generation: 2, quark: true },
            's': { type: 'fermion', charge: -1/3, generation: 2, quark: true },
            's̄': { type: 'antifermion', charge: 1/3, generation: 2, quark: true },
            't': { type: 'fermion', charge: 2/3, generation: 3, quark: true },
            't̄': { type: 'antifermion', charge: -2/3, generation: 3, quark: true },
            'b': { type: 'fermion', charge: -1/3, generation: 3, quark: true },
            'b̄': { type: 'antifermion', charge: 1/3, generation: 3, quark: true },
            
            // Bosons (force carriers)
            'γ': { type: 'boson', charge: 0, mediator: 'EM' },
            'g': { type: 'boson', charge: 0, mediator: 'strong' },
            'W⁺': { type: 'boson', charge: 1, mediator: 'weak' },
            'W⁻': { type: 'boson', charge: -1, mediator: 'weak' },
            'Z⁰': { type: 'boson', charge: 0, mediator: 'weak' },
            'h': { type: 'boson', charge: 0, mediator: 'higgs' },
        };
    }

    /**
     * Main classification function
     * @param {Array} initialParticles - Array of initial state particles
     * @param {Array} finalParticles - Array of final state particles
     * @returns {Object} Classification result with topology and diagram layout
     */
    classifyProcess(initialParticles, finalParticles) {
        const numInitial = initialParticles.length;
        const numFinal = finalParticles.length;
        
        // Basic validation
        if (numInitial === 0 || numFinal === 0) {
            return { type: 'invalid', reason: 'Missing particles' };
        }
        
        // Get particle properties
        const initial = initialParticles.map(p => this.getParticleInfo(p));
        const final = finalParticles.map(p => this.getParticleInfo(p));
        
        // Check conservation laws
        const conservationCheck = this.checkConservation(initial, final);
        if (!conservationCheck.valid) {
            return { 
                type: 'invalid', 
                reason: conservationCheck.reason,
                conservation: conservationCheck 
            };
        }
        
        // Determine topology based on particle count
        if (numInitial === 1 && numFinal === 3) {
            return this.classifyDecay(initial, final);
        } else if (numInitial === 2 && numFinal === 2) {
            return this.classify2to2Scattering(initial, final);
        } else if (numInitial === 1 && numFinal === 2) {
            return this.classify1to2Process(initial, final);
        } else if (numInitial === 2 && numFinal === 3) {
            return this.classify2to3Process(initial, final);
        } else if (numInitial >= 3 || numFinal >= 3) {
            return this.classifyMultiParticle(initial, final);
        }
        
        return { 
            type: 'unknown', 
            topology: 'custom',
            vertices: Math.max(numInitial, numFinal),
            layout: 'tree'
        };
    }

    /**
     * Classify 2→2 scattering processes
     */
    classify2to2Scattering(initial, final) {
        const a = initial[0];
        const b = initial[1];
        const c = final[0];
        const d = final[1];
        
        // Determine possible channels
        const channels = [];
        
        // Check s-channel possibility (annihilation)
        if (this.canAnnihilate(a, b) && this.canPairProduce(c, d)) {
            channels.push({
                type: 's-channel',
                priority: 1,
                mediator: this.determineMediator(a, b),
                layout: this.getSChannelLayout()
            });
        }
        
        // Check t-channel possibility (scattering)
        if (this.isSameType(a, c) && this.isSameType(b, d)) {
            channels.push({
                type: 't-channel',
                priority: 2,
                mediator: this.determineMediator(a, c),
                layout: this.getTChannelLayout()
            });
        }
        
        // Check u-channel possibility (crossed scattering)
        if (this.isSameType(a, d) && this.isSameType(b, c)) {
            channels.push({
                type: 'u-channel',
                priority: 3,
                mediator: this.determineMediator(a, d),
                layout: this.getUChannelLayout()
            });
        }
        
        // Special cases
        if (channels.length === 0) {
            // Try to determine based on particle types
            if (a.lepton && b.antifermion && c.lepton && d.antifermion) {
                channels.push({
                    type: 's-channel',
                    priority: 1,
                    mediator: 'γ/Z',
                    layout: this.getSChannelLayout()
                });
            } else if (a.quark && b.antifermion && c.quark && d.antifermion) {
                channels.push({
                    type: 's-channel',
                    priority: 1,
                    mediator: 'gluon',
                    layout: this.getSChannelLayout()
                });
            }
        }
        
        return {
            type: '2to2_scattering',
            channels: channels.sort((a, b) => a.priority - b.priority),
            primaryChannel: channels[0],
            topology: channels[0]?.type || 'unknown',
            layout: channels[0]?.layout || this.getDefaultLayout()
        };
    }

    /**
     * Classify decay processes (1→3)
     */
    classifyDecay(initial, final) {
        const parent = initial[0];
        const daughters = final;
        
        // Check if it's a known decay
        if (parent.lepton && parent.generation > 1) {
            // Lepton decay via W boson
            return {
                type: 'weak_decay',
                topology: '3-body_decay',
                mediator: 'W',
                vertices: 2,
                layout: {
                    vertices: [
                        { id: 'v1', x: 0.3, y: 0.5 },  // Decay vertex
                        { id: 'v2', x: 0.7, y: 0.3 }   // W decay vertex
                    ],
                    lines: [
                        { from: 'left', to: 'v1', particle: parent.symbol, type: 'fermion' },
                        { from: 'v1', to: 'v2', particle: 'W', type: 'boson' },
                        { from: 'v1', to: 'right_bottom', particle: daughters[0]?.symbol, type: 'fermion' },
                        { from: 'v2', to: 'right_top', particle: daughters[1]?.symbol, type: 'fermion' },
                        { from: 'v2', to: 'right_middle', particle: daughters[2]?.symbol, type: 'fermion' }
                    ]
                }
            };
        }
        
        return {
            type: 'decay',
            topology: '3-body',
            vertices: 1,
            layout: this.getDecayLayout()
        };
    }

    /**
     * Check conservation laws
     */
    checkConservation(initial, final) {
        let initialCharge = 0;
        let finalCharge = 0;
        
        initial.forEach(p => initialCharge += p.charge);
        final.forEach(p => finalCharge += p.charge);
        
        if (Math.abs(initialCharge - finalCharge) > 0.01) {
            return { 
                valid: false, 
                reason: `Charge not conserved: ${initialCharge} → ${finalCharge}`,
                initialCharge,
                finalCharge
            };
        }
        
        return { valid: true, initialCharge, finalCharge };
    }

    /**
     * Check if two particles can annihilate
     */
    canAnnihilate(a, b) {
        return (a.type === 'fermion' && b.type === 'antifermion' && 
                a.charge + b.charge === 0 && a.lepton === b.lepton) ||
               (a.type === 'antifermion' && b.type === 'fermion' && 
                a.charge + b.charge === 0 && a.lepton === b.lepton);
    }

    /**
     * Check if two particles can be pair produced
     */
    canPairProduce(c, d) {
        return this.canAnnihilate(c, d); // Same condition reversed
    }

    /**
     * Check if two particles are the same type
     */
    isSameType(a, b) {
        return a.symbol === b.symbol;
    }

    /**
     * Determine the mediator boson
     */
    determineMediator(a, b) {
        if (a.charge !== 0 || b.charge !== 0) {
            if (a.quark && b.quark) return 'gluon';
            if (a.lepton && b.lepton) return 'γ/Z';
            return 'W';
        }
        if (a.quark && b.quark) return 'gluon';
        return 'γ';
    }

    /**
     * Get particle info from symbol
     */
    getParticleInfo(symbol) {
        const info = this.particleDatabase[symbol] || {
            type: 'unknown',
            charge: 0,
            symbol: symbol
        };
        return { ...info, symbol };
    }

    /**
     * Layout generators for different channels
     */
    getSChannelLayout() {
        return {
            type: 's-channel',
            vertices: [
                { id: 'v1', x: 0.4, y: 0.5 }  // Single interaction vertex
            ],
            lines: [
                { from: 'left_top', to: 'v1', label: 'initial[0]' },
                { from: 'left_bottom', to: 'v1', label: 'initial[1]' },
                { from: 'v1', to: 'right_top', label: 'final[0]' },
                { from: 'v1', to: 'right_bottom', label: 'final[1]' }
            ],
            mediator: { from: 'v1', to: 'v1', style: 'internal' }
        };
    }

    getTChannelLayout() {
        return {
            type: 't-channel',
            vertices: [
                { id: 'v1', x: 0.4, y: 0.3 },
                { id: 'v2', x: 0.6, y: 0.7 }
            ],
            lines: [
                { from: 'left_top', to: 'v1', label: 'initial[0]' },
                { from: 'v1', to: 'right_top', label: 'final[0]' },
                { from: 'left_bottom', to: 'v2', label: 'initial[1]' },
                { from: 'v2', to: 'right_bottom', label: 'final[1]' },
                { from: 'v1', to: 'v2', style: 'mediator' }
            ]
        };
    }

    getUChannelLayout() {
        return {
            type: 'u-channel',
            vertices: [
                { id: 'v1', x: 0.4, y: 0.7 },
                { id: 'v2', x: 0.6, y: 0.3 }
            ],
            lines: [
                { from: 'left_top', to: 'v2', label: 'initial[0]' },
                { from: 'v2', to: 'right_bottom', label: 'final[1]' },
                { from: 'left_bottom', to: 'v1', label: 'initial[1]' },
                { from: 'v1', to: 'right_top', label: 'final[0]' },
                { from: 'v1', to: 'v2', style: 'mediator' }
            ]
        };
    }

    getDecayLayout() {
        return {
            type: 'decay',
            vertices: [
                { id: 'v1', x: 0.4, y: 0.5 }
            ],
            lines: [
                { from: 'left', to: 'v1', label: 'parent' },
                { from: 'v1', to: 'right_top', label: 'daughter1' },
                { from: 'v1', to: 'right_middle', label: 'daughter2' },
                { from: 'v1', to: 'right_bottom', label: 'daughter3' }
            ]
        };
    }

    getDefaultLayout() {
        return this.getSChannelLayout();
    }

    classify1to2Process(initial, final) {
        return {
            type: '1to2',
            topology: 'decay_2body',
            vertices: 1,
            layout: {
                vertices: [{ id: 'v1', x: 0.4, y: 0.5 }],
                lines: [
                    { from: 'left', to: 'v1' },
                    { from: 'v1', to: 'right_top' },
                    { from: 'v1', to: 'right_bottom' }
                ]
            }
        };
    }

    classify2to3Process(initial, final) {
        return {
            type: '2to3',
            topology: 'multi_vertex',
            vertices: 2,
            layout: {
                vertices: [
                    { id: 'v1', x: 0.3, y: 0.4 },
                    { id: 'v2', x: 0.7, y: 0.5 }
                ],
                lines: [
                    { from: 'left_top', to: 'v1' },
                    { from: 'left_bottom', to: 'v1' },
                    { from: 'v1', to: 'v2', style: 'mediator' },
                    { from: 'v2', to: 'right_top' },
                    { from: 'v2', to: 'right_middle' },
                    { from: 'v2', to: 'right_bottom' }
                ]
            }
        };
    }

    classifyMultiParticle(initial, final) {
        const numVertices = Math.ceil((initial.length + final.length) / 3);
        return {
            type: 'multi_particle',
            topology: 'complex',
            vertices: numVertices,
            layout: this.generateMultiVertexLayout(initial.length, final.length, numVertices)
        };
    }

    generateMultiVertexLayout(numIn, numOut, numVertices) {
        // Generate a tree-like layout for many particles
        const vertices = [];
        const lines = [];
        
        for (let i = 0; i < numVertices; i++) {
            vertices.push({
                id: `v${i+1}`,
                x: 0.3 + (i * 0.3 / (numVertices - 1 || 1)),
                y: 0.5
            });
        }
        
        // Connect vertices
        for (let i = 0; i < numVertices - 1; i++) {
            lines.push({
                from: `v${i+1}`,
                to: `v${i+2}`,
                style: 'mediator'
            });
        }
        
        // Attach external particles
        for (let i = 0; i < numIn; i++) {
            lines.push({
                from: 'left',
                to: `v${Math.min(i % numVertices + 1, numVertices)}`
            });
        }
        
        for (let i = 0; i < numOut; i++) {
            lines.push({
                from: `v${Math.min(i % numVertices + 1, numVertices)}`,
                to: 'right'
            });
        }
        
        return { vertices, lines };
    }
}

// Usage example:
const classifier = new FeynmanTopologyClassifier();

// Example classifications
console.log('Møller scattering:', classifier.classifyProcess(['e⁻', 'e⁻'], ['e⁻', 'e⁻']));
console.log('Annihilation:', classifier.classifyProcess(['e⁻', 'e⁺'], ['μ⁻', 'μ⁺']));
console.log('Muon decay:', classifier.classifyProcess(['μ⁻'], ['e⁻', 'ν̄e', 'vμ']));
console.log('Compton scattering:', classifier.classifyProcess(['e⁻', 'γ'], ['e⁻', 'γ']));

// Export for use in your main code
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeynmanTopologyClassifier;
}