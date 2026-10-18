// Form pieces for the detail views: labelled fields, the Markdown/[[link]] editor, and change tracking.
import { h } from './dom';

export function field(label, control, { wide = false, hint = '' } = {}) {
    return h(`label.field${wide ? '.wide' : ''}`, {}, h('span.field-label', { text: label }), control, hint ? h('span.field-hint', { text: hint }) : null);
}

export const input = (value, props = {}) => h('input', { type: 'text', value: value ?? '', ...props });

export function select(value, opts, { empty = '—', ...props } = {}) {
    const s = h('select', props, empty !== null ? h('option', { value: '' }, empty) : null, ...opts.map((o) => h('option', { value: o.value }, o.label)));
    s.value = value ?? '';
    // a stored value the config doesn't know (any more): keep it selectable instead of losing it on save
    if (value && s.value !== value) { s.append(h('option', { value }, `${value} (unknown)`)); s.value = value; }
    return s;
}

export const checkbox = (checked, label) => {
    const box = h('input', { type: 'checkbox', checked: !!checked });
    return { box, el: h('label.check', {}, box, ` ${label}`) };
};

// A textarea that becomes the CodeMirror editor with [[ suggestions (md-editor.js); read it with .value
export function markdown(value, { placeholder = '', rows = 5 } = {}) {
    const ta = h('textarea', { rows, placeholder, 'data-md': '' });
    ta.value = value || '';
    requestAnimationFrame(() => window.AdenaiEditor?.enhance(ta));
    return ta;
}

// Tracks whether a form's values differ from what was loaded. read() returns the current values as an object.
export function tracker(read, onDirty) {
    let base = JSON.stringify(read());
    let dirty = false;
    const check = () => {
        const now = JSON.stringify(read()) !== base;
        if (now !== dirty) { dirty = now; onDirty(dirty); }
    };
    return {
        check,
        isDirty: () => dirty,
        // saved: the values that were saved (typing during the save stays unsaved); default: what the form holds now
        reset(saved = read()) { base = JSON.stringify(saved); dirty = false; onDirty(false); check(); },
    };
}

// Saves a form by itself — characters, locations, media: a field once it is left or a choice made (the form's
// change event), a long text after a pause in typing; changes close together go into one save, so one entry in the
// history. persist(values) saves the values read() gave and throws to report a failure. state: an element that says
// "Saving…", "✓ Saved 16:42" or "⚠ Not saved: … — retry" (a click retries).
//   form events: autosave.attach(form) · other changes (the gallery, a map click): autosave.changed()
//   before leaving: await autosave.flush() → true when nothing is left unsaved
export function autosaver({ read, track, persist, state, fieldDelay = 1500, typingDelay = 3000 }) {
    let timer = null;
    let running = null;
    const show = (text, kind = '') => { state.textContent = text; state.className = `save-state autosave${kind ? ` ${kind}` : ''}`; };
    const time = () => new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    state.addEventListener('click', () => { if (state.classList.contains('bad')) flush(); });
    state.title = 'Changes are saved by themselves';

    function schedule(ms) {
        track.check();
        clearTimeout(timer);
        if (!track.isDirty()) return;
        show('● unsaved…');
        timer = setTimeout(flush, ms);
    }
    async function flush() {
        clearTimeout(timer);
        timer = null;
        while (running) await running;            // one save at a time; then the newest values
        track.check();
        if (!track.isDirty()) return true;
        const values = read();
        let ok = false;
        running = (async () => {
            show('Saving…', 'busy');
            try {
                await persist(values);
                track.reset(values);
                ok = true;
                show(`✓ Saved ${time()}`, 'ok');
            } catch (err) {
                show(`⚠ Not saved: ${err.message} — click to retry`, 'bad');
            }
        })();
        await running;
        running = null;
        if (ok && track.isDirty()) schedule(fieldDelay); // typed while it was saving
        return ok && !track.isDirty();
    }
    return {
        attach(form) {
            form.addEventListener('change', () => schedule(fieldDelay));
            form.addEventListener('input', (e) => (e.target.tagName === 'TEXTAREA' ? schedule(typingDelay) : track.check()));
        },
        changed: (ms = fieldDelay) => schedule(ms),
        flush,
        pending: () => !!timer || !!running,
    };
}

