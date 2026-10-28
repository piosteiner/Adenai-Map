// Quality: what looks wrong or unfinished — links to nothing, missing images, the same name twice, in-game dates that
// contradict each other, entries without description or picture (the checks: ../quality-checks.js). Computed here from
// the data the CMS has, with the minutes from the server. An issue that is intended can be marked "OK" with a reason;
// it then waits under "Marked OK" (server: routes/quality.js) and comes back if it is unmarked.
import { h, toast } from '../dom';
import { store, canEdit } from '../store';
import { api } from '../api';
import { checkAll, KINDS } from '../quality-checks';

const LEVELS = [
    ['error', 'Errors', 'Certainly wrong.'],
    ['warning', 'Warnings', 'Probably wrong — worth a look.'],
    ['hint', 'Unfinished', 'Parts still missing.'],
];
const ICON = { character: '👤', location: '📍', term: '📖', session: '📜' };
const SHOWN = 12; // per kind, before "show all"
const enc = encodeURIComponent;
const hrefOf = (e) => ({ character: `#/characters/${enc(e.id)}`, location: `#/locations/${enc(e.name)}`, term: `#/glossary/${enc(e.id)}`, session: `#/protocols/${enc(e.id)}` })[e.kind];

export function qualityView() {
    const el = h('div.overview.quality');
    let issues = [];
    let ok = {};
    const expanded = new Set(); // kinds shown in full

    async function open() {
        el.replaceChildren(h('p.muted', { text: 'Checking…' }));
        const [sessions, marks] = await Promise.all([
            canEdit() ? api('/api/protocols').then((r) => r.sessions || []).catch(() => []) : [],
            canEdit() ? api('/api/quality/ok').then((r) => r.ok || {}).catch(() => ({})) : {},
        ]);
        ok = marks;
        issues = checkAll({ characters: store.characters, locations: store.locations, terms: store.terms, media: store.media, sessions, proposals: store.pending || [] });
        render();
    }

    async function mark(issue) {
        const reason = window.prompt(`Mark as OK: ${issue.entry.name} — ${issue.text}\n\nWhy is it fine? (shown under "Marked OK")`, '');
        if (reason === null) return;
        try {
            ok = (await api('/api/quality/ok', { method: 'POST', body: { key: issue.key, reason } })).ok;
            render();
        } catch (err) { toast(err.message, 'warn'); }
    }
    async function unmark(key) {
        try {
            ok = (await api(`/api/quality/ok?key=${enc(key)}`, { method: 'DELETE' })).ok;
            render();
        } catch (err) { toast(err.message, 'warn'); }
    }

    const row = (i) => h('li.quality-row', {},
        h('a.chip', { href: hrefOf(i.entry) }, `${ICON[i.entry.kind] || ''} ${i.entry.name}`),
        h('span.quality-text', { text: i.text }),
        canEdit() ? h('button.btn.small.quality-ok', { type: 'button', title: 'It is intended: hide it', on: { click: () => mark(i) } }, 'OK…') : null);

    function render() {
        const open_ = issues.filter((i) => !ok[i.key]);
        const marked = issues.filter((i) => ok[i.key]);
        const count = (level) => open_.filter((i) => i.level === level).length;
        el.replaceChildren(...[
            h('section.overview-block', {}, h('h2', { text: 'Quality' }),
                h('div.stats', {}, LEVELS.map(([level, label]) => h('a.stat', { href: `#/quality`, on: { click: (e) => { e.preventDefault(); el.querySelector(`#quality-${level}`)?.scrollIntoView({ behavior: 'smooth' }); } } },
                    h('span.stat-n', { text: String(count(level)) }), h('span.stat-l', { text: label.toLowerCase() })))),
                !open_.length ? h('p.muted', { text: 'Nothing to report.' }) : null),
            LEVELS.map(([level, label, about]) => {
                const mine = open_.filter((i) => i.level === level);
                if (!mine.length) return null;
                const kinds = [...new Set(mine.map((i) => i.kind))];
                return h(`section.overview-block.quality-${level}`, { id: `quality-${level}` },
                    h('h2', {}, `${label} `, h('span.muted', { text: `${mine.length} · ${about}` })),
                    kinds.map((kind) => {
                        const list = mine.filter((i) => i.kind === kind);
                        const all = expanded.has(kind);
                        return h('div.quality-kind', {},
                            h('h3', {}, KINDS[kind] || kind, h('span.muted', { text: ` ${list.length}` })),
                            h('ul.quality-list', {}, (all ? list : list.slice(0, SHOWN)).map(row)),
                            list.length > SHOWN && !all ? h('button.btn.small', { type: 'button', on: { click: () => { expanded.add(kind); render(); } } }, `Show all ${list.length}`) : null);
                    }));
            }),
            marked.length ? h('section.overview-block', {},
                h('details', {}, h('summary', {}, `Marked OK `, h('span.muted', { text: String(marked.length) })),
                    h('ul.quality-list', {}, marked.map((i) => h('li.quality-row', {},
                        h('a.chip', { href: hrefOf(i.entry) }, `${ICON[i.entry.kind] || ''} ${i.entry.name}`),
                        h('span.quality-text', {}, i.text, h('span.muted', { text: ` — ${ok[i.key].reason || 'no reason given'} (${ok[i.key].by})` })),
                        canEdit() ? h('button.btn.small', { type: 'button', on: { click: () => unmark(i.key) } }, 'Undo') : null))))) : null,
        ].flat().filter(Boolean)); // replaceChildren takes nodes, not lists
    }

    return { el, open, focusSearch: () => {}, isDirty: () => false, save: () => {}, async reloadAll() { await open(); } };
}
