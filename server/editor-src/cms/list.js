// The list column of a split view: search, filters, rows with the cover image, ↑/↓ to move, "/" to search.
import { h } from './dom';
import { thumbOf } from './store';

// config: { noun, newLabel, keyOf, thumbOf, initialOf (text when there is no image), titleOf, subtitleOf, badgesOf, textOf, filters: [{ id, label, options() → [{value,label}], test(item, value) }],
//           searchDoc(item) → { name, aliases, fields: [{ label, text, weight }] } (optional; else title, subtitle, text),
//           onSelect(key), onNew() }
// The search is the site's one search (src/utils/search.js): best matches first — the exact name, then names starting
// with it, then names containing it, then other fields —, matches marked, and a line saying where a hidden match is.
export function createList(config) {
    const state = { items: [], selected: null, query: '', filters: {} };
    const search = h('input.search', { type: 'search', placeholder: `Search ${config.noun}…  ( / )`, 'aria-label': `Search ${config.noun}` });
    const count = h('span.count');
    const filterBox = h('div.filters');
    const newBtn = config.onNew ? h('button.btn.primary.small', { type: 'button', title: config.newLabel, on: { click: () => config.onNew() } }, '＋ New') : null;
    const rows = h('div.rows', { role: 'listbox', tabindex: '0', 'aria-label': config.noun });
    const el = h('section.list', {}, h('div.list-head', {}, h('div.list-tools', {}, search, newBtn), filterBox, count), rows);

    const selects = (config.filters || []).map((f) => {
        const s = h('select', { 'aria-label': f.label, on: { change: () => { state.filters[f.id] = s.value; render(); } } });
        filterBox.append(s);
        return { f, s };
    });

    function fillFilters() {
        for (const { f, s } of selects) {
            const current = s.value;
            s.replaceChildren(h('option', { value: '' }, f.label), ...f.options().map((o) => h('option', { value: o.value }, o.label)));
            s.value = current;
        }
    }

    const docOf = (item) => config.searchDoc?.(item) || {
        name: config.titleOf(item),
        fields: [{ label: '', text: config.subtitleOf(item), weight: 2 }, { label: '', text: config.textOf(item), weight: 1 }],
    };
    const why = new Map(); // item → { label, text } of the last search

    function visible() {
        const filtered = state.items.filter((item) => selects.every(({ f }) => !state.filters[f.id] || f.test(item, state.filters[f.id])));
        why.clear();
        if (!state.query.trim()) return filtered;
        return window.AdenaiSearch.rank(filtered, state.query, docOf).map((r) => { if (r.why) why.set(r.item, r.why); return r.item; });
    }

    function render() {
        const list = visible();
        const S = window.AdenaiSearch;
        const q = state.query.trim();
        count.textContent = list.length === state.items.length ? `${list.length}` : `${list.length} / ${state.items.length}`;
        rows.replaceChildren(...list.map((item) => {
            const key = config.keyOf(item);
            const cover = config.thumbOf(item);
            const title = config.titleOf(item);
            return h('div.row', { role: 'option', dataset: { key }, 'aria-selected': String(key === state.selected), on: { click: () => config.onSelect(key) } },
                cover ? h('img.thumb', { src: thumbOf(cover), alt: '', loading: 'lazy' }) : h('span.thumb.empty', { text: config.initialOf ? config.initialOf(item) : (title || '?').slice(0, 1) }),
                h('span.row-text', {},
                    q ? h('span.row-title', { html: S.highlight(title, q) }) : h('span.row-title', { text: title }),
                    q ? h('span.row-sub', { html: S.highlight(config.subtitleOf(item), q) }) : h('span.row-sub', { text: config.subtitleOf(item) }),
                    q && why.get(item) && !S.matches(`${title} ${config.subtitleOf(item)}`, q)
                        ? h('span.row-why', { html: `${why.get(item).label ? `${S.highlight(why.get(item).label, '')}: ` : ''}${S.highlight(why.get(item).text, q)}` }) : null),
                h('span.row-badges', {}, config.badgesOf(item)));
        }));
        if (!list.length) rows.append(h('p.empty-note', { text: state.items.length ? 'Nothing matches.' : `No ${config.noun} yet.` }));
    }

    function scrollToSelected() {
        rows.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }

    search.addEventListener('input', () => { state.query = search.value; render(); });
    rows.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const keys = visible().map(config.keyOf);
        const i = keys.indexOf(state.selected);
        const next = keys[Math.max(0, Math.min(keys.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next !== undefined && next !== state.selected) config.onSelect(next);
    });

    return {
        el,
        focusSearch() { search.focus(); search.select(); },
        update(items, selected) {
            state.items = items;
            state.selected = selected;
            fillFilters();
            render();
            scrollToSelected();
        },
        select(selected) {
            state.selected = selected;
            rows.querySelectorAll('.row').forEach((r) => r.setAttribute('aria-selected', String(r.dataset.key === selected)));
            scrollToSelected();
        },
        setNewVisible(on) { if (newBtn) newBtn.hidden = !on; },
    };
}
