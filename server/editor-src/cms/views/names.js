// Names: the name list of the Grimoire (grimoire.piogino.ch/names, the clean master copy) with Adenai's record beside
// it — which name was given to whom, which belong to a major character (★: a second use asks first, so the villain
// never shares a name with a commoner), which are wanted for a character still to come (🔖). The record lives in the
// Grimoire too, kept through Adenai's key (server/routes/names.js); this view reads and changes it.
import { h, toast, fold, confirmDialog, formatDate } from '../dom';
import { api } from '../api';
import { store, canEdit } from '../store';

const FILTERS = [['all', 'All'], ['free', 'Free'], ['used', 'Used'], ['major', '★ Major character'], ['wanted', '🔖 Wanted']];
const PAGE = 300;

// a small form in a dialog: Promise of the values, or null when cancelled
function formDialog(title, fields, { ok = 'Save', extra } = {}) {
    return new Promise((resolve) => {
        const inputs = {};
        const close = (v) => { overlay.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
        const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
        const submit = (e) => { e.preventDefault(); close(Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.type === 'checkbox' ? el.checked : el.value.trim()]))); };
        const rows = fields.map((f) => {
            const input = f.type === 'checkbox'
                ? h('input', { type: 'checkbox', checked: !!f.value })
                : h('input', { type: 'text', value: f.value || '', placeholder: f.placeholder || '', list: f.list || null, autocomplete: 'off' });
            inputs[f.key] = input;
            return f.type === 'checkbox'
                ? h('label.name-check', {}, input, ' ', f.label, f.help ? h('span.muted', { text: ` — ${f.help}` }) : null)
                : h('label.name-field', {}, h('span', { text: f.label }), input);
        });
        const overlay = h('div.overlay', { on: { mousedown: (e) => { if (e.target === overlay) close(null); } } },
            h('form.dialog.small.name-dialog', { role: 'dialog', 'aria-modal': 'true', on: { submit } },
                h('h3', { text: title }), ...rows,
                h('div.dialog-actions', {},
                    extra ? h('button.btn.danger', { type: 'button', on: { click: () => close({ action: extra.action }) } }, extra.label) : null,
                    h('span.spacer'),
                    h('button.btn', { type: 'button', on: { click: () => close(null) } }, 'Cancel'),
                    h('button.btn.primary', { type: 'submit' }, ok))));
        document.body.append(overlay);
        document.addEventListener('keydown', key, true);
        Object.values(inputs)[0]?.focus();
    });
}

