// js/ui.js
// DOM construction: the left-hand particle panel with its Elementary/Hadrons tabs,
// and the results area with collapsible groups, filter chips and lazy canvases.

import { PARTICLES, ELEMENTARY_PANEL, SELF_CONJUGATE } from './particles.js';
import { HADRONS, HADRON_PANEL } from './hadrons.js';
import { setupCanvas, drawDiagram, channelTitle } from './draw.js';

const MINUS = '−';   // true minus sign, matches the existing typography
const THIRD = '⅓';   // ⅓
const TWO_THIRDS = '⅔'; // ⅔

/** '+⅔', '−⅓', ... matching the original panel's notation. */
export function formatCharge(q) {
    if (q === 0) return '0';
    const sign = q < 0 ? MINUS : '+';
    const mag = Math.abs(q);
    let body;
    if (Math.abs(mag - 1) < 1e-9) body = '1';
    else if (Math.abs(mag - 2 / 3) < 1e-9) body = TWO_THIRDS;
    else if (Math.abs(mag - 1 / 3) < 1e-9) body = THIRD;
    else body = String(mag);
    return sign + body;
}

/** Splits '2.16 MeV' into { value: '2.16', unit: 'MeV' }; tolerant of '<27 eV' and '--'. */
function splitMass(label) {
    const match = /^(.*?)\s*([A-Za-z]+)$/.exec(label || '');
    if (match) return { value: match[1], unit: match[2] };
    return { value: label || '--', unit: '' };
}

// ------------------------------------------------------- particle panel

function entryElement(symbol, category, isAnti) {
    const info = PARTICLES[symbol] || HADRONS[symbol];
    if (!info) return null;

    const entry = document.createElement('div');
    entry.className = 'entry' + (isAnti ? ` anti ${category}` : '');

    const icon = document.createElement('span');
    icon.className = 'particle-icon';
    icon.draggable = true;
    icon.dataset.symbol = symbol;
    icon.innerHTML = info.label || symbol;

    const infoBox = document.createElement('div');
    infoBox.className = 'particle-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'particle-name-row';

    const name = document.createElement('span');
    name.className = 'particle-name';
    name.textContent = info.name;
    nameRow.appendChild(name);

    const metaTop = document.createElement('div');
    metaTop.className = 'particle-meta';
    const charge = document.createElement('span');
    charge.className = 'charge-badge';
    charge.textContent = formatCharge(info.Q);
    metaTop.appendChild(charge);
    nameRow.appendChild(metaTop);
    infoBox.appendChild(nameRow);

    const meta = document.createElement('div');
    meta.className = 'particle-meta';
    if (info.massLabel) {
        const { value, unit } = splitMass(info.massLabel);
        const badge = document.createElement('span');
        badge.className = 'mass-badge';
        badge.dataset.particle = symbol;
        badge.dataset.mass = value;
        badge.dataset.uncertainty = info.unc || '0';
        badge.dataset.unit = unit;
        badge.textContent = info.massLabel;
        meta.appendChild(badge);
    }
    if (info.quarks) {
        const q = document.createElement('span');
        q.className = 'quark-badge';
        q.textContent = info.quarks.join(' ');
        meta.appendChild(q);
    } else if (info.note) {
        const n = document.createElement('span');
        n.className = 'quark-badge';
        n.textContent = 'flavour mixture';
        meta.appendChild(n);
    }
    if (meta.childNodes.length) infoBox.appendChild(meta);

    entry.append(icon, infoBox);
    return entry;
}

function categoryElement({ category, title, badge, color, groups }) {
    const box = document.createElement('div');
    box.className = `category ${category}`;

    const heading = document.createElement('h2');
    heading.innerHTML = `<i class="fas fa-circle" style="color: ${color};"></i> ${title}`;
    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = badge;
    heading.appendChild(count);
    box.appendChild(heading);

    for (const group of groups) {
        const wrap = document.createElement('div');
        wrap.className = 'particle-group';
        if (group.label) {
            const label = document.createElement('div');
            label.className = 'group-label';
            label.textContent = group.label;
            wrap.appendChild(label);
        }
        for (const row of group.rows) {
            const card = document.createElement('div');
            card.className = 'particle';
            row.forEach((symbol, i) => {
                const el = entryElement(symbol, category[0].toUpperCase() + category.slice(1), i > 0);
                if (el) card.appendChild(el);
            });
            wrap.appendChild(card);
        }
        box.appendChild(wrap);
    }
    return box;
}

