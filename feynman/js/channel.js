import { FeynmanEngine } from './classifier.js';

const engine = new FeynmanEngine();

const initialParticles = [];
const finalParticles = [];
const initialDropZone = document.getElementById('initialDropZone');
const finalDropZone = document.getElementById('finalDropZone');
const channelGrid = document.getElementById('channelGrid');

function renderDropZone(zoneElement, particleArray, zoneType) {
    zoneElement.innerHTML = '';
    particleArray.forEach((p, index) => {
        const chip = document.createElement('span');
        chip.className = 'particle-chip';
        chip.innerHTML = `${p} <button data-index="${index}" data-zone="${zoneType}">×</button>`;
        zoneElement.appendChild(chip);
    });
    zoneElement.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            if (btn.dataset.zone === 'initial') {
                initialParticles.splice(idx, 1);
                renderDropZone(initialDropZone, initialParticles, 'initial');
            } else {
                finalParticles.splice(idx, 1);
                renderDropZone(finalDropZone, finalParticles, 'final');
            }
            clearError();
        });
    });
}

function addParticleToZone(symbol, zoneType) {
    if (!symbol) return;
    if (zoneType === 'initial') {
        initialParticles.push(symbol);
        renderDropZone(initialDropZone, initialParticles, 'initial');
    } else {
        finalParticles.push(symbol);
        renderDropZone(finalDropZone, finalParticles, 'final');
    }
    clearError();
}

document.querySelectorAll('.particle-icon').forEach(icon => {
    icon.addEventListener('dragstart', (e) => {
        let symbol = icon.textContent.trim();
        e.dataTransfer.setData('text/plain', symbol);
        e.dataTransfer.effectAllowed = 'copy';
    });
});

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

function clearError() { document.getElementById('errorDisplay').style.display = 'none'; }
function showError(msg) { const err = document.getElementById('errorDisplay'); err.style.display = 'block'; err.textContent = msg; }
function clearChannelGrid() { if (channelGrid) channelGrid.innerHTML = ''; }

// Fullscreen Overlay Setup
const fullscreenOverlay = document.createElement('div');
fullscreenOverlay.className = 'diagram-overlay';
const fullscreenPanel = document.createElement('div');
fullscreenPanel.className = 'diagram-overlay-panel';
const fullscreenClose = document.createElement('button');
fullscreenClose.className = 'diagram-overlay-close';
fullscreenClose.textContent = '×';
const fullscreenTitle = document.createElement('div');
fullscreenTitle.className = 'diagram-overlay-title';
const fullscreenImage = document.createElement('img');
fullscreenImage.className = 'diagram-overlay-image';

fullscreenPanel.append(fullscreenClose, fullscreenTitle, fullscreenImage);
fullscreenOverlay.appendChild(fullscreenPanel);
document.body.appendChild(fullscreenOverlay);

function openFullscreenPlot(canvasElement, titleText) {
    fullscreenImage.src = canvasElement.toDataURL('image/png');
    fullscreenTitle.textContent = titleText;
    fullscreenOverlay.classList.add('visible');
}

function closeFullscreenPlot() {
    fullscreenOverlay.classList.remove('visible');
    fullscreenImage.removeAttribute('src');
}

fullscreenOverlay.addEventListener('click', (e) => { if (e.target === fullscreenOverlay) closeFullscreenPlot(); });
fullscreenClose.addEventListener('click', closeFullscreenPlot);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFullscreenPlot(); });

// Drawing Functions
function drawFermion(context, x1, y1, x2, y2, symbol, type, labelOffset=[0, 0]) {
    const info = engine.getParticleInfo(symbol);
    const isAnti = (info.type === 'antifermion' || info.Q > 0) && !info.name.includes('Quark');
    
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineWidth = 2.5;
    context.strokeStyle = '#1b221c';
    context.stroke();
    
    let mx = (x1 + x2) / 2, my = (y1 + y2) / 2, angle = Math.atan2(y2 - y1, x2 - x1);
    let drawAngle = isAnti ? angle + Math.PI : angle;
    context.beginPath();
    context.moveTo(mx, my);
    context.lineTo(mx - 10 * Math.cos(drawAngle - Math.PI / 6), my - 10 * Math.sin(drawAngle - Math.PI / 6));
    context.moveTo(mx, my);
    context.lineTo(mx - 10 * Math.cos(drawAngle + Math.PI / 6), my - 10 * Math.sin(drawAngle + Math.PI / 6));
    context.stroke();
    
    context.font = "bold 32px 'Segoe UI'";
    context.fillStyle = '#1b221c';
    if (type === 'incoming') context.fillText(symbol, x1 + labelOffset[0], y1 + labelOffset[1]);
    else if (type === 'outgoing') context.fillText(symbol, x2 + labelOffset[0], y2 + labelOffset[1]);
    else if (type === 'mediator') context.fillText(symbol, (x1 + x2) / 2 + labelOffset[0], (y1 + y2) / 2 + labelOffset[1]);
}

