(function() {
      // Simple particle definitions for Feynman generator
      const PARTICLE_LIST = [
        { symbol: 'e-', antiparticle: 'e+' },
        { symbol: 'mu-', antiparticle: 'mu+' },
        { symbol: 'tau-', antiparticle: 'tau+' },
        { symbol: 've', antiparticle: 've~' },
        { symbol: 'vm', antiparticle: 'vm~' },
        { symbol: 'vt', antiparticle: 'vt~' },
        { symbol: 'u', antiparticle: 'u~' },
        { symbol: 'd', antiparticle: 'd~' },
        { symbol: 'c', antiparticle: 'c~' },
        { symbol: 's', antiparticle: 's~' },
        { symbol: 't', antiparticle: 't~' },
        { symbol: 'b', antiparticle: 'b~' },
        { symbol: 'W+', antiparticle: 'W-' },
        { symbol: 'gamma', antiparticle: null },
        { symbol: 'g', antiparticle: null },
        { symbol: 'Z', antiparticle: null },
        { symbol: 'H', antiparticle: null },
      ];

      const DECAY_MODES = {
        'mu-': { products: ['e-', 've~', 'vm'], label: 'μ⁻ → e⁻ ν̄ₑ ν_μ' },
        'tau-': { products: ['mu-', 'vm~', 'vt'], label: 'τ⁻ → μ⁻ ν̄_μ ν_τ' },
      };

      const initialParticles = [];
      const finalParticles = [];
      const initialDropZone = document.getElementById('initialDropZone');
      const finalDropZone = document.getElementById('finalDropZone');
      const canvas = document.getElementById('feynmanCanvas');
      const ctx = canvas.getContext('2d');

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

      [ { zone: initialDropZone, type: 'initial' }, { zone: finalDropZone, type: 'final' } ].forEach(({ zone, type }) => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
          e.preventDefault();
          zone.classList.remove('drag-over');
          const symbol = e.dataTransfer.getData('text/plain');
          if (symbol) addParticleToZone(symbol, type);
        });
      });

      function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
      function clearError() { document.getElementById('errorDisplay').style.display = 'none'; }
      function showError(msg) { const err = document.getElementById('errorDisplay'); err.style.display = 'block'; err.textContent = msg; }

      function drawFermion(x1,y1,x2,y2,label,isAnti,isIncoming){
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineWidth=2.5; ctx.strokeStyle='#1b221c'; ctx.stroke();
        let mx=(x1+x2)/2, my=(y1+y2)/2, angle=Math.atan2(y2-y1,x2-x1);
        let drawAngle = isAnti ? angle+Math.PI : angle;
        ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx-10*Math.cos(drawAngle-Math.PI/6), my-10*Math.sin(drawAngle-Math.PI/6));
        ctx.moveTo(mx,my); ctx.lineTo(mx-10*Math.cos(drawAngle+Math.PI/6), my-10*Math.sin(drawAngle+Math.PI/6)); ctx.stroke();
        ctx.font="bold 18px 'Segoe UI'"; ctx.fillStyle='#1b221c';
        if(isIncoming) ctx.fillText(label,x1-40,y1-8); else ctx.fillText(label,x2+10,y2-8);
      }

      function drawBoson(x1,y1,x2,y2,label){
        let dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy), angle=Math.atan2(dy,dx);
        ctx.save(); ctx.translate(x1,y1); ctx.rotate(angle); ctx.beginPath(); ctx.lineWidth=2.5; ctx.strokeStyle='#b45309';
        for(let i=0;i<=len;i+=1) ctx.lineTo(i, Math.sin(i*0.5)*5); ctx.stroke(); ctx.restore();
        if(label){ ctx.font="bold 18px 'Segoe UI'"; ctx.fillStyle='#b45309'; ctx.fillText(label,(x1+x2)/2-10,(y1+y2)/2-18); }
      }


    function s_channel(){
    const w = canvas.width;
    const h = canvas.height;

    // Center-based coordinates
    const centerW = w * 0.5;        
    const centerH = h * 0.5;        
    const spread = w * 0.22;        
    const verticalSpread = h * 0.2; 

    const leftX = centerW - spread;          
    const vertexX = centerW - spread * 0.35; 
    const rightX = centerW + spread * 0.35;  
    const outX = centerW + spread;           
    const topY = centerH - verticalSpread;   
    const bottomY = centerH + verticalSpread; 
    const upperOutY = centerH - verticalSpread; 
    const lowerOutY = centerH + verticalSpread; 

    drawFermion(leftX, topY, vertexX, centerH, 'e⁻', false, true);
    drawFermion(leftX, bottomY, vertexX, centerH, 'e⁺', true, true);
    drawBoson(vertexX, centerH, rightX, centerH, 'γ/Z');
    drawFermion(rightX, centerH, outX, upperOutY, 'μ⁻', false, false);
    drawFermion(rightX, centerH, outX, lowerOutY, 'μ⁺', true, false);
    }
    function t_channel(){
        const w = canvas.width;
        const h = canvas.height;

        // Center-based coordinates
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

        // Incoming: e⁻ (top left) and e⁻ (bottom left) -> outgoing: e⁻ (top right) and e⁻ (bottom right)
        // t-channel: vertical exchange, particles stay on same side
        drawFermion(leftX, topY, vertex1X, topY, 'e⁻', false, true);
        drawFermion(leftX, bottomY, vertex2X, bottomY, 'e⁻', false, true);
        drawBoson(vertex1X, topY, vertex2X, bottomY, 'γ/Z');
        drawFermion(vertex1X, topY, outX, topY, 'e⁻', false, false);
        drawFermion(vertex2X, bottomY, outX, bottomY, 'e⁻', false, false);
    }

    function u_channel(){
        const w = canvas.width;
        const h = canvas.height;

        // Center-based coordinates
        const centerW = w * 0.5;
        const centerH = h * 0.5;
        const spread = w * 0.22;
        const verticalSpread = h * 0.2;

        const leftX = centerW - spread;
        const vertex1X = centerW - spread * 0.35;
        const vertex2X = centerW + spread * 0.35;
        const outX = centerW + spread;
        const topY = centerH - verticalSpread;
        const bottomY = centerH + verticalSpread;

        // u-channel: crossed exchange, top incoming goes to bottom outgoing, bottom incoming goes to top outgoing
        drawFermion(leftX, topY, vertex1X, topY, 'e⁻', false, true);
        drawFermion(leftX, bottomY, vertex2X, bottomY, 'e⁻', false, true);
        drawBoson(vertex1X, topY, vertex2X, bottomY, 'γ/Z');
        drawFermion(vertex1X, topY, outX, bottomY, 'e⁻', false, false);
        drawFermion(vertex2X, bottomY, outX, topY, 'e⁻', false, false);
    }


      function generateDiagram(){
        clearCanvas(); clearError();
        let inP = [...initialParticles], outP = [...finalParticles];



        if(inP.length===0){ showError('Add initial particles'); return; }
        if(inP.length===1 && outP.length===0 && DECAY_MODES[inP[0]]){
          outP = DECAY_MODES[inP[0]].products;
          finalParticles.length=0; outP.forEach(p=>finalParticles.push(p));
          renderDropZone(finalDropZone, finalParticles, 'final');
        }
        if(inP.includes('mu-') && outP.includes('e-') && outP.includes('ve~')){
          drawFermion(100,200,250,200,'μ⁻',false,true);
          drawBoson(250,200,400,130,'W⁻');
          drawFermion(400,130,550,80,'e⁻',false,false);
          drawFermion(400,130,550,180,'νμ',true,false);
          drawFermion(250,200,400,300,'ν̄ₑ',false,false);
        } else if(inP.includes('e-') && inP.includes('e+') && outP.includes('mu-') && outP.includes('mu+')){
          t_channel();
        } else {
          drawFermion(80,160,250,200,inP[0]||'?',false,true);
          if(inP[1]) drawFermion(80,280,250,200,inP[1],false,true);
          drawBoson(250,200,420,200,'');
          drawFermion(420,200,560,150,outP[0]||'?',false,false);
          if(outP[1]) drawFermion(420,200,560,250,outP[1],false,false);
        }
      }

      document.querySelectorAll('.preset-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          initialParticles.length=0; finalParticles.length=0;
          const p=btn.dataset.preset;
          if(p==='moller'){ initialParticles.push('e-','e-'); finalParticles.push('e-','e-'); }
          else if(p==='annihilation'){ initialParticles.push('e-','e+'); finalParticles.push('mu-','mu+'); }
          else if(p==='compton'){ initialParticles.push('e-','gamma'); finalParticles.push('e-','gamma'); }
          else if(p==='bhabha'){ initialParticles.push('e-','e+'); finalParticles.push('e-','e+'); }
          else if(p==='muon-decay'){ initialParticles.push('mu-'); }
          renderDropZone(initialDropZone, initialParticles, 'initial');
          renderDropZone(finalDropZone, finalParticles, 'final');
          generateDiagram();
        });
      });

      document.getElementById('generateBtn').addEventListener('click', generateDiagram);
      renderDropZone(initialDropZone, initialParticles, 'initial');
      renderDropZone(finalDropZone, finalParticles, 'final');
    })();