document.addEventListener('DOMContentLoaded', () => {
    const massBadges = document.querySelectorAll('.mass-badge');

    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.02s ease';
    tooltip.style.zIndex = '9999';
    tooltip.style.background = 'rgba(27, 34, 28, 0.95)';
    tooltip.style.color = '#fdfcf8';
    tooltip.style.padding = '0.35rem 0.6rem';
    tooltip.style.borderRadius = '0.6rem';
    tooltip.style.fontSize = '0.72rem';
    tooltip.style.fontWeight = '600';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
    document.body.appendChild(tooltip);

    massBadges.forEach((badge) => {
        const mass = badge.dataset.mass ?? '';
        const uncertainty = badge.dataset.uncertainty ?? '';
        const unit = badge.dataset.unit ?? '';
        const particle = badge.dataset.particle ?? badge.textContent.trim();

        const details = `${particle}: ${mass}${uncertainty !== '' && uncertainty !== '0' ? ` ± ${uncertainty}` : ''}${unit ? ` ${unit}` : ''}`;

        const showTooltip = (event) => {
            tooltip.textContent = details;
            tooltip.style.opacity = '1';
            tooltip.style.left = `${event.clientX + 10}px`;
            tooltip.style.top = `${event.clientY + 10}px`;
        };

        const hideTooltip = () => {
            tooltip.style.opacity = '0';
        };

        badge.addEventListener('mouseenter', showTooltip);
        badge.addEventListener('mousemove', showTooltip);
        badge.addEventListener('mouseleave', hideTooltip);
    });
});