function drawBoson(context, x1, y1, x2, y2, symbol, type, labelOffset=[0, 0]) {
    if (symbol === 'g' || symbol === 'gluon') return drawGluon(context, x1, y1, x2, y2, symbol);
    
    let dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
    const isW = symbol === 'W⁺' || symbol === 'W⁻';
    
    context.save();
    context.translate(x1, y1);
    context.rotate(angle);
    context.beginPath();
    context.lineWidth = 2.5;
    context.strokeStyle = isW ? '#e74c3c' : '#b45309';
    
    for (let i = 0; i <= len; i += 1) {
        context.lineTo(i, Math.sin(i * 0.5) * 5);
    }
    context.stroke();
    context.restore();
    
    context.font = "bold 30px 'Segoe UI'";
    context.fillStyle = isW ? '#e74c3c' : '#b45309';
    
    if (type === 'incoming') context.fillText(symbol, x1 + labelOffset[0], y1 + labelOffset[1]);
    else if (type === 'outgoing') context.fillText(symbol, x2 + labelOffset[0], y2 + labelOffset[1]);
    else if (type === 'mediator') {
        context.font = "bold 27px 'Segoe UI'";
        context.fillText(symbol, (x1 + x2) / 2 + labelOffset[0], (y1 + y2) / 2 + labelOffset[1]);
    }
}

function drawGluon(context, x1, y1, x2, y2, symbol, type, labelOffset=[0, 0]) {
    let dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
    context.save();
    context.translate(x1, y1);
    context.rotate(angle);
    context.beginPath();
    context.lineWidth = 2.5;
    context.strokeStyle = '#27ae60';
    
    // Parametric looping function
    const loops = Math.floor(len / 14); 
    const freq = (loops * Math.PI * 2) / len;
    const amp = 7;
    context.moveTo(0, 0);
    
    for (let x_base = 0; x_base <= len; x_base += 0.5) {
        let x = x_base - amp * 0.75 * Math.sin(x_base * freq);
        let y = amp * Math.cos(x_base * freq) - amp; 
        context.lineTo(x, y);
    }
    
    context.stroke();
    context.restore(); 
    
    context.font = "bold 27px 'Segoe UI'";
    context.fillStyle = '#27ae60';
        // context.fillText(symbol, (x1 + x2) / 2, (y1 + y2) / 2 - 22);


    if (type === 'incoming') context.fillText(symbol, x1 + labelOffset[0], y1 + labelOffset[1]);
    else if (type === 'outgoing') context.fillText(symbol, x2 + labelOffset[0], y2 + labelOffset[1]);
    else if (type === 'mediator') {
        context.font = "bold 27px 'Segoe UI'";
        context.fillText(symbol, (x1 + x2) / 2 + labelOffset[0], (y1 + y2) / 2 + labelOffset[1]);
    }
}

function drawBlob(context, x, y, radius, label) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fill();
}

function drawParticleLine(context, x1, y1, x2, y2, symbol, type, labelOffset=[0, 0]) {
    const info = engine.getParticleInfo(symbol);
    if (info.type === 'boson') {
        drawBoson(context, x1, y1, x2, y2, symbol, type, labelOffset);
    } else if (info.type === 'scalar') {
        drawScalar(context, x1, y1, x2, y2, symbol, type, labelOffset);
    } else if (info.type === 'gluon') {
        drawGluon(context, x1, y1, x2, y2, symbol, type, labelOffset);
    } else {
        drawFermion(context, x1, y1, x2, y2, symbol, type, labelOffset);
    }
}