export function namesView() {
    const el = h('div.overview.names');
    let names = null;
    let error = '';
    let filter = 'all';
    let kind = '';
    let gender = '';
    let q = '';
    let shown = PAGE;
    let picked = [];

    async function load() {
        try { names = (await api('/api/names')).names; error = ''; } catch (err) { error = err.message; names = names || []; }
        draw();
    }

    const isMajor = (n) => n.uses.some((u) => u.major);
    const passes = (n) => (filter === 'all' || (filter === 'free' && !n.uses.length) || (filter === 'used' && n.uses.length) || (filter === 'major' && isMajor(n)) || (filter === 'wanted' && n.wanted))
        && (!kind || n.type === kind) && (!gender || n.gender === gender) && (!q || fold(n.name).includes(fold(q)));

    // ---- changes, each answered with the name's new state ----
    const replace = (n, patch) => { Object.assign(n, patch); draw(); };
    const charNames = () => [...new Set((store.characters || []).map((c) => c.name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    async function addUse(n) {
        const v = await formDialog(`Use “${n.name}”`, [
            { key: 'usedFor', label: 'For whom or what', placeholder: 'a character, a place, a ship …', list: 'name-characters' },
            { key: 'major', type: 'checkbox', label: '★ A major character', help: 'the name stays theirs: using it again asks first' },
            { key: 'note', label: 'Note', placeholder: 'optional' },
        ], { ok: 'Use' });
        if (!v) return;
        await send(n, () => api(`/api/names/${n.id}/uses`, { method: 'POST', body: v }), (body) => api(`/api/names/${n.id}/uses`, { method: 'POST', body: { ...v, ...body } }),
            (r) => replace(n, { uses: [...n.uses, r.use], wanted: null }));
    }

    async function editUse(n, u) {
        const v = await formDialog(`“${n.name}” — ${u.usedFor || 'used'}`, [
            { key: 'usedFor', label: 'For whom or what', value: u.usedFor, list: 'name-characters' },
            { key: 'major', type: 'checkbox', label: '★ A major character', value: u.major },
            { key: 'note', label: 'Note', value: u.note },
        ], { extra: { action: 'remove', label: 'Release the name' } });
        if (!v) return;
        if (v.action === 'remove') {
            if (!(await confirmDialog(`Release “${n.name}” from ${u.usedFor || 'this use'}?`, { ok: 'Release', danger: true }))) return;
            try { await api(`/api/names/uses/${u.id}`, { method: 'DELETE' }); replace(n, { uses: n.uses.filter((x) => x.id !== u.id) }); toast(`${n.name}: released`); } catch (err) { toast(err.message, 'bad', 6000); }
            return;
        }
        await send(n, () => api(`/api/names/uses/${u.id}`, { method: 'PUT', body: v }), (body) => api(`/api/names/uses/${u.id}`, { method: 'PUT', body: { ...v, ...body } }),
            (r) => replace(n, { uses: n.uses.map((x) => (x.id === u.id ? r.use : x)) }));
    }

    // a request that may meet a major character: say why, and send again with force when confirmed
    async function send(n, first, again, done) {
        try { done(await first()); toast(`${n.name}: saved`); } catch (err) {
            if (err.status !== 409) return toast(err.message, 'bad', 6000);
            if (!(await confirmDialog(`${n.name}: ${err.message}. Use it anyway?`, { ok: 'Use anyway', danger: true }))) return;
            try { done(await again({ force: true })); toast(`${n.name}: saved`); } catch (e) { toast(e.message, 'bad', 6000); }
        }
    }

    async function toggleWanted(n) {
        try {
            const r = await api(`/api/names/${n.id}/wanted`, { method: 'PUT', body: n.wanted ? { wanted: false } : { wanted: true } });
            replace(n, { wanted: r.wanted });
        } catch (err) { toast(err.message, 'bad', 6000); }
    }

    function pick() {
        const pool = names.filter((n) => !n.uses.length && !n.wanted && (!kind || n.type === kind) && (!gender || n.gender === gender));
        picked = [];
        while (picked.length < 5 && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        draw();
    }

    // ---- the page ----
    function draw() {
        if (!names) { el.replaceChildren(h('section.overview-block', {}, h('p.muted', { text: 'Loading the names from the Grimoire…' }))); return; }
        const editable = canEdit();
        const rows = names.filter(passes);
        const count = (f) => names.filter((n) => f === 'all' || (f === 'free' && !n.uses.length) || (f === 'used' && n.uses.length) || (f === 'major' && isMajor(n)) || (f === 'wanted' && n.wanted)).length;
        const kinds = [...new Set(names.map((n) => n.type).filter(Boolean))];
        const genders = [...new Set(names.map((n) => n.gender).filter(Boolean))];
        const select = (value, all, opts, set) => h('select', { on: { change: (e) => { set(e.target.value); shown = PAGE; draw(); } } },
            h('option', { value: '', text: all }), ...opts.map((o) => h('option', { value: o, text: o, selected: o === value })));
        const search = h('input', { type: 'search', placeholder: `Search ${names.length} names…`, value: q, on: { input: () => { q = search.value; shown = PAGE; drawTable(); } } });
        const table = h('div.name-table');

        function drawTable() {
            const list = names.filter(passes);
            table.replaceChildren(...[
                h('p.muted.small', { text: `${list.length} of ${names.length} names` }),
                ...list.slice(0, shown).map((n) => h(`div.name-row${isMajor(n) ? '.major' : ''}`, {},
                    h('strong.name-name', { text: n.name }),
                    h('span.muted.small', { text: [n.type, n.gender].filter(Boolean).join(' · ') }),
                    h('span.name-uses', {}, ...n.uses.map((u) => h(`button.chip${u.major ? '.major' : ''}`, {
                        type: 'button', disabled: !editable, title: [u.major ? 'A major character' : 'Used', u.note, u.at && `since ${formatDate(u.at)}`].filter(Boolean).join(' · '),
                        on: { click: () => editUse(n, u) },
                    }, `${u.major ? '★ ' : ''}${u.usedFor || 'used'}`))),
                    h('span.spacer'),
                    editable ? h(`button.btn.ghost.small${n.wanted ? '.on' : ''}`, { type: 'button', title: n.wanted ? `Wanted${n.wanted.note ? `: ${n.wanted.note}` : ''} — click to drop the wish` : 'Mark as wanted: you want this name for a character still to come', on: { click: () => toggleWanted(n) } }, n.wanted ? '🔖 Wanted' : '🔖') : null,
                    editable ? h('button.btn.small', { type: 'button', on: { click: () => addUse(n) } }, n.uses.length ? '+ Use again' : '+ Use') : null)),
                list.length > shown ? h('button.btn.ghost', { type: 'button', on: { click: () => { shown += PAGE; drawTable(); } } }, `Show ${Math.min(PAGE, list.length - shown)} more`) : null,
            ].filter(Boolean)); // replaceChildren writes a null as the text "null"
        }
        drawTable();

        el.replaceChildren(
            h('datalist#name-characters', {}, ...charNames().map((c) => h('option', { value: c }))),
            h('section.overview-block', {},
                h('div.emote-head', {}, h('h2', { text: 'Names' }), h('span.muted', { text: `${names.length} names · ${count('used')} used · ${count('major')} major · ${count('wanted')} wanted` }),
                    h('span.spacer'), h('a.btn.ghost.small', { href: 'https://grimoire.piogino.ch/names', target: '_blank', rel: 'noopener' }, 'The list in the Grimoire ↗')),
                h('p.muted', { text: 'The list itself lives in the Grimoire and stays clean there; what Adenai did with each name is kept here. ★ A major character: the name stays theirs — using it again asks first. 🔖 Wanted: kept for a character still to come. Click a use to change it or release the name.' }),
                error ? h('p.error', { text: `⚠ ${error}` }) : null,
                h('div.name-pick', {}, h('button.btn.primary', { type: 'button', on: { click: pick } }, '🎲 Five free names'),
                    picked.length ? h('span', {}, ...picked.map((n) => h('span.name-picked', { text: n.name }))) : h('span.muted', { text: 'Unused and not wanted, of the kind and gender chosen below.' }))),
            h('section.overview-block', {},
                h('div.name-filters', {},
                    ...FILTERS.map(([k, label]) => h(`button.chip${filter === k ? '.active' : ''}`, { type: 'button', on: { click: () => { filter = k; shown = PAGE; draw(); } } }, `${label} ${count(k)}`)),
                    select(kind, 'Every kind', kinds, (v) => { kind = v; }), select(gender, 'Any gender', genders, (v) => { gender = v; }), search),
                rows.length ? table : h('p.muted', { text: 'No name matches.' })));
    }

    return {
        el,
        open: () => { if (!names) { draw(); load(); } else draw(); },
        focusSearch: () => el.querySelector('input[type="search"]')?.focus(),
        isDirty: () => false,
    };
}
