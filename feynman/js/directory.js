document.addEventListener('DOMContentLoaded', () => {
    const massBadges = document.querySelectorAll('.mass-badge');

    massBadges.forEach((badge) => {
        const mass = badge.dataset.mass ?? '';
        const uncertainty = badge.dataset.uncertainty ?? '';
        const unit = badge.dataset.unit ?? '';
        const particle = badge.dataset.particle ?? badge.textContent.trim();

        const tooltip = `${particle}: ${mass}${uncertainty !== '' && uncertainty !== '0' ? ` ± ${uncertainty}` : ''}${unit ? ` ${unit}` : ''}`;

        badge.setAttribute('title', tooltip);
        badge.addEventListener('mouseenter', () => {
            badge.setAttribute('title', tooltip);
        });
    });
});
