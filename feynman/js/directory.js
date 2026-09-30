// js/directory.js
// Mass tooltips. Uses event delegation on the document so it also covers the
// particle cards, which are built at runtime rather than present in index.html.

let tooltip = null;

function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    Object.assign(tooltip.style, {
        position: 'fixed',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.02s ease',
        zIndex: '9999',
        background: 'rgba(27, 34, 28, 0.95)',
        color: '#fdfcf8',
        padding: '0.35rem 0.6rem',
        borderRadius: '0.6rem',
        fontSize: '0.72rem',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)'
    });
    document.body.appendChild(tooltip);
    return tooltip;
}

function describe(badge) {
    const mass = badge.dataset.mass ?? '';
    const unc = badge.dataset.uncertainty ?? '';
    const unit = badge.dataset.unit ?? '';
    const particle = badge.dataset.particle ?? badge.textContent.trim();

    if (mass === '--' || mass === '') return `${particle}: not measured`;
    const uncertainty = unc && unc !== '0' ? ` ± ${unc}` : '';
    return `${particle}: ${mass}${uncertainty}${unit ? ` ${unit}` : ''}`;
}

/** Safe to call repeatedly; delegates, so dynamically added badges are covered. */
export function initMassTooltips() {
    const tip = ensureTooltip();

    document.addEventListener('mouseover', (event) => {
        const badge = event.target.closest?.('.mass-badge');
        if (!badge) return;
        tip.textContent = describe(badge);
        tip.style.opacity = '1';
    });

    document.addEventListener('mousemove', (event) => {
        if (tip.style.opacity !== '1') return;
        tip.style.left = `${event.clientX + 12}px`;
        tip.style.top = `${event.clientY + 12}px`;
    });

    document.addEventListener('mouseout', (event) => {
        if (event.target.closest?.('.mass-badge')) tip.style.opacity = '0';
    });
}
