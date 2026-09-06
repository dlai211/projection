import { PARTICLES } from './particles.js';
import { SM_VERTICES } from './vertices.js';

export class FeynmanEngine {
    constructor() {
        this.particles = PARTICLES;
        this.vertices = SM_VERTICES;
    }

    getParticleInfo(symbol) {
        if (!this.particles[symbol]) return { type: 'unknown', symbol, Q: 0, Le: 0, Lmu: 0, Ltau: 0, B: 0 };
        return { ...this.particles[symbol], symbol };
    }

    getAnti(symbol) {
        const info = this.getParticleInfo(symbol);
        return info.anti || symbol;
    }

    // Creates a canonical "all incoming" state for symmetry matching
    getCanonical(inParts, outParts) {
        const canonical = [...inParts, ...outParts.map(p => this.getAnti(p))];
        return canonical.sort();
    }

    checkVertex(inParts, outParts) {
        const target = this.getCanonical(inParts, outParts);
        const targetAnti = target.map(p => this.getAnti(p)).sort();

        return this.vertices.some(v => {
            const base = this.getCanonical(v.in || [], v.out || []);
            const matchesBase = target.length === base.length && target.every((p, i) => p === base[i]);
            const matchesAnti = targetAnti.length === base.length && targetAnti.every((p, i) => p === base[i]);
            return matchesBase || matchesAnti;
        });
    }

    checkConservation(initial, final) {
        let dQ = 0, dLe = 0, dLmu = 0, dLtau = 0, dB = 0;
        
        initial.forEach(p => {
            const info = this.getParticleInfo(p);
            dQ += info.Q; dLe += info.Le; dLmu += info.Lmu; dLtau += info.Ltau; dB += info.B;
        });
        
        final.forEach(p => {
            const info = this.getParticleInfo(p);
            dQ -= info.Q; dLe -= info.Le; dLmu -= info.Lmu; dLtau -= info.Ltau; dB -= info.B;
        });

        const isZero = (val) => Math.abs(val) < 1e-5;
        
        if (!isZero(dQ)) return { valid: false, reason: `Charge not conserved (ΔQ = ${dQ.toFixed(2)})` };
        if (!isZero(dB)) return { valid: false, reason: `Baryon number not conserved (ΔB = ${dB.toFixed(2)})` };
        if (!isZero(dLe)) return { valid: false, reason: `Electron number not conserved` };
        if (!isZero(dLmu)) return { valid: false, reason: `Muon number not conserved` };
        if (!isZero(dLtau)) return { valid: false, reason: `Tau number not conserved` };
        
        return { valid: true };
    }

    classifyProcess(initial, final) {
        if (initial.length === 0 || final.length === 0) return { type: 'invalid', reason: 'Missing particles' };

        const consCheck = this.checkConservation(initial, final);
        if (!consCheck.valid) return { type: 'invalid', reason: consCheck.reason };

        let channels = [];
        const possibleMediators = Object.keys(this.particles);

        // 2 -> 2 Scattering
        if (initial.length === 2 && final.length === 2) {
            const [A, B] = initial;
            const [C, D] = final;

            // Check for 4-Point Contact Interaction (e.g. g g -> g g)
            if (this.checkVertex([A, B], [C, D])) {
                channels.push({ type: 'contact', mediator: 'none' });
            }

            possibleMediators.forEach(X => {
                // s-channel: A + B -> X -> C + D
                if (this.checkVertex([A, B], [X]) && this.checkVertex([X], [C, D])) {
                    channels.push({ type: 's-channel', mediator: X });
                }
                // t-channel: A -> C + X, B + X -> D
                if (this.checkVertex([A], [C, X]) && this.checkVertex([B, X], [D])) {
                    channels.push({ type: 't-channel', mediator: X });
                }
                // u-channel: A -> D + X, B + X -> C
                if (this.checkVertex([A], [D, X]) && this.checkVertex([B, X], [C])) {
                    channels.push({ type: 'u-channel', mediator: X });
                }
            });
        } 
        // 1 -> 2 Decay (e.g. W -> e v)
        else if (initial.length === 1 && final.length === 2) {
            if (this.checkVertex(initial, final)) {
                channels.push({ type: '2-body_decay', mediator: 'none' });
            }
        }
        // 1 -> 3 Decay (e.g. muon decay)
        else if (initial.length === 1 && final.length === 3) {
            const [A] = initial;
            const [C, D, E] = final;
            
            possibleMediators.forEach(X => {
                const checkDecay = (p1, p2, p3) => {
                    if (this.checkVertex([A], [p1, X]) && this.checkVertex([X], [p2, p3])) {
                        channels.push({ type: '3-body_decay', mediator: X, p1, p2, p3 });
                    }
                };
                checkDecay(C, D, E);
                checkDecay(D, C, E);
                checkDecay(E, C, D);
            });
        }

        channels = channels.filter((c, index, self) => 
            index === self.findIndex((t) => t.type === c.type && t.mediator === c.mediator && t.p1 === c.p1)
        );

        if (channels.length === 0) return { type: 'invalid', reason: 'No valid tree-level Feynman diagrams found.' };

        return { type: 'valid', channels };
    }
}