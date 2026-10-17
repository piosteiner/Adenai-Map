// Markdown editor for the Adenai admin (bundled by `npm run build` → ../admin-interface/js/libs/md-editor.js).
// Ported from the art history admin (backend/src/admin/editor/editor.js there).
//
// Every <textarea data-md> becomes a CodeMirror 6 editor with "live styling": **bold** looks bold, *italic* italic,
// [[links]] coloured — the markers stay visible but dimmed, so what you see is exactly what is saved. The textarea
// stays in the form (hidden) and in sync both ways: the admin modules fill forms with `textarea.value = …` and
// form.reset(), and read them back with FormData, exactly as before.
//
// [[links]] as in Obsidian: typing "[[" and a few letters lists matching characters and locations; picking one writes
// [[Name]]. The map renders them with src/utils/rich-text.js (copied to js/core/rich-text.js by the build).
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, placeholder, drawSelection, Decoration, ViewPlugin, MatchDecorator } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, LanguageSupport } from '@codemirror/language';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { tags as t } from '@lezer/highlight';
import { autocompletion, startCompletion } from '@codemirror/autocomplete';

// ---------- what [[links]] can point to: the admin's loaded characters and locations ----------

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function entries() {
    const chars = (window.adminCharacters?.getCharacters?.() || []).map((c) => ({
        kind: 'character', name: c.name, detail: ['NPC', c.title].filter(Boolean).join(' · '),
    }));
    const locs = (window.adminLocations?.getLocations?.() || []).map((l) => ({
        kind: 'location', name: l.properties?.name, detail: ['Ort', l.properties?.region].filter(Boolean).join(' · '),
    }));
    return [...chars, ...locs].filter((e) => e.name);
}

export function resolve(name) {
    const key = fold(name);
    const hit = entries().find((e) => fold(e.name) === key);
    return hit ? { kind: hit.kind, name: hit.name } : null;
}