function drawScalar(context, x1, y1, x2, y2, symbol, type, labelOffset=[0, 0]) {
    context.beginPath();
    context.setLineDash([8, 6]);
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.lineWidth = 2.5;
    context.strokeStyle = '#1b221c';
    context.stroke();
    context.setLineDash([]);
    
    context.font = "bold 32px 'Segoe UI'";
    context.fillStyle = '#1b221c';
    if (type === 'incoming') context.fillText(symbol, x1 + labelOffset[0], y1 + labelOffset[1]);
    else if (type === 'outgoing') context.fillText(symbol, x2 + labelOffset[0], y2 + labelOffset[1]);
    else if (type === 'mediator') context.fillText(symbol, (x1 + x2) / 2 + labelOffset[0], (y1 + y2) / 2 + labelOffset[1]);
}

function drawSChannel(context, initial, final, channel) {
    const w = 700, h = 400;
    const vertex1X = w * 0.35, vertex2X = w * 0.65;
    const centerH = h * 0.5;
    const topY = h * 0.25, bottomY = h * 0.75;
    
    drawBlob(context, vertex1X, centerH, 5, '');
    drawBlob(context, vertex2X, centerH, 5, '');
    
    const mediator = channel.mediator;

    drawParticleLine(context, w * 0.15, topY, vertex1X, centerH, initial[0], 'incoming', [-35, 0]);
    drawParticleLine(context, w * 0.15, bottomY, vertex1X, centerH, initial[1], 'incoming', [-35, 13]);
    drawParticleLine(context, vertex1X, centerH, vertex2X, centerH, mediator, 'mediator', [0, -20]);
    drawParticleLine(context, vertex2X, centerH, w * 0.85, topY, final[0], 'outgoing', [10, -6]);
    drawParticleLine(context, vertex2X, centerH, w * 0.85, bottomY, final[1], 'outgoing', [10, 13]);
}

function drawTChannel(context, initial, final, channel) {
    const w = 700, h = 400;
    const vertex1X = w * 0.43, vertex2X = w * 0.57;
    const topY = h * 0.25, bottomY = h * 0.75;
    
    drawBlob(context, vertex1X, topY, 6, '');
    drawBlob(context, vertex2X, bottomY, 6, '');
    
    const mediator = channel.mediator;

    drawParticleLine(context, w * 0.15, topY, vertex1X, topY, initial[0], 'incoming', [-40, 5]);
    drawParticleLine(context, w * 0.15, bottomY, vertex2X, bottomY, initial[1], 'incoming', [-40, 7]);
    drawParticleLine(context, vertex1X, topY, vertex2X, bottomY, mediator, 'mediator', [20, 0]);
    drawParticleLine(context, vertex1X, topY, w * 0.85, topY, final[0], 'outgoing', [20, 5]);
    drawParticleLine(context, vertex2X, bottomY, w * 0.85, bottomY, final[1], 'outgoing', [20, 7]);
}

function drawUChannel(context, initial, final, channel) {
    const w = 700, h = 400;
    const vertex1X = w * 0.43, vertex2X = w * 0.57;
    const topY = h * 0.25, bottomY = h * 0.75;
    
    drawBlob(context, vertex1X, topY, 6, '');
    drawBlob(context, vertex2X, bottomY, 6, '');
    
    const mediator = channel.mediator;

    drawParticleLine(context, w * 0.15, topY, vertex1X, topY, initial[0], 'incoming', [-40, 5]);
    drawParticleLine(context, w * 0.15, bottomY, vertex2X, bottomY, initial[1], 'incoming', [-40, 7]);
    drawParticleLine(context, vertex1X, topY, vertex2X, bottomY, mediator, 'mediator', [-45, 10]);
    
    // Final state crossing fixes U-channel graphical mapping
    drawParticleLine(context, vertex2X, bottomY, w * 0.85, topY, final[0], 'outgoing', [20, -6]);
    drawParticleLine(context, vertex1X, topY, w * 0.85, bottomY, final[1], 'outgoing', [20, 15]);
}

