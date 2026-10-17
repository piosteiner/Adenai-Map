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
        reset() { base = JSON.stringify(read()); dirty = false; onDirty(false); },
    };
}