function hadronCategory() {
    const box = document.createElement('div');
    box.className = 'category hadron';

    const heading = document.createElement('h2');
    heading.innerHTML = `<i class="fas fa-circle" style="color: #1f5e8e;"></i> Hadrons`;
    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = 'Bound states';
    heading.appendChild(count);
    box.appendChild(heading);

    for (const group of HADRON_PANEL) {
        const symbols = Object.values(HADRONS).filter(h => h.group === group.group);
        if (!symbols.length) continue;

        const wrap = document.createElement('div');
        wrap.className = 'particle-group';
        const label = document.createElement('div');
        label.className = 'group-label';
        label.textContent = `${group.title} · ${group.badge}`;
        wrap.appendChild(label);

        for (const info of symbols) {
            const card = document.createElement('div');
            card.className = 'particle';
            const el = entryElement(info.symbol, 'Quark', info.group === 'antibaryon');
            if (el) card.appendChild(el);
            wrap.appendChild(card);
        }
        box.appendChild(wrap);
    }

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.innerHTML = '<i class="fas fa-info-circle"></i> Drawn as a blob with their valence quarks and a brace. '
        + 'Masses are the measured hadron masses, not the sum of the constituent quarks.';
    box.appendChild(note);
    return box;
}

/** Builds both tabs and wires the tab strip. */
export function renderParticlePanel(panelEl) {
    const strip = document.createElement('div');
    strip.className = 'tab-strip';
    strip.innerHTML = `
        <button class="tab-btn active" data-tab="elementary">Elementary</button>
        <button class="tab-btn" data-tab="hadrons">Hadrons</button>`;

    const elementaryView = document.createElement('div');
    elementaryView.className = 'tab-view';
    elementaryView.dataset.tab = 'elementary';
    for (const cat of ELEMENTARY_PANEL) elementaryView.appendChild(categoryElement(cat));

    const footnote = document.createElement('div');
    footnote.className = 'panel-note';
    footnote.innerHTML = `<span><i class="fas fa-table"></i> charge · mass</span><br>`
        + `<i class="fas fa-sync-alt"></i> ${SELF_CONJUGATE.join(', ')} are their own antiparticles<br>`
        + `Mass taken from F. Takahashi et al. (Particle Data Group), to be published in Int. J. Mod. Phys. A41, 2630011 (2026)`;
    elementaryView.appendChild(footnote);

    const hadronView = document.createElement('div');
    hadronView.className = 'tab-view';
    hadronView.dataset.tab = 'hadrons';
    hadronView.hidden = true;
    hadronView.appendChild(hadronCategory());

    panelEl.append(strip, elementaryView, hadronView);

    strip.addEventListener('click', (event) => {
        const btn = event.target.closest('.tab-btn');
        if (!btn) return;
        strip.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        panelEl.querySelectorAll('.tab-view').forEach(view => {
            view.hidden = view.dataset.tab !== btn.dataset.tab;
        });
    });
}

// ----------------------------------------------------------- fullscreen

function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'diagram-overlay';
    overlay.innerHTML = `
        <div class="diagram-overlay-panel">
            <button class="diagram-overlay-close" aria-label="Close">×</button>
            <div class="diagram-overlay-title"></div>
            <img class="diagram-overlay-image" alt="Feynman diagram">
        </div>`;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.classList.remove('visible');
        overlay.querySelector('.diagram-overlay-image').removeAttribute('src');
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.diagram-overlay-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return overlay;
}

let overlayEl = null;
export function openFullscreenPlot(canvas, titleText) {
    if (!overlayEl) overlayEl = buildOverlay();
    overlayEl.querySelector('.diagram-overlay-image').src = canvas.toDataURL('image/png');
    overlayEl.querySelector('.diagram-overlay-title').textContent = titleText;
    overlayEl.classList.add('visible');
}

// ------------------------------------------------------------- results

const state = {
    channels: [],
    initial: [],
    final: [],
    groupBy: 'mediator',
    hiddenKeys: new Set(),
    expanded: new Set(),
    pages: new Map(),
    observer: null,
    pageSize: 12
};

const MEDIATOR_LABEL = {
    'γ': 'γ  Photon', 'Z⁰': 'Z⁰  Neutral current', 'W⁺': 'W⁺  Charged current',
    'W⁻': 'W⁻  Charged current', 'g': 'g  Gluon', 'h': 'h  Higgs', 'none': 'No mediator'
};