function drawContactChannel(context, initial, final, channel) {
    const w = 700, h = 400;
    const centerX = w * 0.5, centerY = h * 0.5;
    const topY = h * 0.2, bottomY = h * 0.8;
    
    drawBlob(context, centerX, centerY, 6, '');
    
    drawParticleLine(context, w * 0.3, topY, centerX, centerY, initial[0], 'incoming', [-35, 0]);
    drawParticleLine(context, w * 0.3, bottomY, centerX, centerY, initial[1], 'incoming', [-35, 13]);
    drawParticleLine(context, centerX, centerY, w * 0.7, topY, final[0], 'outgoing', [20, -6]);
    drawParticleLine(context, centerX, centerY, w * 0.7, bottomY, final[1], 'outgoing', [20, 13]);
}

function draw2BodyDecay(context, initial, final, channel) {
    const w = 700, h = 400;
    const v1X = w * 0.5, v1Y = h * 0.5;
    
    drawBlob(context, v1X, v1Y, 6, '');
    
    drawParticleLine(context, w * 0.2, v1Y, v1X, v1Y, initial[0], 'incoming', [-40, 0]);
    drawParticleLine(context, v1X, v1Y, w * 0.8, h * 0.25, final[0], 'outgoing', [25, 5]);
    drawParticleLine(context, v1X, v1Y, w * 0.8, h * 0.75, final[1], 'outgoing', [25, 7]);
}

function draw3BodyDecay(context, initial, final, channel) {
    const w = 700, h = 400;
    const v1X = w * 0.45, v1Y = h * 0.5;
    const v2X = w * 0.65, v2Y = h * 0.68; 
    
    drawBlob(context, v1X, v1Y, 5, '');
    drawBlob(context, v2X, v2Y, 5, '');
    
    drawParticleLine(context, w * 0.15, v1Y, v1X, v1Y, initial[0], 'incoming', [-40, 0]);
    drawParticleLine(context, v1X, v1Y, w * 0.85, h * 0.25, channel.p1, 'outgoing', [20, -10]);
    drawParticleLine(context, v1X, v1Y, v2X, v2Y, channel.mediator, 'mediator', [15, -10]);
    
    drawParticleLine(context, v2X, v2Y, w * 0.85, h * 0.55, channel.p2, 'outgoing', [20, 0]);
    drawParticleLine(context, v2X, v2Y, w * 0.85, h * 0.85, channel.p3, 'outgoing', [20, 13]);
}

function renderSingleChannelDiagram(canvasElement, channel, initial, final) {
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (channel.type === 's-channel') drawSChannel(ctx, initial, final, channel);
    else if (channel.type === 't-channel') drawTChannel(ctx, initial, final, channel);
    else if (channel.type === 'u-channel') drawUChannel(ctx, initial, final, channel);
    else if (channel.type === 'contact') drawContactChannel(ctx, initial, final, channel);
    else if (channel.type === '3-body_decay') draw3BodyDecay(ctx, initial, final, channel);
    else if (channel.type === '2-body_decay') draw2BodyDecay(ctx, initial, final, channel);
}

function createChannelCard(channel, inP, outP) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.style.cursor = 'pointer';

    const title = document.createElement('div');
    title.className = 'channel-title';
    
    // Show the output particles in the title
    const reactionText = finalParticles.length === 0 ? `${inP.join(' ')} → ${outP.join(' ')}  |  ` : '';
    title.textContent = reactionText + (channel.mediator === 'none' ? channel.type : `${channel.type} • ${channel.mediator}`);
    card.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.width = 700; canvas.height = 400;
    canvas.className = 'channel-canvas';
    card.appendChild(canvas);

    renderSingleChannelDiagram(canvas, channel, inP, outP);
    card.addEventListener('click', () => openFullscreenPlot(canvas, title.textContent));
    channelGrid.appendChild(card);
}

// Mathematical combinatorics to find all possible valid final states dynamically
function findValidFinalStates(inP) {
    const symbols = Object.keys(engine.particles);
    const validOutputs = [];

    // Generates combinations with replacement to catch identical particles (e.g., e- e-)
    function getCombos(arr, k) {
        if (k === 1) return arr.map(el => [el]);
        const results = [];
        arr.forEach((el, i) => {
            const subCombos = getCombos(arr.slice(i), k - 1);
            subCombos.forEach(sub => results.push([el, ...sub]));
        });
        return results;
    }

    let possibleFinals = [];
    if (inP.length === 1) {
        possibleFinals = [...getCombos(symbols, 2), ...getCombos(symbols, 3)];
    } else if (inP.length === 2) {
        possibleFinals = getCombos(symbols, 2);
    }

    possibleFinals.forEach(outP => {
        const result = engine.classifyProcess(inP, outP);
        if (result.type === 'valid') {
            result.channels.forEach(ch => {
                validOutputs.push({ outP, channel: ch });
            });
        }
    });
    
    return validOutputs;
}

