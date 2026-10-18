// History: every change to the data (the GitHub commits under public/data — what the CMS and the map's editors wrote),
// newest first, with who changed what; a change links to its entry and to the exact diff on GitHub. Changes by other
// accounts than the GM's are reviewed here (approve / reject — the review log in public/data/reviews.json).
import { h, toast, formatDate } from '../dom';
import { store, characterByName, locationByName, termByName } from '../store';
import { api } from '../api';
import { createList } from '../list';

const KIND = { character: '👤 Character', location: '📍 Location', term: '📖 Glossary', media: '🖼 Media', links: '🔗 Links', other: '• Other' };
const ACTION = { create: 'Created', update: 'Changed', delete: 'Deleted', rename: 'Renamed', change: 'Changed' };
const when = (iso) => { const d = new Date(iso); return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function historyView(app) {
    let entries = [];
    let page = 0;
    let more = true;
    let canReview = false;
    let loading = null;
    const detail = h('section.detail');
    const reviewBadge = (e) => (e.review && !e.review.auto && e.review.status !== 'untracked'
        ? h(`span.pill${e.review.status === 'pending' ? '.warn' : e.review.status === 'approved' ? '.ok' : ''}`, { text: e.review.status }) : null);
    const list = createList({
        noun: 'changes',
        keyOf: (e) => e.sha,
        thumbOf: () => null,
        initialOf: (e) => ({ character: '👤', location: '📍', term: '📖', media: '🖼', links: '🔗' }[e.kind] || '•'),
        titleOf: (e) => (e.item ? `${ACTION[e.action] || 'Changed'} ${e.item}` : e.detail),
        subtitleOf: (e) => `${e.user} · ${when(e.date)}${e.item && e.detail ? ` · ${e.detail}` : ''}`,
        badgesOf: (e) => [reviewBadge(e)],
        textOf: (e) => [e.item, e.detail, e.user, e.kind, e.action].join(' '),
        filters: [
            { id: 'kind', label: 'All kinds', options: () => Object.entries(KIND).map(([value, label]) => ({ value, label })), test: (e, v) => e.kind === v },
            { id: 'user', label: 'Everyone', options: () => [...new Set(entries.map((e) => e.user))].sort().map((u) => ({ value: u, label: u })), test: (e, v) => e.user === v },
            { id: 'review', label: 'Any review', options: () => [{ value: 'pending', label: 'Needs review' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }], test: (e, v) => e.review?.status === v },
        ],
        onSelect: (key) => app.go(`history/${encodeURIComponent(key)}`),
    });
    const moreBtn = h('button.btn.small.history-more', { type: 'button', on: { click: () => loadMore().then(() => list.update(entries, current)) } }, 'Load older changes');
    list.el.append(moreBtn);
    const el = h('div.split', {}, list.el, detail);
    let current = null;

    function loadMore() {
        if (!more) return Promise.resolve();
        loading ||= api(`/api/changelog/history?page=${page + 1}`).then((r) => {
            page = r.page;
            more = r.more;
            canReview = r.canReview;
            entries.push(...r.entries);
            moreBtn.hidden = !more;
        }).finally(() => { loading = null; });
        return loading;
    }

    // the entry a change is about, if it still exists
    function entryLink(e) {
        if (!e.item) return null;
        const name = e.item.split(' → ').pop().replace(/ \(.*$/, '').trim();
        const c = e.kind === 'character' && characterByName(name);
        const l = e.kind === 'location' && locationByName(name);
        const t = e.kind === 'term' && termByName(name);
        const m = e.kind === 'media' && store.media?.[name];
        if (c) return h('a.chip', { href: `#/characters/${encodeURIComponent(c.id)}` }, `👤 ${c.name}`);
        if (l) return h('a.chip', { href: `#/locations/${encodeURIComponent(l.properties.name)}` }, `📍 ${l.properties.name}`);
        if (t) return h('a.chip', { href: `#/glossary/${encodeURIComponent(t.id)}` }, `📖 ${t.name}`);
        if (m) return h('a.chip', { href: `#/media/${encodeURIComponent(m.id)}` }, `🖼 ${m.title || m.id}`);
        return h('span.muted', { text: e.action === 'delete' ? 'deleted' : 'not found any more (renamed or deleted)' });
    }

    function render(e) {
        const review = async (status) => {
            try {
                await api(`/api/changelog/review/${e.sha}`, { method: 'PUT', body: { status } });
                e.review = { ...(e.review || {}), status, by: store.auth.username, at: new Date().toISOString() };
                toast(`Change ${status}`);
                list.update(entries, e.sha);
                render(e);
            } catch (err) { toast(`Not saved: ${err.message}`, 'bad', 7000); }
        };
        const r = e.review;
        detail.replaceChildren(
            h('header.detail-head', {},
                h('div.detail-cover.empty', { text: ({ character: '👤', location: '📍', term: '📖', media: '🖼', links: '🔗' }[e.kind] || '•') }),
                h('div.detail-title', {}, h('h2', { text: e.item ? `${ACTION[e.action] || 'Changed'} ${e.item}` : e.detail }), h('span.muted', { text: `${KIND[e.kind] || ''} · by ${e.user} · ${when(e.date)}` })),
                h('span.spacer'),
                h('a.btn.ghost', { href: e.url, target: '_blank', rel: 'noopener', title: 'The exact change, line by line' }, 'Diff on GitHub ↗')),
            h('div.detail-cols', {},
                h('div.detail-body', {},
                    e.detail && e.item ? h('p', { text: e.detail }) : null,
                    h('div.side-block', {}, h('h3', { text: 'Entry' }), h('p.side-row', {}, entryLink(e) || h('span.muted', { text: '—' })))),
                h('aside.detail-side', {},
                    h('div.side-block', {}, h('h3', { text: 'Review' }),
                        !r || r.auto ? h('p.muted', { text: r?.auto ? 'GM/admin change — approved automatically.' : 'Not tracked (made outside the CMS review).' })
                            : h('p', {}, h('strong', { text: r.status }), r.by ? h('span.muted', { text: ` by ${r.by}${r.at ? `, ${when(r.at)}` : ''}` }) : null, r.notes ? h('span.muted', { text: ` — ${r.notes}` }) : null),
                        canReview && r && !r.auto ? h('div.pair', {},
                            h('button.btn.small.primary', { type: 'button', disabled: r.status === 'approved', on: { click: () => review('approved') } }, 'Approve'),
                            h('button.btn.small.danger', { type: 'button', disabled: r.status === 'rejected', on: { click: () => review('rejected') } }, 'Reject')) : null))));
    }

    async function open(key) {
        current = key || null;
        if (!entries.length) {
            detail.replaceChildren(h('div.placeholder', {}, h('p', { text: 'Loading…' })));
            try { await loadMore(); } catch (err) { detail.replaceChildren(h('div.placeholder', {}, h('p.error', { text: err.message }))); return; }
        }
        list.update(entries, current);
        const e = entries.find((x) => x.sha === key);
        if (e) render(e);
        else {
            const pending = entries.filter((x) => x.review?.status === 'pending').length;
            detail.replaceChildren(h('div.placeholder.pad', {}, h('p', { text: `The ${entries.length} latest changes to the data${pending ? ` — ${pending} waiting for review (filter “Needs review”)` : ''}. Pick one for details and the diff.` })));
        }
    }

    return { el, open, focusSearch: () => list.focusSearch(), isDirty: () => false, save: () => {}, async reloadAll() { entries = []; page = 0; more = true; } };
}