const TYPE_LABEL = {
    's-channel': 's-channel', 't-channel': 't-channel', 'u-channel': 'u-channel',
    't/u-channel': 't / u-channel', 'contact': 'Contact interaction', 'decay': 'Decay'
};

function groupKeyOf(channel) {
    if (state.groupBy === 'type') {
        if (channel.type === 'decay') return `decay-${channel.multiplicity}`;
        return channel.type;
    }
    if (state.groupBy === 'final') return [...(channel.external || [])].sort().join(' ');
    return channel.mediator || 'none';
}

function groupLabelOf(key) {
    if (state.groupBy === 'type') {
        const m = /^decay-(\d)$/.exec(key);
        if (m) return `${m[1]}-body decay`;
        return TYPE_LABEL[key] || key;
    }
    if (state.groupBy === 'final') return key;
    return MEDIATOR_LABEL[key] || key;
}

function filterKeyOf(channel) {
    return state.groupBy === 'final' ? null : groupKeyOf(channel);
}

/** Draws the canvas the first time its card scrolls into view. */
function observerFor() {
    if (state.observer) return state.observer;
    state.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const canvas = entry.target;
            state.observer.unobserve(canvas);
            if (canvas.dataset.rendered) continue;
            const channel = state.channels[Number(canvas.dataset.index)];
            if (!channel) continue;
            const ctx = setupCanvas(canvas);
            drawDiagram(ctx, canvas._engine, channel, state.initial, state.final);
            canvas.dataset.rendered = '1';
        }
    }, { rootMargin: '200px' });
    return state.observer;
}

function cardFor(channel, index, engine) {
    const card = document.createElement('div');
    card.className = 'channel-card';

    const title = document.createElement('div');
    title.className = 'channel-title';
    title.textContent = channelTitle(channel, state.initial, channel.external || state.final);
    if (channel.effective) {
        const tag = document.createElement('span');
        tag.className = 'effective-tag';
        tag.textContent = 'effective';
        tag.title = 'Built from a phenomenological hadron-level vertex, not a fundamental one';
        title.appendChild(tag);
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'channel-canvas';
    canvas.dataset.index = String(index);
    canvas._engine = engine;

    card.append(title, canvas);
    card.addEventListener('click', () => openFullscreenPlot(canvas, title.textContent));

    // Render immediately if it is already on screen, otherwise defer.
    if (card.getBoundingClientRect) observerFor().observe(canvas);
    return card;
}

function makeChip(label, key, active, onToggle) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip' + (active ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => onToggle(key));
    return chip;
}

/**
 * Renders the result list. `engine` is passed through to the canvas renderer, which
 * needs it for particle lookups and arrow directions.
 */