// A searchable choice from a list (a character's place of origin): type a few letters, the best matches show below —
// the site's search (src/utils/search.js: spelling doesn't matter, the name before other fields), the letters marked —,
// ↑ ↓ and Enter or a click choose, Esc closes, × clears. Only an entry of the list can be chosen: text that names
// none returns to the last choice. el.value is the chosen name ('' = none); a choice fires "change" (autosave).
// items(): [{ name, detail }] — asked each time the list opens (the store may have changed)
export function searchPicker(value, items, { readOnly = false, placeholder = 'Search…', emptyLabel = '— unknown —', limit = 8 } = {}) {
    let chosen = value || '';
    const field = h('input', { type: 'text', value: chosen, placeholder: chosen ? '' : emptyLabel, readOnly, autocomplete: 'off', spellcheck: false,
        role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false' });
    const clear = h('button.picker-clear', { type: 'button', title: 'Clear (unknown)', tabindex: '-1', hidden: !chosen || readOnly }, '×');
    const menu = h('ul.search-picker-menu', { role: 'listbox', hidden: true });
    const hint = h('span.search-picker-hint', { hidden: true });
    const el = h('div.search-picker', {}, field, clear, menu, hint);
    let shown = [];
    let active = -1;
    const S = () => window.AdenaiSearch;
    const fold = (t) => (S() ? S().fold(t) : String(t).toLowerCase()).trim();

    function results(q) {
        const all = items();
        if (!q.trim()) return all.slice(0, limit);
        if (!S()) return all.filter((i) => fold(i.name).includes(fold(q))).slice(0, limit);
        return S().rank(all, q, (i) => ({ name: i.name, fields: [{ label: '', text: i.detail || '', weight: 2 }] }), { limit }).map((r) => r.item);
    }
    function draw() {
        const q = field.value;
        shown = results(q);
        active = shown.length ? 0 : -1;
        menu.replaceChildren(...(shown.length ? shown.map((i, n) => h('li', {
            role: 'option', 'aria-selected': String(n === active), dataset: { n: String(n) },
            on: { mousedown: (e) => { e.preventDefault(); pick(i.name); } },
        }, h('span.sp-name', { html: S() ? S().highlight(i.name, q) : i.name }), i.detail ? h('span.sp-detail', { text: i.detail }) : null))
            : [h('li.sp-none', { text: 'No place of that name' })]));
        menu.hidden = false;
        field.setAttribute('aria-expanded', 'true');
    }
    function close() { menu.hidden = true; field.setAttribute('aria-expanded', 'false'); }
    function mark() { [...menu.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === active))); menu.children[active]?.scrollIntoView({ block: 'nearest' }); }
    function pick(name) {
        const changed = name !== chosen;
        chosen = name;
        field.value = name;
        field.placeholder = name ? '' : emptyLabel;
        clear.hidden = !name || readOnly;
        hint.hidden = true;
        close();
        if (changed) el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // leaving the field: the text names an entry → that one; empty → none; anything else → back to the last choice
    function settle() {
        const t = field.value.trim();
        if (!t) return pick('');
        const exact = items().find((i) => fold(i.name) === fold(t));
        if (exact) return pick(exact.name);
        field.value = chosen;
        hint.textContent = `“${t}” is not a place — pick one from the list`;
        hint.hidden = false;
        setTimeout(() => { hint.hidden = true; }, 3500);
        close();
    }
    if (!readOnly) {
        field.addEventListener('focus', () => { field.select(); draw(); });
        field.addEventListener('input', (e) => { e.stopPropagation(); draw(); }); // not a change of the form yet
        field.addEventListener('change', (e) => e.stopPropagation());          // the picker reports its own changes
        field.addEventListener('blur', () => settle());
        field.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (menu.hidden) return draw();
                active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
                mark();
            } else if (e.key === 'Enter') {
                e.preventDefault(); // not the form's submit
                if (!menu.hidden && shown[active]) pick(shown[active].name); else settle();
            } else if (e.key === 'Escape') {
                field.value = chosen; close();
            } else if (e.key === 'Tab' && !menu.hidden && shown[active] && field.value.trim() && field.value !== chosen) {
                pick(shown[active].name); // Tab takes the highlighted match, then moves on
            }
        });
        clear.addEventListener('click', () => { pick(''); field.focus(); });
    }
    Object.defineProperty(el, 'value', { get: () => chosen, set: (v) => { chosen = v || ''; field.value = chosen; field.placeholder = chosen ? '' : emptyLabel; clear.hidden = !chosen || readOnly; } });
    el.focus = () => field.focus();
    return el;
}
