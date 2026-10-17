// Small DOM helpers for the CMS: element builder, escaping, toasts, a confirm dialog.

// h('div.class#id', { attrs, on: { click } }, ...children) — children: nodes, strings, arrays, null
export function h(tag, props = {}, ...children) {
    const [, name = 'div', rest = ''] = /^([a-z0-9-]*)(.*)$/i.exec(tag);
    const node = document.createElement(name || 'div');
    for (const part of rest.match(/[.#][^.#]+/g) || []) {
        if (part[0] === '.') node.classList.add(part.slice(1));
        else node.id = part.slice(1);
    }
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
        else if (k === 'class') node.className += ` ${v}`;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k in node && typeof v !== 'string') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
    }
    append(node, children);
    return node;
}

function append(node, children) {
    for (const c of children.flat(Infinity)) {
        if (c == null || c === false) continue;
        node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Accent- and case-insensitive text for search and comparing names
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let toastBox = null;
export function toast(message, kind = 'ok', ms = 3500) {
    if (!toastBox) toastBox = document.body.appendChild(h('div.toasts', { 'aria-live': 'polite' }));
    const t = toastBox.appendChild(h(`div.toast.${kind}`, { text: message }));
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
}

// Promise<boolean>; a small modal instead of window.confirm (which looks foreign and blocks the page)
export function confirmDialog(text, { ok = 'OK', danger = false } = {}) {
    return new Promise((resolve) => {
        const close = (v) => { overlay.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
        const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(false); } };
        const okBtn = h(`button.btn${danger ? '.danger' : '.primary'}`, { type: 'button', on: { click: () => close(true) } }, ok);
        const overlay = h('div.overlay', { on: { mousedown: (e) => { if (e.target === overlay) close(false); } } },
            h('div.dialog.small', { role: 'alertdialog', 'aria-modal': 'true' },
                h('p', { text }),
                h('div.dialog-actions', {}, h('button.btn', { type: 'button', on: { click: () => close(false) } }, 'Cancel'), okBtn)));
        document.body.append(overlay);
        document.addEventListener('keydown', key, true);
        okBtn.focus();
    });
}

export function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
