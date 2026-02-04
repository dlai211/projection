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
