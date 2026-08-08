class FeynmanTopologyClassifier {
    constructor() {
        // Define particle properties
        this.particleDatabase = {
            // Fermions (matter particles)
            'e⁻': { type: 'fermion', charge: -1, generation: 1, lepton: true, mass: 0.511 },
            'e⁺': { type: 'antifermion', charge: 1, generation: 1, lepton: true, mass: 0.511 },
            'μ⁻': { type: 'fermion', charge: -1, generation: 2, lepton: true, mass: 105.7 },
            'μ⁺': { type: 'antifermion', charge: 1, generation: 2, lepton: true, mass: 105.7 },
            'τ⁻': { type: 'fermion', charge: -1, generation: 3, lepton: true, mass: 1777 },
            'τ⁺': { type: 'antifermion', charge: 1, generation: 3, lepton: true, mass: 1777 },
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
            'γ': { type: 'boson', charge: 0, spin: 1, mediator: 'EM' },
            'g': { type: 'boson', charge: 0, spin: 1, mediator: 'strong', color: true },
            'W⁺': { type: 'boson', charge: 1, spin: 1, mediator: 'weak' },
            'W⁻': { type: 'boson', charge: -1, spin: 1, mediator: 'weak' },
            'Z⁰': { type: 'boson', charge: 0, spin: 1, mediator: 'weak' },
            'h': { type: 'boson', charge: 0, spin: 0, mediator: 'higgs' },
        };

        // Define allowed vertices in the Standard Model
        this.allowedVertices = this.initializeVertexRules();
    }

    /**
     * Initialize vertex rules for the Standard Model
     * Each rule specifies:
     * - particles: array of particle types involved
     * - type: '3-point' or '4-point'
     * - mediator: which mediator is involved
     */
    initializeVertexRules() {
        return {
            // QED vertices
            'fermion-fermion-photon': {
                parent: ['fermion'],
                daughters: ['fermion', 'γ'],
            },

            'antifermion-antifermion-photon': {
                parent: ['antifermion'],
                daughters: ['antifermion', 'γ'],
            },

            'fermion-antifermion-photon': {
                parent: ['γ'],
                daughters: ['antifermion', 'fermion'],
            }

            // 'fermion-fermion-photon': {
            //     particles: ['fermion', 'fermion', 'γ'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Fermion-fermion-photon vertex'
            // },

            // 'fermion-antifermion-photon': {
            //     particles: ['fermion', 'antifermion', 'γ'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Fermion-antifermion-photon vertex'
            // },
            
            // // QCD vertices (gluons can self-interact)
            // 'quark-quark-gluon': {
            //     particles: ['quark', 'antiquark', 'g'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Quark-antiquark-gluon vertex'
            // },
            // 'triple-gluon': {
            //     particles: ['g', 'g', 'g'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Triple gluon vertex'
            // },
            // 'four-gluon': {
            //     particles: ['g', 'g', 'g', 'g'],
            //     type: '4-point',
            //     allowed: true,
            //     description: 'Four gluon vertex'
            // },
            
            // // Weak interactions
            // 'fermion-fermion-W': {
            //     particles: ['fermion', 'fermion', 'W'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Charged current vertex',
            //     condition: (a, b) => {
            //         // Check if this is a valid charged current (up-down type transition)
            //         return this.isValidWeakChargedCurrent(a, b);
            //     }
            // },
            // 'fermion-antifermion-Z': {
            //     particles: ['fermion', 'antifermion', 'Z⁰'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Neutral current vertex'
            // },
            
            // // Electroweak gauge boson interactions
            // 'triple-gauge-WWgamma': {
            //     particles: ['W⁺', 'W⁻', 'γ'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'WWγ vertex'
            // },
            // 'triple-gauge-WWZ': {
            //     particles: ['W⁺', 'W⁻', 'Z⁰'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'WWZ vertex'
            // },
            // 'four-gauge': {
            //     particles: ['W', 'W', 'W', 'W'],
            //     type: '4-point',
            //     allowed: true,
            //     description: 'Four W boson vertex'
            // },
            // 'four-gauge-WWZZ': {
            //     particles: ['W⁺', 'W⁻', 'Z⁰', 'Z⁰'],
            //     type: '4-point',
            //     allowed: true,
            //     description: 'WWZZ vertex'
            // },
            // 'four-gauge-WWgammaZ': {
            //     particles: ['W⁺', 'W⁻', 'γ', 'Z⁰'],
            //     type: '4-point',
            //     allowed: true,
            //     description: 'WWγZ vertex'
            // },
            
            // // Higgs interactions
            // 'fermion-fermion-higgs': {
            //     particles: ['fermion', 'antifermion', 'h'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Yukawa coupling'
            // },
            // 'higgs-WW': {
            //     particles: ['h', 'W⁺', 'W⁻'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Higgs-WW coupling'
            // },
            // 'higgs-ZZ': {
            //     particles: ['h', 'Z⁰', 'Z⁰'],
            //     type: '3-point',
            //     allowed: true,
            //     description: 'Higgs-ZZ coupling'
            // }
        };
    }

    /**
     * Check if a vertex is valid according to the Standard Model
     */
    isValidVertex(particleTypes) {
        // Check all known vertices
        for (const [vertexName, vertexRule] of Object.entries(this.allowedVertices)) {
            if (vertexRule.particles.length !== particleTypes.length) continue;
            
            // Check if the particle types match (order independent)
            const requiredParticles = [...vertexRule.particles];
            const providedParticles = [...particleTypes];
            
            // Sort and compare
            requiredParticles.sort();
            providedParticles.sort();
            
            if (JSON.stringify(requiredParticles) === JSON.stringify(providedParticles)) {
                return { valid: true, vertex: vertexName, rule: vertexRule };
            }
        }
        
        return { valid: false, reason: 'No matching vertex rule found' };
    }

    /**
     * Check if a weak charged current is valid (needs up-down type transition)
     */
    isValidWeakChargedCurrent(particle1, particle2) {
        // Lepton-neutrino coupling
        if ((particle1.lepton && particle2.neutrino) || 
            (particle1.neutrino && particle2.lepton)) {
            return true;
        }
        
        // Quark mixing (simplified - assumes CKM allowed)
        if (particle1.quark && particle2.quark) {
            const charge1 = Math.abs(particle1.charge);
            const charge2 = Math.abs(particle2.charge);
            // Allow up-type to down-type transitions
            return (Math.abs(charge1 - charge2) > 0.1);
        }
        
        return false;
    }

    /**
     * Determine if a particle can be a propagator in a specific channel
     */
    canBePropagator(particleType, vertexType) {
        const propagators = {
            's-channel': {
                'γ': true, 'Z⁰': true, 'h': true, 'W⁺': true, 'W⁻': true,
                'g': true, 'fermion': false, 'antifermion': false
            },
            't-channel': {
                'γ': true, 'Z⁰': true, 'W⁺': true, 'W⁻': true,
                'g': true, 'fermion': true, 'antifermion': true,
                'h': true
            }
        };
        
        return propagators[vertexType]?.[particleType] ?? false;
    }

    /**
     * Main classification function
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
        if (numInitial === 2 && numFinal === 2) {
            return this.classify2to2Scattering(initial, final);
        } else if (numInitial === 1 && numFinal === 3) {
            return this.classifyDecay(initial, final);
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
     * Classify 2→2 scattering processes with proper vertex rules
     */
    classify2to2Scattering(initial, final) {
        const a = initial[0];
        const b = initial[1];
        const c = final[0];
        const d = final[1];
        
        const channels = [];
        
        // Check s-channel (annihilation)
        if (this.canAnnihilate(a, b) && this.canPairProduce(c, d)) {
            const sMediator = this.determineSChannelMediator(a, b, c, d);
            if (sMediator) {
                // Verify s-channel vertex is valid
                const initialVertex = this.isValidVertex([a.type, b.type, sMediator]);
                const finalVertex = this.isValidVertex([c.type, d.type, sMediator]);
                
                if (initialVertex.valid && finalVertex.valid) {
                    channels.push({
                        type: 's-channel',
                        priority: 1,
                        mediator: sMediator,
                        vertices: [initialVertex.vertex, finalVertex.vertex],
                        layout: this.getSChannelLayout(sMediator),
                        valid: true
                    });
                }
            }
        }
        
        // Check t-channel (scattering) - but with correct mediator rules
        const tMediator = this.determineTChannelMediator(a, c, b, d);
        if (tMediator) {
            const upperVertex = this.isValidVertex([a.type, tMediator, c.type]);
            const lowerVertex = this.isValidVertex([b.type, tMediator, d.type]);
            
            if (upperVertex.valid && lowerVertex.valid) {
                channels.push({
                    type: 't-channel',
                    priority: 2,
                    mediator: tMediator,
                    vertices: [upperVertex.vertex, lowerVertex.vertex],
                    layout: this.getTChannelLayout(),
                    valid: true
                });
            }
        }
        
        // Check u-channel (crossed scattering)
        const uMediator = this.determineUChannelMediator(a, d, b, c);
        if (uMediator) {
            const upperVertex = this.isValidVertex([a.type, uMediator, d.type]);
            const lowerVertex = this.isValidVertex([b.type, uMediator, c.type]);
            
            if (upperVertex.valid && lowerVertex.valid) {
                channels.push({
                    type: 'u-channel',
                    priority: 3,
                    mediator: uMediator,
                    vertices: [upperVertex.vertex, lowerVertex.vertex],
                    layout: this.getUChannelLayout(),
                    valid: true
                });
            }
        }
        
        // Special case for processes involving photons
        if (channels.length === 0) {
            const specialChannels = this.handleSpecialCases(a, b, c, d);
            channels.push(...specialChannels);
        }
        
        return {
            type: '2to2_scattering',
            channels: channels.filter(c => c.valid).sort((a, b) => a.priority - b.priority),
            primaryChannel: channels[0],
            topology: channels[0]?.type || 'unknown',
            layout: channels[0]?.layout || this.getDefaultLayout()
        };
    }

    /**
     * Determine s-channel mediator based on particle types and vertex rules
     */
    determineSChannelMediator(a, b, c, d) {
        const initialCharge = a.charge + b.charge;
        const finalCharge = c.charge + d.charge;
        
        // Neutral current
        if (Math.abs(initialCharge) < 0.01 && Math.abs(finalCharge) < 0.01) {
            if (a.lepton && b.lepton) return 'γ';  // Lepton pair annihilation to photons
            if (a.lepton && c.quark) return 'γ';   // Lepton to quark via photon
            
            // If both initial and final are leptons but different generations
            if (a.lepton && c.lepton && a.generation !== c.generation) {
                // Could be γ or Z, prefer γ for EM processes
                return 'γ';
            }
            
            // For e+e- → μ+μ-, also possible via γ
            if (a.lepton && c.lepton) return 'γ';
        }
        
        // Charged current
        if (Math.abs(initialCharge) === 1 && Math.abs(finalCharge) === 1) {
            return initialCharge > 0 ? 'W⁺' : 'W⁻';
        }
        
        return null;
    }

    /**
     * Determine t-channel mediator with proper vertex rules
     */
    determineTChannelMediator(a, c, b, d) {
        // Check if initial and final particles have the same charge (for fermion exchange)
        if (Math.abs(a.charge - c.charge) < 0.01 && Math.abs(b.charge - d.charge) < 0.01) {
            // Photon exchange between charged particles
            if (a.charge !== 0 && !a.neutrino && !c.neutrino) {
                // Exclude photon self-interaction (no 3-photon vertex)
                if (a.mediator !== 'EM' && c.mediator !== 'EM') {
                    return 'γ';
                }
            }
            
            // Gluon exchange between quarks
            if (a.quark && c.quark && b.quark && d.quark) {
                return 'g';
            }
            
            // Fermion exchange (if initial and final are different but same type)
            if (a.fermion && c.boson && b.boson && d.fermion) {
                return 'fermion';  // e.g., Compton scattering
            }
        }
        
        // W exchange for charged current
        if (Math.abs(a.charge - c.charge) === 1 && a.lepton && c.neutrino) {
            return a.charge > c.charge ? 'W⁺' : 'W⁻';
        }
        
        return null;
    }

    /**
     * Determine u-channel mediator
     */
    determineUChannelMediator(a, d, b, c) {
        // Similar logic to t-channel but crossed
        if (Math.abs(a.charge - d.charge) < 0.01 && Math.abs(b.charge - c.charge) < 0.01) {
            if (a.charge !== 0 && !a.neutrino && !d.neutrino) {
                if (a.mediator !== 'EM' && d.mediator !== 'EM') {
                    return 'γ';
                }
            }
            
            if (a.quark && d.quark && b.quark && c.quark) {
                return 'g';
            }
            
            if (a.fermion && d.boson && b.boson && c.fermion) {
                return 'fermion';  // u-channel Compton
            }
        }
        
        return null;
    }

    /**
     * Handle special cases like Compton scattering
     */
    handleSpecialCases(a, b, c, d) {
        const channels = [];
        
        // Compton scattering: e⁻ + γ → e⁻ + γ
        if ((a.fermion && b.mediator === 'EM' && c.fermion && d.mediator === 'EM') ||
            (a.mediator === 'EM' && b.fermion && c.fermion && d.mediator === 'EM')) {
            
            // Compton has s-channel and u-channel with fermion propagator
            if (this.isSameType(a, c) || this.isSameType(a, d)) {
                // s-channel with fermion exchange (internal electron line)
                channels.push({
                    type: 's-channel',
                    mediator: 'fermion',
                    particle: a.fermion ? a.symbol : c.symbol,
                    priority: 1,
                    layout: this.getSChannelLayout('fermion'),
                    valid: true,
                    vertices: ['fermion-fermion-photon', 'fermion-fermion-photon']
                });
                
                // u-channel with fermion exchange
                channels.push({
                    type: 'u-channel',
                    mediator: 'fermion',
                    particle: a.fermion ? a.symbol : c.symbol,
                    priority: 3,
                    layout: this.getUChannelLayout(),
                    valid: true,
                    vertices: ['fermion-fermion-photon', 'fermion-fermion-photon']
                });
            }
        }
        
        return channels;
    }

    /**
     * Check if two particles can annihilate (improved)
     */
    canAnnihilate(a, b) {
        // Particle-antiparticle pair
        if ((a.type === 'fermion' && b.type === 'antifermion') ||
            (a.type === 'antifermion' && b.type === 'fermion')) {
            return Math.abs(a.charge + b.charge) < 0.01;
        }
        
        // W+W- annihilation
        if ((a.symbol === 'W⁺' && b.symbol === 'W⁻') ||
            (a.symbol === 'W⁻' && b.symbol === 'W⁺')) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if two particles can be pair produced
     */
    canPairProduce(c, d) {
        return this.canAnnihilate(c, d);
    }

    /**
     * Check if two particles are the same type
     */
    isSameType(a, b) {
        return a.symbol === b.symbol;
    }

    // ... (keep the rest of the methods: checkConservation, getParticleInfo, layout generators, etc.)
    // These remain the same as in the original code
    
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

    getParticleInfo(symbol) {
        const info = this.particleDatabase[symbol] || {
            type: 'unknown',
            charge: 0,
            symbol: symbol
        };
        return { ...info, symbol };
    }

    getSChannelLayout(mediator = 'boson') {
        return {
            type: 's-channel',
            vertices: [
                { id: 'v1', x: 0.3, y: 0.5 },
                { id: 'v2', x: 0.7, y: 0.5 }
            ],
            lines: [
                { from: 'left_top', to: 'v1', label: 'initial[0]' },
                { from: 'left_bottom', to: 'v1', label: 'initial[1]' },
                { from: 'v1', to: 'v2', style: 'mediator', label: mediator },
                { from: 'v2', to: 'right_top', label: 'final[0]' },
                { from: 'v2', to: 'right_bottom', label: 'final[1]' }
            ]
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

    classifyDecay(initial, final) {
        const parent = initial[0];
        const daughters = final;
        
        if (parent.lepton && parent.generation > 1) {
            return {
                type: 'weak_decay',
                topology: '3-body_decay',
                mediator: 'W',
                vertices: 2,
                layout: {
                    vertices: [
                        { id: 'v1', x: 0.3, y: 0.5 },
                        { id: 'v2', x: 0.7, y: 0.3 }
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
        const vertices = [];
        const lines = [];
        
        for (let i = 0; i < numVertices; i++) {
            vertices.push({
                id: `v${i+1}`,
                x: 0.3 + (i * 0.3 / (numVertices - 1 || 1)),
                y: 0.5
            });
        }
        
        for (let i = 0; i < numVertices - 1; i++) {
            lines.push({
                from: `v${i+1}`,
                to: `v${i+2}`,
                style: 'mediator'
            });
        }
        
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

// Test cases
console.log('Compton scattering:', JSON.stringify(classifier.classifyProcess(['e⁻', 'γ'], ['e⁻', 'γ']), null, 2));
console.log('\nMøller scattering:', JSON.stringify(classifier.classifyProcess(['e⁻', 'e⁻'], ['e⁻', 'e⁻']), null, 2));
console.log('\nAnnihilation:', JSON.stringify(classifier.classifyProcess(['e⁻', 'e⁺'], ['μ⁻', 'μ⁺']), null, 2));
console.log('\nMuon decay:', JSON.stringify(classifier.classifyProcess(['μ⁻'], ['e⁻', 'ν̄e', 'vμ']), null, 2));
console.log('\nGluon fusion:', JSON.stringify(classifier.classifyProcess(['g', 'g'], ['t', 't̄']), null, 2));

// Export for use in your main code
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FeynmanTopologyClassifier;
}