export function renderResults(container, { channels, initial, final, engine, truncated, note }) {
    // A new array means a new search: reset the per-group pagination.
    if (channels !== state.channels) state.pages = new Map();

    state.channels = channels;
    state.initial = initial;
    state.final = final;
    state.engine = engine;
    state.expanded = new Set();

    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    container.innerHTML = '';

    if (!channels.length) {
        const empty = document.createElement('div');
        empty.className = 'results-empty';
        empty.textContent = note || 'No diagrams to show.';
        container.appendChild(empty);
        return;
    }

    // Bucket first: the toolbar's Expand-all needs to know the group keys.
    const buckets = new Map();
    channels.forEach((channel, index) => {
        const key = groupKeyOf(channel);
        if (state.hiddenKeys.has(key)) return;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ channel, index });
    });
    const visibleGroups = [...buckets.entries()]
        .map(([key, items]) => ({ key, items }))
        .sort((a, b) => b.items.length - a.items.length);

    // ---- summary
    const finals = new Set(channels.map(c => [...(c.external || [])].sort().join(' ')));
    const mediators = new Set(channels.map(c => c.mediator || 'none'));
    const summary = document.createElement('div');
    summary.className = 'results-summary';
    summary.innerHTML = `<strong>${channels.length}</strong> diagram${channels.length === 1 ? '' : 's'}`
        + ` · <strong>${finals.size}</strong> final state${finals.size === 1 ? '' : 's'}`
        + ` · <strong>${mediators.size}</strong> mediator${mediators.size === 1 ? '' : 's'}`
        + (truncated ? ' · <span class="truncated-note">list truncated</span>' : '');
    container.appendChild(summary);

    // ---- toolbar: grouping + filter chips
    const toolbar = document.createElement('div');
    toolbar.className = 'results-toolbar';

    const groupWrap = document.createElement('label');
    groupWrap.className = 'group-by';
    groupWrap.innerHTML = '<span>Group by</span>';
    const select = document.createElement('select');
    [['mediator', 'Mediator'], ['type', 'Channel type'], ['final', 'Final state']]
        .forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            opt.selected = state.groupBy === value;
            select.appendChild(opt);
        });
    select.addEventListener('change', () => {
        state.groupBy = select.value;
        state.hiddenKeys.clear();
        renderResults(container, { channels, initial, final, engine, truncated });
    });
    groupWrap.appendChild(select);
    toolbar.appendChild(groupWrap);

    const chips = document.createElement('div');
    chips.className = 'filter-chips';
    const keys = [...new Set(channels.map(filterKeyOf).filter(Boolean))];
    if (keys.length > 1) {
        const allActive = state.hiddenKeys.size === 0;
        chips.appendChild(makeChip('All', '__all', allActive, () => {
            state.hiddenKeys.clear();
            renderResults(container, { channels, initial, final, engine, truncated });
        }));
        for (const key of keys) {
            chips.appendChild(makeChip(groupLabelOf(key), key, !state.hiddenKeys.has(key), (k) => {
                if (state.hiddenKeys.has(k)) state.hiddenKeys.delete(k);
                else state.hiddenKeys.add(k);
                renderResults(container, { channels, initial, final, engine, truncated });
            }));
        }
    }
    toolbar.appendChild(chips);

    const toggles = document.createElement('div');
    toggles.className = 'group-toggles';
    const expandBtn = document.createElement('button');
    expandBtn.textContent = 'Expand all';
    expandBtn.addEventListener('click', () => {
        for (const key of visibleGroups.map(g => g.key)) state.expanded.add(key);
        renderResults(container, { channels, initial, final, engine, truncated });
    });
    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = 'Collapse all';
    collapseBtn.addEventListener('click', () => {
        state.expanded.clear();
        renderResults(container, { channels, initial, final, engine, truncated });
    });
    toggles.append(expandBtn, collapseBtn);
    toolbar.appendChild(toggles);
    container.appendChild(toolbar);

    // ---- groups
    if (!visibleGroups.length) {
        const empty = document.createElement('div');
        empty.className = 'results-empty';
        empty.textContent = 'Every group is filtered out. Select “All” to bring them back.';
        container.appendChild(empty);
        return;
    }

    const LIMIT = state.pageSize;
    visibleGroups.forEach((group, groupIndex) => {
        const shownCount = state.pages.get(group.key) || LIMIT;
        const section = document.createElement('section');
        section.className = 'result-group';

        // The largest group starts open so the first screen shows real diagrams
        // rather than a wall of collapsed headers.
        const open = state.expanded.has(group.key) || groupIndex === 0;
        const header = document.createElement('button');
        header.className = 'group-header' + (open ? ' open' : '');
        header.innerHTML = `<span class="chevron">${open ? '▾' : '▸'}</span>`
            + `<span class="group-name">${groupLabelOf(group.key)}</span>`
            + `<span class="group-count">${group.items.length}</span>`;
        header.addEventListener('click', () => {
            if (state.expanded.has(group.key)) state.expanded.delete(group.key);
            else state.expanded.add(group.key);
            renderResults(container, { channels, initial, final, engine, truncated });
        });
        section.appendChild(header);

        if (!open) {
            container.appendChild(section);
            return;
        }

        const body = document.createElement('div');
        body.className = 'group-body';
        const grid = document.createElement('div');
        grid.className = 'channel-grid';

        const shown = group.items.slice(0, shownCount);
        for (const { channel, index } of shown) grid.appendChild(cardFor(channel, index, engine));
        body.appendChild(grid);

        if (group.items.length > shown.length) {
            const remaining = group.items.length - shown.length;
            const more = document.createElement('button');
            more.className = 'show-more';
            more.textContent = `Show ${Math.min(LIMIT, remaining)} more (${remaining} hidden)`;
            more.addEventListener('click', () => {
                state.pages.set(group.key, shownCount + LIMIT);
                renderResults(container, { channels, initial, final, engine, truncated });
            });
            body.appendChild(more);
        }

        section.appendChild(body);
        container.appendChild(section);
    });
}