async function linkCompletions(context) {
    const m = context.matchBefore(/\[\[[^\[\]|\n]*$/);
    if (!m) return null;
    const q = fold(m.text.slice(2));
    const ranked = entries()
        .map((e) => {
            const n = fold(e.name);
            const score = !q ? 3 : n.startsWith(q) ? 0 : n.split(/[\s\-']+/).some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : -1;
            return { e, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name, 'de'))
        .slice(0, 30);
    const after = context.state.sliceDoc(context.pos, context.pos + 2); // "]]" already typed after the cursor?
    return {
        from: m.from,
        to: after === ']]' ? context.pos + 2 : context.pos,
        filter: false, // ranked above; the typed "[[ako" wouldn't match "Akónetchie" by CodeMirror's own filter
        options: ranked.map(({ e }) => ({ label: e.name, detail: e.detail, type: 'text', apply: `[[${e.name}]]` })),
    };
}

// [[links]] coloured in the editor; a name that matches nothing (yet) is marked
const wikiDeco = new MatchDecorator({
    regexp: /\[\[([^\[\]|\n]+?)(?:\|[^\[\]\n]+?)?\]\]/g,
    decoration: (m) => Decoration.mark({ class: resolve(m[1]) ? 'cm-wikilink' : 'cm-wikilink cm-wikilink-missing' }),
});
const wikiLinks = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = wikiDeco.createDeco(view); }
    update(u) { this.decorations = wikiDeco.updateDeco(u, this.decorations); }
}, { decorations: (v) => v.decorations });

// ---------- look ----------

// Colours from the admin's CSS variables, so its light/dark theme just works.
const liveStyle = HighlightStyle.define([
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700', fontSize: '1.1em' },
    { tag: t.link, color: 'var(--accent-primary)', textDecoration: 'underline' },
    { tag: t.url, color: 'var(--text-secondary)', fontSize: '.9em' },
    { tag: t.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
    // the markers themselves: ** * # > - [ ]( )
    { tag: t.processingInstruction, color: 'var(--text-secondary)', opacity: '.6', fontWeight: '400', fontStyle: 'normal' },
]);

const theme = EditorView.theme({
    '&': { background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0 0 6px 6px' },
    '&.cm-focused': { outline: 'none', borderColor: 'var(--focus-border)', boxShadow: '0 0 0 3px var(--focus-ring)' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.55', minHeight: 'var(--md-min-height, 7rem)', maxHeight: '60vh' },
    '.cm-content': { padding: '.5rem .6rem', caretColor: 'var(--text-primary)' },
    '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--text-primary)' },
    '.cm-line': { padding: '0' },
    '.cm-placeholder': { color: 'var(--text-secondary)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: 'var(--focus-ring)' },
    '.cm-wikilink': { color: 'var(--accent-primary)', fontWeight: '600' },
    '.cm-wikilink-missing': { color: 'var(--toast-error)', textDecoration: 'underline dotted' },
    '.cm-tooltip': { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'inherit', maxHeight: '16em' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '.2rem .6rem' },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { background: 'var(--accent-primary)', color: '#fff' },
    '.cm-completionDetail': { color: 'var(--text-secondary)', fontStyle: 'normal', marginLeft: '.6rem' },
    '.cm-tooltip-autocomplete li[aria-selected] .cm-completionDetail': { color: 'inherit', opacity: '.85' },
});

// ---------- commands ----------

// Toggle a wrapper like ** or * around the selection (or insert an empty pair at the cursor).
function wrap(view, mark) {
    const changes = view.state.changeByRange((range) => {
        const text = view.state.sliceDoc(range.from, range.to);
        const before = view.state.sliceDoc(range.from - mark.length, range.from);
        const after = view.state.sliceDoc(range.to, range.to + mark.length);
        if (before === mark && after === mark) { // already wrapped → unwrap
            return {
                changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }],
                range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
            };
        }
        return {
            changes: { from: range.from, to: range.to, insert: mark + text + mark },
            range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
        };
    });
    view.dispatch(view.state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
    view.focus();
    return true;
}

function webLink(view) {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to) || 'Linktext';
    const urlStart = from + text.length + 3;
    view.dispatch({ changes: { from, to, insert: `[${text}](https://)` }, selection: { anchor: urlStart, head: urlStart + 8 }, userEvent: 'input' });
    view.focus();
    return true;
}

// "[[" at the cursor (around a selection: that text becomes the search) and the suggestions open.
function wikiLink(view) {
    const { from, to } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to);
    view.dispatch({ changes: { from, to, insert: `[[${text}` }, selection: { anchor: from + 2 + text.length }, userEvent: 'input' });
    view.focus();
    startCompletion(view);
    return true;
}

// Toggle a prefix ("## ", "- ", "> ") on every line the selection touches.
function linePrefix(view, prefix) {
    const { state } = view;
    const starts = new Map();
    for (const r of state.selection.ranges) {
        for (let pos = r.from; pos <= r.to;) {
            const line = state.doc.lineAt(pos);
            starts.set(line.from, line);
            pos = line.to + 1;
        }
    }
    const lines = [...starts.values()];
    const allHave = lines.every((l) => l.text.startsWith(prefix));
    view.dispatch({
        changes: lines.map((l) => (allHave ? { from: l.from, to: l.from + prefix.length } : { from: l.from, insert: prefix })),
        userEvent: 'input',
    });
    view.focus();
    return true;
}

const shortcuts = [
    { key: 'Mod-b', run: (v) => wrap(v, '**') },
    { key: 'Mod-i', run: (v) => wrap(v, '*') },
    { key: 'Mod-k', run: webLink },
];

function button(label, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; // never submits the form
    b.className = 'md-tool';
    b.textContent = label;
    b.title = title;
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the editor's selection
    b.addEventListener('click', onClick);
    return b;
}

// ---------- one textarea → one editor ----------

const nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
const views = new WeakMap(); // textarea → its EditorView

function enhance(textarea) {
    if (textarea.dataset.mdReady) return;
    textarea.dataset.mdReady = '1';

    const wrapper = document.createElement('div');
    wrapper.className = 'md-editor';
    const toolbar = document.createElement('div');
    toolbar.className = 'md-toolbar';
    const editorBox = document.createElement('div');
    const preview = document.createElement('div');
    preview.className = 'md-preview rich-text';
    preview.hidden = true;
    wrapper.append(toolbar, editorBox, preview);

    let syncing = false;
    const view = new EditorView({
        parent: editorBox,
        state: EditorState.create({
            doc: nativeValue.get.call(textarea),
            extensions: [
                history(),
                drawSelection(),
                keymap.of([...shortcuts, ...defaultKeymap, ...historyKeymap]),
                new LanguageSupport(markdownLanguage),
                syntaxHighlighting(liveStyle),
                EditorView.lineWrapping,
                autocompletion({ override: [linkCompletions], icons: false }),
                wikiLinks,
                theme,
                placeholder(textarea.placeholder || ''),
                EditorView.contentAttributes.of({ 'aria-label': textarea.getAttribute('aria-label') || textarea.name || 'Text', spellcheck: 'true', lang: 'de' }),
                EditorView.updateListener.of((u) => {
                    if (!u.docChanged || syncing) return;
                    nativeValue.set.call(textarea, u.state.doc.toString());
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }),
            ],
        }),
    });

    views.set(textarea, view);

    // Text set from outside (the admin filling the form) goes into the editor.
    const show = (text) => {
        if (text === view.state.doc.toString()) return;
        syncing = true;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
        syncing = false;
        if (!preview.hidden) togglePreview();
    };
    Object.defineProperty(textarea, 'value', {
        configurable: true,
        get() { return nativeValue.get.call(this); },
        set(v) { nativeValue.set.call(this, v); show(String(v ?? '')); },
    });
    // form.reset() restores the textarea without its value setter: read it back once the reset is done
    textarea.form?.addEventListener('reset', () => setTimeout(() => show(nativeValue.get.call(textarea)), 0));
    if (textarea.rows && textarea.rows < 3) wrapper.style.setProperty('--md-min-height', '4.5rem');

    const togglePreview = () => {
        if (!preview.hidden) {
            preview.hidden = true;
            editorBox.hidden = false;
            previewButton.textContent = 'Preview';
            view.focus();
            return;
        }
        preview.style.minHeight = `${view.dom.offsetHeight}px`;
        preview.innerHTML = window.RichText
            ? window.RichText.render(view.state.doc.toString(), { resolve }) || '<p class="md-empty">(leer)</p>'
            : '<p class="md-empty">Preview not available</p>';
        preview.hidden = false;
        editorBox.hidden = true;
        previewButton.textContent = 'Edit';
    };
    const previewButton = button('Preview', 'So sieht es auf der Karte aus', togglePreview);

    toolbar.append(
        button('B', 'Fett (Ctrl/⌘+B)', () => wrap(view, '**')),
        button('I', 'Kursiv (Ctrl/⌘+I)', () => wrap(view, '*')),
        button('[[ ]]', 'Link zu einem Charakter oder Ort — oder einfach [[ tippen', () => wikiLink(view)),
        button('Web', 'Weblink (Ctrl/⌘+K)', () => webLink(view)),
        button('H', 'Überschrift', () => linePrefix(view, '## ')),
        button('• Liste', 'Aufzählung', () => linePrefix(view, '- ')),
        button('❝', 'Zitat', () => linePrefix(view, '> ')),
        Object.assign(document.createElement('span'), { className: 'md-spacer' }),
        previewButton,
    );
    toolbar.children[0].style.fontWeight = '700';
    toolbar.children[1].style.fontStyle = 'italic';

    textarea.hidden = true;
    textarea.after(wrapper);
}

function enhanceAll(root = document) {
    root.querySelectorAll('textarea[data-md]').forEach(enhance);
}

// Descriptions shown in the admin's lists and detail views, rendered like on the map.
window.renderRichText = (text) => (window.RichText ? window.RichText.render(text, { resolve }) : String(text ?? ''));
// [[links]] there point nowhere in the admin: no jump to the top of the page
document.addEventListener('click', (e) => { if (e.target.closest?.('a.wiki-link')) e.preventDefault(); });

window.AdenaiEditor = { enhance, enhanceAll, resolve, viewOf: (textarea) => views.get(textarea) };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhanceAll());
else enhanceAll();
