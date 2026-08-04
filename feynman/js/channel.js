(function() {
    // Initialize the classifier
    const classifier = new FeynmanTopologyClassifier();
    
    const DECAY_MODES = {
        'mu-': { products: ['e⁻', 'ν̄e', 'vμ'], label: 'μ⁻ → e⁻ ν̄ₑ ν_μ' },
        'tau-': { products: ['μ⁻', 'ν̄μ', 'vt'], label: 'τ⁻ → μ⁻ ν̄_μ ν_τ' },
    };

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

    // Make left-panel icons draggable into drop zones
    document.querySelectorAll('.particle-icon').forEach(icon => {
        icon.addEventListener('dragstart', (e) => {
            let symbol = icon.textContent.trim();
            if (symbol.includes('ν')) symbol = symbol.replace(/[\u0305]/g, '~');
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

    function clearCanvas() { /* no single canvas in multi-channel mode */ }
    function clearError() { document.getElementById('errorDisplay').style.display = 'none'; }
    function showError(msg) { const err = document.getElementById('errorDisplay'); err.style.display = 'block'; err.textContent = msg; }
    function clearChannelGrid() {
        if (!channelGrid) return;
        channelGrid.innerHTML = '';
    }

    // Enhanced drawing functions with particle database integration
    function getParticleInfo(symbol) {
        return classifier.getParticleInfo(symbol);
    }

    function drawFermion(context, x1, y1, x2, y2, symbol, isIncoming) {
        const info = getParticleInfo(symbol);
        const isAnti = info.type === 'antifermion';
        
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
        
        context.font = "bold 18px 'Segoe UI'";
        context.fillStyle = '#1b221c';
        if (isIncoming) context.fillText(symbol, x1 - 40, y1 - 8);
        else context.fillText(symbol, x2 + 10, y2 - 8);
    }

    function drawBoson(context, x1, y1, x2, y2, label) {
        let dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
        
        if (label === 'g' || label === 'gluon') {
            drawGluon(context, x1, y1, x2, y2, label);
            return;
        }
        
        context.save();
        context.translate(x1, y1);
        context.rotate(angle);
        context.beginPath();
        context.lineWidth = 2.5;
        context.strokeStyle = label === 'W+' || label === 'W-' ? '#e74c3c' : '#b45309';
        
        for (let i = 0; i <= len; i += 1) {
            context.lineTo(i, Math.sin(i * 0.5) * 5);
        }
        context.stroke();
        context.restore();
        
        if (label) {
            context.font = "bold 18px 'Segoe UI'";
            context.fillStyle = label === 'W+' || label === 'W-' ? '#e74c3c' : '#b45309';
            context.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 18);
        }
    }

    function drawGluon(context, x1, y1, x2, y2, label) {
        let dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), angle = Math.atan2(dy, dx);
        
        context.save();
        context.translate(x1, y1);
        context.rotate(angle);
        context.beginPath();
        context.lineWidth = 2.5;
        context.strokeStyle = '#27ae60';
        
        const amplitude = 8;
        const frequency = 0.3;
        for (let i = 0; i <= len; i += 0.5) {
            const y = Math.sin(i * frequency) * amplitude;
            context.lineTo(i, y);
        }
        context.stroke();
        
        const midX = len / 2;
        context.beginPath();
        context.ellipse(midX, amplitude * 2, 6, 3, 0, 0, Math.PI * 2);
        context.stroke();
        
        context.restore();
        
        if (label) {
            context.font = "bold 18px 'Segoe UI'";
            context.fillStyle = '#27ae60';
            context.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 22);
        }
    }

    function drawVirtualParticle(context, x1, y1, x2, y2, label) {
        context.save();
        context.setLineDash([5, 5]);
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.lineWidth = 2.5;
        context.strokeStyle = '#8e44ad';
        context.stroke();
        context.setLineDash([]);
        context.restore();
        
        if (label) {
            context.font = "italic 16px 'Segoe UI'";
            context.fillStyle = '#8e44ad';
            context.fillText(label, (x1 + x2) / 2, (y1 + y2) / 2 - 18);
        }
    }

    function drawBlob(context, x, y, radius, label) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = '#f0f0f0';
        context.fill();
        context.strokeStyle = '#666';
        context.lineWidth = 2;
        context.stroke();
        
        if (label) {
            context.font = "bold 14px 'Segoe UI'";
            context.fillStyle = '#666';
            context.textAlign = 'center';
            context.fillText(label, x, y + radius + 15);
        }
    }

    // Channel drawing functions using classifier output
    function drawSChannel(context, layout, initial, final, channelLabel) {
        const w = 700;
        const h = 400;
        
        const centerW = w * 0.5;
        const centerH = h * 0.5;
        const spread = w * 0.22;
        const verticalSpread = h * 0.2;
        
        const leftX = centerW - spread;
        const vertexX = centerW - spread * 0.4;
        const rightX = centerW + spread * 0.4;
        const outX = centerW + spread;
        const topY = centerH - verticalSpread;
        const bottomY = centerH + verticalSpread;
        const upperOutY = centerH - verticalSpread;
        const lowerOutY = centerH + verticalSpread;
        
        drawBlob(context, vertexX, centerH, 5, '');
        drawBlob(context, rightX, centerH, 5, '');
        
        const result = classifier.classifyProcess(initial, final);
        const mediator = (channelLabel && channelLabel.mediator) || result.primaryChannel?.mediator || 'γ/Z';

        let ini0 = classifier.getParticleInfo(initial[0]);
        if (ini0.type === 'fermion' || ini0.type === 'antifermion') {
            drawFermion(context, leftX, topY, vertexX, centerH, initial[0], true);
        } else if (ini0.type === 'boson') {
            drawBoson(context, leftX, topY, vertexX, centerH, initial[0]);
        } else {
            showError('unknown particle');
        }

        let ini1 = classifier.getParticleInfo(initial[1]);
        if (ini1.type === 'fermion' || ini1.type === 'antifermion') {
            drawFermion(context, leftX, bottomY, vertexX, centerH, initial[1], true);
        } else if (ini1.type === 'boson') {
            drawBoson(context, leftX, bottomY, vertexX, centerH, initial[1]);
        } else {
            showError('unknown particle');
        }

        const mediatorInfo = classifier.getParticleInfo(mediator);
        if (mediatorInfo.type === 'boson' || mediator === 'γ/Z') {
            drawBoson(context, vertexX, centerH, rightX, centerH, mediator);
        } else if (mediatorInfo.type === 'fermion' || mediatorInfo.type === 'antifermion') {
            drawFermion(context, vertexX, centerH, rightX, centerH, mediator, false);
        } else {
            showError('unknown mediator');
        }

        let final0 = classifier.getParticleInfo(final[0]);
        if (final0.type === 'fermion' || final0.type === 'antifermion') {
            drawFermion(context, rightX, centerH, outX, upperOutY, final[0], false);
        } else if (final0.type === 'boson') {
            drawBoson(context, rightX, centerH, outX, upperOutY, final[0]);
        } else {
            showError('unknown particle');
        }

        let final1 = classifier.getParticleInfo(final[1]);
        if (final1.type === 'fermion' || final1.type === 'antifermion') {
            drawFermion(context, rightX, centerH, outX, lowerOutY, final[1], false);
        } else if (final1.type === 'boson') {
            drawBoson(context, rightX, centerH, outX, lowerOutY, final[1]);
        } else {
            showError('unknown particle');
        }
    }

    function drawTChannel(context, layout, initial, final, channelLabel) {
        const w = 700;
        const h = 400;
        
        const centerW = w * 0.5;
        const centerH = h * 0.5;
        const spread = w * 0.22;
        const verticalSpread = h * 0.2;
        
        const leftX = centerW - spread;
        const vertex1X = centerW - spread * 0.25;
        const vertex2X = centerW + spread * 0.25;
        const outX = centerW + spread;
        const topY = centerH - verticalSpread;
        const bottomY = centerH + verticalSpread;
        
        drawBlob(context, vertex1X, topY, 6, '');
        drawBlob(context, vertex2X, bottomY, 6, '');
        
        const result = classifier.classifyProcess(initial, final);
        const mediator = (channelLabel && channelLabel.mediator) || result.primaryChannel?.mediator || 'γ/Z';

        let ini0 = classifier.getParticleInfo(initial[0]);
        if (ini0.type === 'fermion' || ini0.type === 'antifermion') {
            drawFermion(context, leftX, topY, vertex1X, topY, initial[0], true);
        } else if (ini0.type === 'boson') {
            drawBoson(context, leftX, topY, vertex1X, topY, initial[0]);
        } else {
            showError('unknown particle');
        }

        let ini1 = classifier.getParticleInfo(initial[1]);
        if (ini1.type === 'fermion' || ini1.type === 'antifermion') {
            drawFermion(context, leftX, bottomY, vertex2X, bottomY, initial[1], true);
        } else if (ini1.type === 'boson') {
            drawBoson(context, leftX, bottomY, vertex2X, bottomY, initial[1]);
        } else {
            showError('unknown particle');
        }

        const mediatorInfo = classifier.getParticleInfo(mediator);
        if (mediatorInfo.type === 'boson' || mediator === 'γ/Z') {
            drawBoson(context, vertex1X, topY, vertex2X, bottomY, mediator);
        } else if (mediatorInfo.type === 'fermion' || mediatorInfo.type === 'antifermion') {
            drawFermion(context, vertex1X, topY, vertex2X, bottomY, mediator, false);
        } else {
            showError('unknown mediator');
        }

        let final0 = classifier.getParticleInfo(final[0]);
        if (final0.type === 'fermion' || final0.type === 'antifermion') {
            drawFermion(context, vertex1X, topY, outX, topY, final[0], false);
        } else if (final0.type === 'boson') {
            drawBoson(context, vertex1X, topY, outX, topY, final[0]);
        } else {
            showError('unknown particle');
        }

        let final1 = classifier.getParticleInfo(final[1]);
        if (final1.type === 'fermion' || final1.type === 'antifermion') {
            drawFermion(context, vertex2X, bottomY, outX, bottomY, final[1], false);
        } else if (final1.type === 'boson') {
            drawBoson(context, vertex2X, bottomY, outX, bottomY, final[1]);
        } else {
            showError('unknown particle');
        }
    }

    function drawUChannel(context, layout, initial, final, channelLabel) {
        const w = 700;
        const h = 400;
        
        const centerW = w * 0.5;
        const centerH = h * 0.5;
        const spread = w * 0.22;
        const verticalSpread = h * 0.2;
        
        const leftX = centerW - spread;
        const vertex1X = centerW - spread * 0.25;
        const vertex2X = centerW + spread * 0.25;
        const outX = centerW + spread;
        const topY = centerH - verticalSpread;
        const bottomY = centerH + verticalSpread;
        
        drawBlob(context, vertex1X, topY, 6, '');
        drawBlob(context, vertex2X, bottomY, 6, '');
        
        const result = classifier.classifyProcess(initial, final);
        const mediator = (channelLabel && channelLabel.mediator) || result.primaryChannel?.mediator || 'γ/Z';

        let ini0 = classifier.getParticleInfo(initial[0]);
        if (ini0.type === 'fermion' || ini0.type === 'antifermion') {
            drawFermion(context, leftX, topY, vertex1X, topY, initial[0], true);
        } else if (ini0.type === 'boson') {
            drawBoson(context, leftX, topY, vertex1X, topY, initial[0]);
        } else {
            showError('unknown particle');
        }

        let ini1 = classifier.getParticleInfo(initial[1]);
        if (ini1.type === 'fermion' || ini1.type === 'antifermion') {
            drawFermion(context, leftX, bottomY, vertex2X, bottomY, initial[1], true);
        } else if (ini1.type === 'boson') {
            drawBoson(context, leftX, bottomY, vertex2X, bottomY, initial[1]);
        } else {
            showError('unknown particle');
        }

        const mediatorInfo = classifier.getParticleInfo(mediator);
        if (mediatorInfo.type === 'boson' || mediator === 'γ/Z') {
            drawBoson(context, vertex1X, topY, vertex2X, bottomY, mediator);
        } else if (mediatorInfo.type === 'fermion' || mediatorInfo.type === 'antifermion') {
            drawFermion(context, vertex1X, topY, vertex2X, bottomY, mediator, false);
        } else {
            showError('unknown mediator');
        }

        let final0 = classifier.getParticleInfo(final[0]);
        if (final0.type === 'fermion' || final0.type === 'antifermion') {
            drawFermion(context, vertex1X, topY, outX, bottomY, final[1], false);
        } else if (final0.type === 'boson') {
            drawBoson(context, vertex1X, topY, outX, bottomY, final[0]);
        } else {
            showError('unknown particle');
        }

        let final1 = classifier.getParticleInfo(final[1]);
        if (final1.type === 'fermion' || final1.type === 'antifermion') {
            drawFermion(context, vertex2X, bottomY, outX, topY, final[1], false);
        } else if (final1.type === 'boson') {
            drawBoson(context, vertex2X, bottomY, outX, topY, final[1]);
        } else {
            showError('unknown particle');
        }
    }

    function drawDecay(context, layout, initial, final) {
        const w = 700;
        const h = 400;
        
        const centerH = h * 0.5;
        const vertexX = w * 0.45;
        const outX = w * 0.75;
        
        drawBlob(context, vertexX, centerH, 5, '');
        drawFermion(context, 100, centerH, vertexX, centerH, initial[0], true);
        
        if (final.length === 3) {
            drawFermion(context, vertexX, centerH, outX, centerH - 80, final[0], false);
            drawFermion(context, vertexX, centerH, outX, centerH + 80, final[1], false);
            drawBoson(context, vertexX, centerH, outX, centerH, final[2]?.includes('W') ? 'W' : '');
        } else if (final.length === 2) {
            drawFermion(context, vertexX, centerH, outX, centerH - 60, final[0], false);
            drawFermion(context, vertexX, centerH, outX, centerH + 60, final[1], false);
        }
    }

    function renderSingleChannelDiagram(canvasElement, channel, initial, final) {
        const channelCtx = canvasElement.getContext('2d');
        channelCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        channelCtx.fillStyle = '#fdfcf8';
        channelCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        channelCtx.textAlign = 'center';
        channelCtx.fillStyle = '#666';
        channelCtx.font = "14px 'Segoe UI'";
        channelCtx.fillText(channel.type, canvasElement.width / 2, 20);

        switch (channel.type) {
            case 's-channel':
                drawSChannel(channelCtx, channel.layout, initial, final, channel);
                break;
            case 't-channel':
                drawTChannel(channelCtx, channel.layout, initial, final, channel);
                break;
            case 'u-channel':
                drawUChannel(channelCtx, channel.layout, initial, final, channel);
                break;
            case '3-body_decay':
            case 'decay_2body':
                drawDecay(channelCtx, channel.layout, initial, final);
                break;
            default:
                const plainCtx = channelCtx;
                const w = canvasElement.width;
                const h = canvasElement.height;
                drawFermion(plainCtx, 80, h * 0.35, w * 0.4, h * 0.5, initial[0] || '?', true);
                if (initial[1]) drawFermion(plainCtx, 80, h * 0.65, w * 0.4, h * 0.5, initial[1], true);
                drawBoson(plainCtx, w * 0.4, h * 0.5, w * 0.6, h * 0.5, '');
                drawFermion(plainCtx, w * 0.6, h * 0.5, w * 0.85, h * 0.35, final[0] || '?', false);
                if (final[1]) drawFermion(plainCtx, w * 0.6, h * 0.5, w * 0.85, h * 0.65, final[1], false);
        }

        channelCtx.fillStyle = '#666';
        channelCtx.font = "14px 'Segoe UI'";
        channelCtx.textAlign = 'center';
        channelCtx.fillText(`Mediator: ${channel.mediator || 'γ/Z'}`, canvasElement.width / 2, canvasElement.height - 12);
    }

    function generateDiagram() {
        clearCanvas();
        clearError();
        clearChannelGrid();
        
        let inP = [...initialParticles];
        let outP = [...finalParticles];
        
        if (inP.length === 0) {
            showError('Add initial particles');
            return;
        }
        
        if (inP.length === 1 && outP.length === 0 && DECAY_MODES[inP[0]]) {
            outP = DECAY_MODES[inP[0]].products;
            finalParticles.length = 0;
            outP.forEach(p => finalParticles.push(p));
            renderDropZone(finalDropZone, finalParticles, 'final');
        }
        
        const classification = classifier.classifyProcess(inP, outP);
        
        if (classification.type === 'invalid') {
            showError(classification.reason || 'Invalid process');
            return;
        }

        const channels = classification.channels?.length ? classification.channels : [{ type: classification.topology, mediator: classification.primaryChannel?.mediator || classification.mediator || 'γ/Z', layout: classification.layout }];

        if (!channelGrid) {
            showError('Channel grid not found');
            return;
        }

        channels.forEach((channel, index) => {
            const card = document.createElement('div');
            card.className = 'channel-card';

            const title = document.createElement('div');
            title.className = 'channel-title';
            title.textContent = `${channel.type} • ${channel.mediator || 'γ/Z'}`;
            card.appendChild(title);

            const canvasElement = document.createElement('canvas');
            canvasElement.width = 700;
            canvasElement.height = 400;
            canvasElement.className = 'channel-canvas';
            card.appendChild(canvasElement);

            renderSingleChannelDiagram(canvasElement, channel, inP, outP);
            channelGrid.appendChild(card);
        });
    }

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            initialParticles.length = 0;
            finalParticles.length = 0;
            const p = btn.dataset.preset;
            
            if (p === 'moller') {
                initialParticles.push('e⁻', 'e⁻');
                finalParticles.push('e⁻', 'e⁻');
            } else if (p === 'annihilation') {
                initialParticles.push('e⁻', 'e⁺');
                finalParticles.push('μ⁻', 'μ⁺');
            } else if (p === 'compton') {
                initialParticles.push('e⁻', 'γ');
                finalParticles.push('e⁻', 'γ');
            } else if (p === 'bhabha') {
                initialParticles.push('e⁻', 'e⁺');
                finalParticles.push('e⁻', 'e⁺');
            } else if (p === 'muon-decay') {
                initialParticles.push('μ⁻');
            }
            
            renderDropZone(initialDropZone, initialParticles, 'initial');
            renderDropZone(finalDropZone, finalParticles, 'final');
            generateDiagram();
        });
    });

    document.getElementById('generateBtn').addEventListener('click', generateDiagram);
    renderDropZone(initialDropZone, initialParticles, 'initial');
    renderDropZone(finalDropZone, finalParticles, 'final');
})();

