// js/channel.js
// Application controller: drop zones, presets, the particle panel and the wiring
// between the search engine and the results view.

import { FeynmanEngine } from './classifier.js';
import { findProcesses } from './topology.js';
import { renderParticlePanel, renderResults } from './ui.js';
import { initMassTooltips } from './directory.js';
import { identifyHadron, HADRONS } from './hadrons.js';

const engine = new FeynmanEngine();

const initialParticles = [];
const finalParticles = [];

const initialDropZone = document.getElementById('initialDropZone');
const finalDropZone = document.getElementById('finalDropZone');
const resultsEl = document.getElementById('channelGrid');
const errorEl = document.getElementById('errorDisplay');
const multiplicitySelect = document.getElementById('maxMultiplicity');

let lastSearch = { channels: [], initial: [], final: [], truncated: false };

// ------------------------------------------------------------- drop zones

function renderDropZone(zoneElement, particleArray, zoneType) {
    zoneElement.innerHTML = '';
    particleArray.forEach((p, index) => {
        const chip = document.createElement('span');
        chip.className = 'particle-chip';
        chip.innerHTML = `<span class="chip-symbol"></span> <button data-index="${index}" data-zone="${zoneType}" aria-label="Remove">×</button>`;
        chip.querySelector('.chip-symbol').textContent = p;
        zoneElement.appendChild(chip);
    });
    zoneElement.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index, 10);
            if (btn.dataset.zone === 'initial') initialParticles.splice(idx, 1);
            else finalParticles.splice(idx, 1);
            refreshZones();
            clearError();
        });
    });
}

/**
 * If the particles sitting in a drop zone are the valence quarks of a known
 * hadron, say so with the same brace notation the canvas uses.
 *
 * Flavour-neutral pairs are reported as a possibility rather than a fact: a uū
 * pair is a component of pi0 and of eta, and pi0 is the superposition
 * (uū - dd̄)/sqrt2, so no single quark pair determines the particle.
 */
function hadronHintFor(particles) {
    if (particles.length < 2 || particles.length > 3) return null;
    if (particles.some(p => engine.isHadron(p))) return null;

    const result = identifyHadron(particles);
    if (!result) return null;

    if (result.ambiguous) {
        const names = result.candidates.map(c => c.symbol);
        return {
            brace: `} ${result.genericLabel}`,
            text: names.length ? `could be ${names.join(' or ')}` : 'flavour mixture',
            uncertain: true
        };
    }

    const info = HADRONS[result.symbol];
    const also = result.alternatives.length ? ` · also ${result.alternatives.join(', ')}` : '';
    return { brace: `} ${result.symbol}`, text: `${info.name}${also}`, uncertain: false };
}

function renderHadronHint(groupEl, particles) {
    groupEl.querySelector('.hadron-hint')?.remove();
    const hint = hadronHintFor(particles);
    if (!hint) return;

    const el = document.createElement('div');
    el.className = 'hadron-hint' + (hint.uncertain ? ' uncertain' : '');
    el.innerHTML = '<span class="hint-brace"></span><span class="hint-text"></span>';
    el.querySelector('.hint-brace').textContent = hint.brace;
    el.querySelector('.hint-text').textContent = hint.text;
    groupEl.appendChild(el);
}

function refreshZones() {
    renderDropZone(initialDropZone, initialParticles, 'initial');
    renderDropZone(finalDropZone, finalParticles, 'final');
    renderHadronHint(initGroup, initialParticles);
    renderHadronHint(finGroup, finalParticles);
}

function addParticleToZone(symbol, zoneType) {
    if (!symbol) return;
    const target = zoneType === 'initial' ? initialParticles : finalParticles;
    if (target.length >= 2 && zoneType === 'initial') {
        showError('At most 2 initial-state particles are supported.');
        return;
    }
    target.push(symbol);
    refreshZones();
    clearError();
}

function clearError() { errorEl.style.display = 'none'; }
function showError(msg) { errorEl.style.display = 'block'; errorEl.textContent = msg; }

// --------------------------------------------------------- drag and click

