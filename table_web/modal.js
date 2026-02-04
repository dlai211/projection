(() => {
    // --- Image hover tooltip (uses data-img if present) ---
    let hoverTip = null;
    const mkHover = (target) => {
        const imgSrc = target.getAttribute('data-img');
        const tip = target.getAttribute('data-tip') || '';
        if (!imgSrc && !tip) return;

        hoverTip = document.createElement('div');
        hoverTip.className = 'img-tip';

        // Show image if available, otherwise only text
        hoverTip.innerHTML = imgSrc    
        ? `<img src="${imgSrc}" alt="definition">${tip ? `<div class="img-tip-cap">${tip}</div>` : ''}`
        : `<div class="img-tip-cap">${tip}</div>`;

        document.body.appendChild(hoverTip);

        const move = (e) => {
        const pad = 12;
        hoverTip.style.left = (e.pageX + pad) + 'px';
        hoverTip.style.top  = (e.pageY + pad) + 'px';
        };
        target.addEventListener('mousemove', move, { passive: true });
        hoverTip._cleanup = () => target.removeEventListener('mousemove', move);
    };

    const killHover = () => {
        if (hoverTip) {
        hoverTip._cleanup?.();
        hoverTip.remove();
        hoverTip = null;
        }
    };

    // Attach to .var elements
    document.querySelectorAll('.var').forEach(el => {
        el.addEventListener('mouseenter', () => mkHover(el));
        el.addEventListener('mouseleave', killHover);
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const imgSrc = el.getAttribute('data-img');
            const caption = el.getAttribute('data-tip') || '';
            const title = el.textContent.trim();
            openModal(imgSrc, title, caption);
        });
    });

    // --- Modal logic ---
    const modal = document.getElementById('var-modal');
    const modalImg = document.getElementById('var-modal-img');
    const modalCap = document.getElementById('var-modal-cap');

    function openModal(src, title, caption) {
    // if image exists, show it; else hide image section
    if (src) {
      modalImg.style.display = '';
      modalImg.src = src;
    } else {
      modalImg.style.display = 'none';
      modalImg.removeAttribute('src');
    }

    // caption always shows (even without image)
    modalCap.textContent = caption || `(No definition available for "${title}")`;

    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('no-scroll');
    }

    function closeModal() {
        modal.setAttribute('aria-hidden', 'true');
        modalImg.removeAttribute('src');
        document.documentElement.classList.remove('no-scroll');
    }

    modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeModal();
        }
    });
})();
