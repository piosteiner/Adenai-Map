// Characters from the minutes: the people the minutes name but the map does not know yet (read from the minutes on
// 2026-11-19, server/routes/minutes-characters.js). The checked ones come ticked, the unsure ones (a pun, a nickname, a
// god, a name only on a medallion) not. Edit what needs it, then "Create": one commit for all, the first mention per
// session becomes a link, and the name list in the Grimoire learns who carries its names.
import { h, toast, confirmDialog } from '../dom';
import { api } from '../api';
import { store, reload, canEdit } from '../store';

const STATUS = ['alive', 'dead', 'undead', 'missing', 'unknown'];
const REL = ['friendly', 'neutral', 'suspicious', 'enemy', 'hostile', 'unknown'];
const idOf = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

export function minutesCharactersView() {
    const el = h('div.overview.names.minutes-chars');
    let list = null;
    let busy = false;

    async function load() {
        try { list = (await api('/api/minutes-characters')).candidates.map((c) => ({ ...c, pick: c.suggested })); } catch (err) { list = []; toast(err.message, 'bad', 6000); }
        draw();
    }

    function draw() {
        if (!list) { el.replaceChildren(h('section.overview-block', {}, h('p.muted', { text: 'Loading…' }))); return; }
        const editable = canEdit();
        const known = new Set((store.characters || []).map((c) => c.id));
        const picked = list.filter((c) => c.pick && !known.has(idOf(c.name)));
        const field = (c, k, attrs = {}) => h('input', { type: 'text', value: c[k] || '', ...attrs, on: { change: (e) => { c[k] = e.target.value; } } });
        const select = (c, k, opts) => h('select', { on: { change: (e) => { c[k] = e.target.value; } } }, ...opts.map((o) => h('option', { value: o, text: o, selected: o === c[k] })));
        const row = (c) => {
            const exists = known.has(idOf(c.name));
            return h(`div.mc-row${c.pick && !exists ? '.on' : ''}${c.suggested ? '' : '.unsure'}`, {},
                h('label.mc-pick', {}, h('input', { type: 'checkbox', checked: c.pick && !exists, disabled: exists || !editable, on: { change: (e) => { c.pick = e.target.checked; draw(); } } })),
                h('div.mc-main', {},
                    h('div.mc-line', {}, field(c, 'name', { class: 'mc-name', 'aria-label': 'Name' }), field(c, 'title', { placeholder: 'Title / role', 'aria-label': 'Title' }),
                        select(c, 'status', STATUS), select(c, 'relationship', REL), field(c, 'placeOfOrigin', { placeholder: 'Place of origin', list: 'mc-places', 'aria-label': 'Place of origin' })),
                    h('textarea', { rows: 2, value: c.description || '', 'aria-label': 'Description', on: { change: (e) => { c.description = e.target.value; } } }),
                    h('p.muted.small', {},
                        exists ? h('strong.error', { text: 'A character with this name exists already. ' }) : null,
                        c.suggested ? '' : h('span.mc-unsure', { text: 'unsure — ' }),
                        `Sessions ${(c.sessions || []).join(', ')} · linked as ${(c.forms || []).filter((f) => f.length >= 4).join(', ') || '— (too short to link safely)'}`,
                        c.evidence ? h('span', { text: ` · «${c.evidence}»` }) : null)));
        };
        el.replaceChildren(
            h('datalist#mc-places', {}, ...(store.locations || []).map((l) => l.properties?.name || l.name).filter(Boolean).map((n) => h('option', { value: n }))),
            h('section.overview-block', {},
                h('div.emote-head', {}, h('h2', { text: 'Characters from the minutes' }), h('span.muted', { text: `${list.length} people the minutes name who are not characters yet` })),
                h('p.muted', { text: 'Read from all minutes: ticked are the ones that are clearly people; the unsure ones (a pun, a nickname, a god, a name only on a medallion) are listed below them, not ticked. Change what needs it — the descriptions say only what the minutes say. "Create" adds the ticked ones as characters in one commit, turns the first mention in each session into a link to them, and links them with the name list in the Grimoire. Created ones leave this list.' }),
                editable ? h('div.name-pick', {},
                    h('button.btn.primary', { type: 'button', disabled: busy || !picked.length, on: { click: create } }, busy ? 'Creating…' : `Create ${picked.length} characters`),
                    h('button.btn.ghost.small', { type: 'button', on: { click: () => { list.forEach((c) => { c.pick = c.suggested; }); draw(); } } }, 'Tick the checked ones'),
                    h('button.btn.ghost.small', { type: 'button', on: { click: () => { list.forEach((c) => { c.pick = false; }); draw(); } } }, 'Untick all')) : h('p.muted', { text: 'Log in to create them.' })),
            h('section.overview-block', {}, list.length ? list.map(row) : h('p.muted', { text: 'Nobody left — all created or dropped.' })));
    }

    async function create() {
        const known = new Set((store.characters || []).map((c) => c.id));
        const items = list.filter((c) => c.pick && !known.has(idOf(c.name)));
        if (!items.length || !(await confirmDialog(`Create ${items.length} characters and link their first mention in each session?`, { ok: 'Create' }))) return;
        busy = true; draw();
        try {
            const r = await api('/api/minutes-characters/create', { method: 'POST', body: { items } });
            await reload('characters');
            toast(`${r.created.length} characters created · ${r.links.links} links in ${r.links.sessions} sessions${r.names?.error ? ` · name list: ${r.names.error}` : r.names ? ` · ${r.names.linked + r.names.added} names linked` : ''}`, 'ok', 9000);
            if (r.skipped?.length) toast(`Already there: ${r.skipped.join(', ')}`, 'warn', 9000);
            busy = false;
            await load();
        } catch (err) { busy = false; toast(`Not created: ${err.message}`, 'bad', 8000); draw(); }
    }

    return {
        el,
        open: () => { if (!list) { draw(); load(); } else draw(); },
        isDirty: () => false,
    };
}
