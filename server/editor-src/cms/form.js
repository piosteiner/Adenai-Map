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