function bindParticleInputs() {
    document.querySelectorAll('.particle-icon').forEach(icon => {
        icon.addEventListener('dragstart', (e) => {
            const symbol = icon.dataset.symbol || icon.textContent.trim();
            e.dataTransfer.setData('text/plain', symbol);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    document.querySelectorAll('.entry').forEach(entry => {
        entry.style.cursor = 'pointer';
        entry.addEventListener('click', () => {
            const icon = entry.querySelector('.particle-icon');
            if (icon) addParticleToZone(icon.dataset.symbol || icon.textContent.trim(), activeZone);
        });
    });
}

[{ zone: initialDropZone, type: 'initial' }, { zone: finalDropZone, type: 'final' }].forEach(({ zone, type }) => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const symbol = e.dataTransfer.getData('text/plain');
        if (symbol) addParticleToZone(symbol, type);
    });
});

let activeZone = 'initial';
const initGroup = document.getElementById('initialStateGroup');
const finGroup = document.getElementById('finalStateGroup');

function setActiveZone(zone) {
    activeZone = zone;
    initGroup.classList.toggle('active-group', zone === 'initial');
    finGroup.classList.toggle('active-group', zone === 'final');
}

initGroup.addEventListener('click', () => setActiveZone('initial'));
finGroup.addEventListener('click', () => setActiveZone('final'));
setActiveZone('initial');

document.querySelectorAll('.clear-zone').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.zone === 'initial') initialParticles.length = 0;
        else finalParticles.length = 0;
        refreshZones();
        clearError();
        resultsEl.innerHTML = '';
    });
});

// ------------------------------------------------------------- generation

function generateDiagram() {
    clearError();

    const inP = [...initialParticles];
    const outP = [...finalParticles];

    if (!inP.length) {
        showError('Add initial particles');
        resultsEl.innerHTML = '';
        return;
    }
    if (inP.length > 2) {
        showError('At most 2 initial-state particles are supported.');
        return;
    }

    const maxMultiplicity = Number(multiplicitySelect?.value || 3);
    const started = performance.now();
    const result = findProcesses(engine, inP, outP, { maxMultiplicity });
    const elapsed = Math.round(performance.now() - started);

    if (result.type === 'invalid') {
        showError(result.reason);
        resultsEl.innerHTML = '';
        return;
    }

    lastSearch = {
        channels: result.channels,
        initial: inP,
        final: outP,
        truncated: result.truncated
    };

    renderResults(resultsEl, {
        channels: result.channels,
        initial: inP,
        final: outP,
        engine,
        truncated: result.truncated
    });

    const timing = document.createElement('div');
    timing.className = 'search-timing';
    timing.textContent = `searched in ${elapsed} ms`;
    resultsEl.querySelector('.results-summary')?.appendChild(timing);
}

document.getElementById('generateBtn').addEventListener('click', generateDiagram);
multiplicitySelect?.addEventListener('change', () => {
    if (initialParticles.length) generateDiagram();
});

// ----------------------------------------------------------------- presets

const PRESETS = {
    // Elementary
    'moller':          { in: ['e⁻', 'e⁻'], out: ['e⁻', 'e⁻'] },
    'annihilation':    { in: ['e⁻', 'e⁺'], out: ['μ⁻', 'μ⁺'] },
    'compton':         { in: ['e⁻', 'γ'],  out: ['e⁻', 'γ'] },
    'bhabha':          { in: ['e⁻', 'e⁺'], out: ['e⁻', 'e⁺'] },
    'pair-production': { in: ['e⁻', 'e⁺'], out: ['γ', 'γ'] },
    'muon-decay':      { in: ['μ⁻'],       out: ['e⁻', 'ν̄e', 'νμ'] },
    'gluon4':          { in: ['g', 'g'],   out: ['g', 'g'] },

    // Hadronic
    'pion-decay':      { in: ['π⁺'],       out: ['μ⁺', 'νμ'] },
    'pion-radiative':  { in: ['π⁰'],       out: ['γ', 'γ'] },
    'neutron-beta':    { in: ['n'],        out: ['p', 'e⁻', 'ν̄e'] },
    'kaon-decay':      { in: ['K⁺'],       out: ['μ⁺', 'νμ'] },
    'lambda-decay':    { in: ['Λ'],        out: ['p', 'π⁻'] },
    'omega-decay':     { in: ['Ω⁻'],       out: ['Λ', 'K⁻'] },
    'ee-to-pions':     { in: ['e⁻', 'e⁺'], out: ['π⁺', 'π⁻'] },
    'pion-search':     { in: ['π⁺'],       out: [] }
};

function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return false;

    initialParticles.length = 0;
    finalParticles.length = 0;
    initialParticles.push(...preset.in);
    finalParticles.push(...preset.out);

    refreshZones();
    generateDiagram();
    return true;
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

// ------------------------------------------------------------------- start

renderParticlePanel(document.querySelector('.left-panel'));
bindParticleInputs();
initMassTooltips();
refreshZones();

// #preset-name in the URL opens straight to a process, so a diagram is linkable.
if (location.hash.length > 1) applyPreset(decodeURIComponent(location.hash.slice(1)));
