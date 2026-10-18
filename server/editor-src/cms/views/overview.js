// Overview: the campaign in numbers, and exports — the public data (locations, characters, glossary, media library,
// settings) as one JSON file, and everything private (the minutes with their history and drafts, deleted sessions,
// the players' proposals) as another, for the DM's own copy. The nightly encrypted server backup runs regardless.
import { h, toast } from '../dom';
import { store, canEdit, labelOf } from '../store';
import { api } from '../api';

const download = (name, data) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
const today = () => new Date().toISOString().slice(0, 10);
const RAW = 'https://github.com/piosteiner/Adenai-Map/blob/main/public/data/';

export function overviewView() {
    const el = h('div.overview');

    const stat = (n, label, href) => h(href ? 'a.stat' : 'div.stat', href ? { href } : {}, h('span.stat-n', { text: String(n) }), h('span.stat-l', { text: label }));
    const countBy = (list, key) => Object.entries(list.reduce((m, x) => { const v = key(x) || '—'; m[v] = (m[v] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

    async function open() {
        const L = store.locations;
        const C = store.characters;
        const visited = L.filter((f) => f.properties?.visited).length;
        const regions = new Set(L.map((f) => f.properties?.region).filter(Boolean)).size;
        const alive = C.filter((c) => c.status === 'alive').length;
        let minutes = null;
        if (canEdit()) { try { minutes = (await api('/api/protocols')).sessions || []; } catch { /* not available */ } }
        const published = minutes?.filter((s) => s.published !== false) || [];
        const drafts = minutes?.filter((s) => s.draft || s.published === false).length || 0;

        el.replaceChildren(
            h('section.overview-block', {}, h('h2', { text: 'The campaign' }),
                h('div.stats', {},
                    stat(L.length, 'locations', '#/locations'), stat(visited, 'visited'), stat(regions, 'regions'),
                    stat(C.length, 'characters', '#/characters'), stat(alive, 'alive'),
                    stat(store.terms.length, 'glossary terms', '#/glossary'),
                    stat(Object.keys(store.media || {}).length, 'images', '#/media'),
                    minutes ? stat(published.length, 'sessions', '#/protocols') : null,
                    minutes && drafts ? stat(drafts, 'with unsaved drafts', '#/protocols') : null,
                    store.pending?.length ? stat(store.pending.length, 'proposals to confirm', '#/proposals') : null)),
            h('section.overview-block', {}, h('h2', { text: 'Characters by relationship' }),
                h('p.side-row', {}, countBy(C, (c) => c.relationship).map(([k, n]) => h('span.chip', { text: `${labelOf('characterRelationships', k)} ${n}` })))),
            h('section.overview-block', {}, h('h2', { text: 'Locations by region' }),
                h('p.side-row', {}, countBy(L, (f) => f.properties?.region).map(([k, n]) => h('span.chip', { text: `${labelOf('locationRegions', k)} ${n}` })))),
            h('section.overview-block', {}, h('h2', { text: 'Export' }),
                h('p.muted', { text: 'The server also makes an encrypted backup every night. These downloads are for your own copy.' }),
                h('div.pair', {},
                    h('button.btn', { type: 'button', on: { click: () => { download(`adenai-data-${today()}.json`, { exportedAt: new Date().toISOString(), locations: { type: 'FeatureCollection', features: store.locations }, characters: { characters: store.characters }, glossary: { terms: store.terms }, media: { images: store.media }, config: store.config }); toast('Public data downloaded'); } } }, '⬇ Public data (JSON)'),
                    canEdit() ? h('a.btn', { href: '/api/protocols/export', download: '' }, '⬇ Minutes & private data (JSON)') : null),
                h('p.muted', {}, 'The files on GitHub: ',
                    ['places.geojson', 'characters.json', 'glossary.json', 'media-library.json'].map((f, i) => [i ? ' · ' : '', h('a', { href: RAW + f, target: '_blank', rel: 'noopener' }, f)]))));
    }

    return { el, open, focusSearch: () => {}, isDirty: () => false, save: () => {}, async reloadAll() {} };
}