function generateDiagram() {
    clearError();
    clearChannelGrid();
    
    let inP = [...initialParticles];
    let outP = [...finalParticles];
    
    if (inP.length === 0) return showError('Add initial particles');
    
    if (outP.length > 0) {
        // Standard single-process classification
        const classification = engine.classifyProcess(inP, outP);
        if (classification.type === 'invalid') return showError(classification.reason);
        classification.channels.forEach(channel => createChannelCard(channel, inP, outP));
    } else {
        // Find all valid physical processes from this initial state
        const validProcesses = findValidFinalStates(inP);
        if (validProcesses.length === 0) {
            return showError('No valid tree-level processes found for this initial state.');
        }
        validProcesses.forEach(({ outP, channel }) => createChannelCard(channel, inP, outP));
    }
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initialParticles.length = 0;
        finalParticles.length = 0;
        const p = btn.dataset.preset;
        
        // Note: Muon-decay no longer manually forces the final state, allowing the engine to discover it (changed)
        if (p === 'moller') initialParticles.push('e⁻', 'e⁻'), finalParticles.push('e⁻', 'e⁻');
        else if (p === 'annihilation') initialParticles.push('e⁻', 'e⁺'), finalParticles.push('μ⁻', 'μ⁺');
        else if (p === 'compton') initialParticles.push('e⁻', 'γ'), finalParticles.push('e⁻', 'γ');
        else if (p === 'bhabha') initialParticles.push('e⁻', 'e⁺'), finalParticles.push('e⁻', 'e⁺');
        else if (p === 'pair-production') initialParticles.push('e⁻', 'e⁺'), finalParticles.push('γ', 'γ');
        else if (p === 'muon-decay') initialParticles.push('μ⁻'), finalParticles.push('e⁻', 'ν̄e', 'νμ');
        else if (p === 'gluon4') initialParticles.push('g', 'g'), finalParticles.push('g', 'g');
        
        renderDropZone(initialDropZone, initialParticles, 'initial');
        renderDropZone(finalDropZone, finalParticles, 'final');
        generateDiagram();
    });
});


document.getElementById('generateBtn').addEventListener('click', generateDiagram);
renderDropZone(initialDropZone, initialParticles, 'initial');
renderDropZone(finalDropZone, finalParticles, 'final');

// --- Active State Group Selection & Click-to-Add Mechanics ---
let activeZone = 'initial';
const initGroup = document.getElementById('initialStateGroup');
const finGroup = document.getElementById('finalStateGroup');

function setActiveZone(zone) {
    activeZone = zone;
    if (initGroup && finGroup) {
        if (zone === 'initial') {
            initGroup.classList.add('active-group');
            finGroup.classList.remove('active-group');
        } else {
            finGroup.classList.add('active-group');
            initGroup.classList.remove('active-group');
        }
    }
}

if (initGroup && finGroup) {
    initGroup.addEventListener('click', () => setActiveZone('initial'));
    finGroup.addEventListener('click', () => setActiveZone('final'));
    setActiveZone('initial'); 
}

// Click anywhere on an entry block in the directory to insert the particle 
document.querySelectorAll('.entry').forEach(entry => {
    entry.style.cursor = 'pointer';
    entry.addEventListener('click', () => {
        const icon = entry.querySelector('.particle-icon');
        if (icon) addParticleToZone(icon.textContent.trim(), activeZone);
    });
});

// Clear zone functionality for both 'initial' and 'final' state drop zones
document.querySelectorAll('.clear-zone').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const zone = btn.dataset.zone;
        if (zone === 'initial') {
            initialParticles.length = 0;
            renderDropZone(initialDropZone, initialParticles, 'initial');
        } else {
            finalParticles.length = 0;
            renderDropZone(finalDropZone, finalParticles, 'final');
        }
        clearError();
        clearChannelGrid();
    });
});