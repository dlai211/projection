(function () {
  // Use body-level tooltips instead of CSS pseudo-elements
  document.body.classList.add('use-body-tooltips');

  // Create the floating tooltip element once
  const tip = document.createElement('div');
  tip.id = 'dp-tooltip';
  tip.setAttribute('data-hidden', 'true');
  document.body.appendChild(tip);

  let currentEl = null;

  function positionTip(el) {
    if (!el) return;
    const text = el.getAttribute('data-tip');
    if (!text) return;

    tip.textContent = text;
    tip.removeAttribute('data-hidden');

    const r = el.getBoundingClientRect();
    const pad = 8;

    // Default place: below-left of the element
    let x = Math.max(8, r.left);
    let y = r.bottom + pad;

    // Constrain within viewport horizontally
    const maxX = window.innerWidth - tip.offsetWidth - 8;
    x = Math.min(x, maxX);

    // If bottom overflows, flip above the element
    const maxY = window.innerHeight - tip.offsetHeight - 8;
    if (y > maxY) y = Math.max(8, r.top - tip.offsetHeight - pad);

    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  function hideTip() {
    tip.setAttribute('data-hidden', 'true');
  }

  // Show on hover
  document.addEventListener('mouseenter', (e) => {
    const el = e.target.closest('.var[data-tip]');
    if (!el) return;
    currentEl = el;
    positionTip(currentEl);
  }, true);

  // Hide when leaving the .var element
  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.var[data-tip]')) {
      currentEl = null;
      hideTip();
    }
  }, true);

  // Reposition on scroll/resize so it stays anchored to the trigger
  window.addEventListener('scroll', () => { if (currentEl) positionTip(currentEl); }, true);
  window.addEventListener('resize', () => { if (currentEl) positionTip(currentEl); });
})();





(function () {
  const btnMt100 = document.getElementById('btn-mt100');
  const btnMt80  = document.getElementById('btn-mt80');
  const secMt100 = document.getElementById('cut-table-mt100');
  const secMt80  = document.getElementById('cut-table-mt80');

  function setActive(target) {
    // sections
    secMt100.classList.toggle('active', target === 'mt100');
    secMt80.classList.toggle('active',  target === 'mt80');

    // buttons
    btnMt100.classList.toggle('active', target === 'mt100');
    btnMt80.classList.toggle('active',  target === 'mt80');

    // update hash (so refresh/deep-linking works)
    if (location.hash !== '#' + target) {
      history.replaceState(null, '', '#' + target);
    }
  }

  // button clicks
  btnMt100.addEventListener('click', (e) => { e.preventDefault(); setActive('mt100'); });
  btnMt80.addEventListener('click',  (e) => { e.preventDefault(); setActive('mt80'); });

  // on load: honor URL hash
  const hash = (location.hash || '#mt100').replace('#', '');
  setActive(hash === 'mt80' ? 'mt80' : 'mt100');

  // also react to hash changes (e.g., back/forward)
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '#mt100').replace('#','');
    setActive(h === 'mt80' ? 'mt80' : 'mt100');
  });
})();
