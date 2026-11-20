// Names: the name list of the Grimoire (grimoire.piogino.ch/names, the clean master copy) with Adenai's record beside
// it — which name was given to whom, which belong to a major character (★: a second use asks first, so the villain
// never shares a name with a commoner), which are wanted for a character still to come (🔖). The record lives in the
// Grimoire too, kept through Adenai's key (server/routes/names.js); this view reads and changes it.
import { h, toast, fold, confirmDialog, formatDate } from '../dom';
import { api } from '../api';
import { store, canEdit } from '../store';

const FILTERS = [['all', 'All'], ['free', 'Free'], ['used', 'Used'], ['major', '★ Major character'], ['wanted', '🔖 Wanted']];
const PAGE = 300;
// the picker's settings, remembered in this browser
const PICK_KEY = 'adenai-name-picker';
const PICK_DEFAULT = { gender: '', kind: 'first', count: 5, meaning: false, redraw: 'none' };
const loadPick = () => { try { return { ...PICK_DEFAULT, ...JSON.parse(localStorage.getItem(PICK_KEY) || '{}') }; } catch { return { ...PICK_DEFAULT }; } };
const REDRAW = [['none', 'Free names only'], ['minor', 'Also names of minor characters'], ['all', 'All names']];

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
                : f.type === 'select'
                    ? h('select', {}, ...f.options.map(([v, label]) => h('option', { value: v, text: label, selected: v === (f.value || '') })))
                    : h('input', { type: 'text', value: f.value || '', placeholder: f.placeholder || '', list: f.list || null, autocomplete: 'off' });
            inputs[f.key] = input;
            return f.type === 'checkbox'
                ? h('label.name-check', {}, input, ' ', f.label, f.help ? h('span.muted', { text: ` — ${f.help}` }) : null)
                : h('label.name-field', {}, h('span', { text: f.label }), input, f.help ? h('span.muted.small', { text: f.help }) : null);
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
    let picked = [];      // [{ parts: [name, family?] }]
    let pk = loadPick();
    const setPk = (patch) => { pk = { ...pk, ...patch }; try { localStorage.setItem(PICK_KEY, JSON.stringify(pk)); } catch { /* private window */ } draw(); };

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
    const charById = (id) => (store.characters || []).find((c) => c.id === id);
    // the characters to link a use to: those whose name holds this name first, then the rest
    const charOptions = (n) => {
        const all = [...(store.characters || [])].filter((c) => c.id && c.name).sort((a, b) => a.name.localeCompare(b.name));
        const has = (c) => fold(c.name).split(/[^a-z0-9äöüß'-]+/).includes(fold(n.name));
        return [['', '— no character (a place, a ship, someone without an entry) —'], ...all.filter(has).map((c) => [c.id, `${c.name} ✓`]), ...all.filter((c) => !has(c)).map((c) => [c.id, c.name])];
    };
    // the form's answer → the use: a chosen character gives its name when "for whom" is left empty
    const withChar = (v) => { const c = charById(v.ref); return { ...v, ref: v.ref || null, usedFor: v.usedFor || c?.name || '' }; };

    async function addUse(n) {
        const v0 = await formDialog(`Use “${n.name}”`, [
            { key: 'ref', type: 'select', label: 'Character', options: charOptions(n), help: '✓ their name has this one' },
            { key: 'usedFor', label: 'For whom or what', placeholder: 'empty: the character\'s name', list: 'name-characters' },
            { key: 'major', type: 'checkbox', label: '★ A major character', help: 'the name stays theirs: using it again asks first' },
            { key: 'note', label: 'Note', placeholder: 'optional' },
        ], { ok: 'Use' });
        if (!v0) return;
        const v = withChar(v0);
        await send(n, () => api(`/api/names/${n.id}/uses`, { method: 'POST', body: v }), (body) => api(`/api/names/${n.id}/uses`, { method: 'POST', body: { ...v, ...body } }),
            (r) => replace(n, { uses: [...n.uses, r.use], wanted: null }));
    }

    async function editUse(n, u) {
        const v0 = await formDialog(`“${n.name}” — ${u.usedFor || 'used'}`, [
            { key: 'ref', type: 'select', label: 'Character', value: u.ref, options: charOptions(n), help: '✓ their name has this one' },
            { key: 'usedFor', label: 'For whom or what', value: u.usedFor, list: 'name-characters' },
            { key: 'major', type: 'checkbox', label: '★ A major character', value: u.major },
            { key: 'note', label: 'Note', value: u.note },
        ], { extra: { action: 'remove', label: 'Release the name' } });
        if (!v0) return;
        const v = v0.action ? v0 : withChar(v0);
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

    // which names the picker may draw: free ones (never used, not wanted), also those of minor characters (used,
    // but never for a ★ major one; still not wanted), or all of them
    const drawable = (n) => (pk.redraw === 'all' ? true : pk.redraw === 'minor' ? !isMajor(n) && !n.wanted : !n.uses.length && !n.wanted);
    const pickPools = () => {
        const firsts = names.filter((n) => n.type === 'First name' && (!pk.gender || n.gender === pk.gender) && drawable(n));
        const families = names.filter((n) => n.type === 'Family name' && drawable(n));
        return { firsts, families, pool: pk.kind === 'family' ? families : firsts };
    };
    const takeRandom = (list, k) => { const left = [...list]; const out = []; while (out.length < k && left.length) out.push(left.splice(Math.floor(Math.random() * left.length), 1)[0]); return out; };
    function pick() {
        const { firsts, families, pool } = pickPools();
        const k = Math.max(1, Math.min(30, Number(pk.count) || 5));
        if (pk.kind === 'full') {
            const lasts = takeRandom(families, k);
            picked = takeRandom(firsts, k).map((f, i) => ({ parts: [f, lasts.length ? lasts[i % lasts.length] : null].filter(Boolean) }));
        } else picked = takeRandom(pool, k).map((n) => ({ parts: [n] }));
        draw();
    }

    function picker(editable) {
        const { firsts, families, pool } = pickPools();
        const seg = (opts, value, key) => h('span.name-seg', {}, ...opts.map(([v, label]) => h(`button.chip${value === v ? '.active' : ''}`, { type: 'button', 'aria-pressed': String(value === v), on: { click: () => setPk({ [key]: v }) } }, label)));
        const k = Math.max(1, Math.min(30, Number(pk.count) || 5));
        const countInput = h('input.name-count', { type: 'number', min: 1, max: 30, value: k, 'aria-label': 'Number of names', on: { change: (e) => setPk({ count: e.target.value }) } });
        const usedNote = (n) => (n.uses.length ? `${isMajor(n) ? '★ ' : ''}used for ${n.uses.map((u) => u.usedFor || 'someone').join(', ')}` : n.wanted ? 'wanted' : '');
        return h('div.name-picker', {},
            h('div.name-filters', {},
                seg([['', 'Any'], ['Female', 'Female'], ['Male', 'Male'], ['Neutral', 'Neutral']], pk.gender, 'gender'),
                seg([['first', 'First names'], ['full', 'Full names'], ['family', 'Family names']], pk.kind, 'kind'),
                h('span.name-seg', {}, h('button.btn.ghost.small', { type: 'button', 'aria-label': 'One fewer', on: { click: () => setPk({ count: Math.max(1, k - 1) }) } }, '−'), countInput,
                    h('button.btn.ghost.small', { type: 'button', 'aria-label': 'One more', on: { click: () => setPk({ count: Math.min(30, k + 1) }) } }, '+')),
                h('label.name-check', {}, h('input', { type: 'checkbox', checked: pk.meaning, on: { change: (e) => setPk({ meaning: e.target.checked }) } }), ' Show the meaning')),
            h('div.name-filters', {},
                h('span.muted.small', { text: 'Draw from:' }), seg(REDRAW, pk.redraw, 'redraw'),
                h('span.spacer'),
                h('button.btn.primary', { type: 'button', disabled: !pool.length, on: { click: pick } }, `🎲 Pick ${k}`)),
            h('p.muted.small', { text: `From ${pool.length} ${pk.kind === 'family' ? 'family names' : `${pk.gender ? `${pk.gender.toLowerCase()} ` : ''}first names`}${pk.kind === 'full' ? ` and ${families.length} family names` : ''}${pk.gender && pk.kind !== 'family' ? ' (names without a gender only under Any)' : ''}.` }),
            picked.length ? h(`div.name-results${pk.meaning ? '.with-meaning' : ''}`, {}, ...picked.map((p) => h('div.name-result', {},
                h('span.name-picked', { text: p.parts.map((n) => n.name).join(' ') }),
                ...p.parts.map((n) => h('span.name-result-part', {},
                    p.parts.length > 1 ? h('strong.small', { text: `${n.name}: ` }) : null,
                    usedNote(n) ? h('span.muted.small', { text: `${usedNote(n)} ` }) : null,
                    editable ? h('button.btn.ghost.small', { type: 'button', title: `Use “${n.name}”`, on: { click: () => addUse(n) } }, '+ Use') : null,
                    editable ? h(`button.btn.ghost.small${n.wanted ? '.on' : ''}`, { type: 'button', title: n.wanted ? 'Wanted — click to drop the wish' : 'Mark as wanted', on: { click: () => toggleWanted(n) } }, '🔖') : null,
                    pk.meaning ? h('span.name-meaning.small', {}, n.meaning || 'no meaning known', ' ', n.meaningSource ? h('a', { href: n.meaningSource, target: '_blank', rel: 'noopener' }, /wiktionary\.org/.test(n.meaningSource) ? 'Wiktionary ↗' : 'source ↗') : null) : null))))) : null);
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
                    h('span.name-uses', {}, ...n.uses.map((u) => h('span.name-use', {},
                        h(`button.chip${u.major ? '.major' : ''}`, {
                            type: 'button', disabled: !editable, title: [u.major ? 'A major character' : 'Used', u.ref && !charById(u.ref) ? `linked to ${u.ref}, no longer a character` : null, u.note, u.at && `since ${formatDate(u.at)}`].filter(Boolean).join(' · '),
                            on: { click: () => editUse(n, u) },
                        }, `${u.major ? '★ ' : ''}${u.usedFor || 'used'}`),
                        u.ref && charById(u.ref) ? h('a.name-link', { href: `#/characters/${encodeURIComponent(u.ref)}`, title: `Open ${charById(u.ref).name}` }, '👤') : null))),
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
                picker(editable)),
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
