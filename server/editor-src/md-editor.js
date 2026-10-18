// Markdown editor for the Adenai CMS and the map's minutes (bundled into the CMS by `npm run build:cms` and for the
// map by `npm run build:map` → src/vendor/md-editor.js).
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
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import * as AdenaiLive from './live-client';

// ---------- what [[links]] can point to: the admin's loaded characters and locations ----------

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function entries() {
    const chars = (window.adminCharacters?.getCharacters?.() || []).map((c) => ({
        kind: 'character', name: c.name, detail: ['NPC', c.title].filter(Boolean).join(' · '),
    }));
    const locs = (window.adminLocations?.getLocations?.() || []).map((l) => ({
        kind: 'location', name: l.properties?.name, detail: ['Ort', l.properties?.region].filter(Boolean).join(' · '),
    }));
    // glossary terms, and each alias as its own suggestion that links to the term: [[Term|alias]]
    const terms = (window.adminGlossary?.getTerms?.() || []).flatMap((t) => [
        { kind: 'term', name: t.name, detail: t.pending ? `⏳ Vorschlag · ${t.kindLabel || ''}` : ['Glossar', t.category].filter(Boolean).join(' · ') },
        ...(t.aliases || []).map((a) => ({ kind: 'term', name: t.name, alias: a, detail: `→ ${t.name}` })),
    ]);
    return [...chars, ...locs, ...terms].filter((e) => e.name);
}

export function resolve(name) {
    const key = fold(name);
    const hit = entries().find((e) => fold(e.alias || e.name) === key);
    return hit ? { kind: hit.kind, name: hit.name } : null;
}

async function linkCompletions(context) {
    const m = context.matchBefore(/\[\[[^\[\]|\n]*$/);
    if (!m) return null;
    const q = fold(m.text.slice(2));
    const all = entries();
    // the site's one search (src/utils/search.js): exact, then starts with, then a word starts with … — and typos
    // ("[[glesbrug" → Glesburg) when nothing matches as typed. Without it (it is loaded by the pages): the simple ranking.
    const S = window.AdenaiSearch;
    const ranked = !q
        ? all.slice().sort((a, b) => (a.alias || a.name).localeCompare(b.alias || b.name, 'de')).slice(0, 30).map((e) => ({ e }))
        : S
            ? S.rank(all, m.text.slice(2), (e) => ({ name: e.alias || e.name, fields: [{ label: '', text: e.detail, weight: 0.5 }] }), { limit: 30 }).map((r) => ({ e: r.item }))
            : all.map((e) => {
                const n = fold(e.alias || e.name);
                const score = n.startsWith(q) ? 0 : n.split(/[\s\-']+/).some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : -1;
                return { e, score };
            }).filter((x) => x.score >= 0).sort((a, b) => a.score - b.score || (a.e.alias || a.e.name).localeCompare(b.e.alias || b.e.name, 'de')).slice(0, 30);
    const after = context.state.sliceDoc(context.pos, context.pos + 2); // "]]" already typed after the cursor?
    // from a selection (selectionLink): the text as written stays the link's text
    const label = linkLabel && linkLabel.from === m.from && linkLabel.text === m.text.slice(2) ? linkLabel.text : null;
    if (!label) linkLabel = null;
    const target = (e) => {
        const shown = label ?? e.alias;
        return shown && shown !== e.name ? `[[${e.name}|${shown}]]` : `[[${e.name}]]`;
    };
    const options = ranked.map(({ e }) => ({ label: e.alias || e.name, detail: e.detail, type: 'text', apply: target(e) }));
    // a name nothing has yet: offer to create an entry (only where the page provides window.AdenaiEditor.onCreateEntry —
    // on the map: a proposal the DM confirms). The link goes in once it exists.
    const typed = m.text.slice(2).trim();
    const create = window.AdenaiEditor?.onCreateEntry;
    if (create && typed.length >= 2 && !entries().some((e) => fold(e.alias || e.name) === fold(typed))) {
        options.push({
            label: `＋ „${typed}“ neu anlegen…`, detail: 'Vorschlag', type: 'text', boost: -99,
            apply: (view, completion, from, to) => {
                Promise.resolve(create(typed)).then((name) => {
                    if (!name) return;
                    // the text may have moved meanwhile (others typing): put the link where "[[typed" is now
                    const doc = view.state.doc.toString();
                    const at = doc.lastIndexOf(`[[${m.text.slice(2)}`, Math.max(from, view.state.selection.main.head));
                    const start = at >= 0 ? at : view.state.selection.main.head;
                    const end = at >= 0 ? start + m.text.length + (doc.slice(start + m.text.length, start + m.text.length + 2) === ']]' ? 2 : 0) : start;
                    view.dispatch({ changes: { from: start, to: end, insert: `[[${name}]]` }, selection: { anchor: start + name.length + 4 } });
                    view.focus();
                });
            },
        });
    }
    return {
        from: m.from,
        to: after === ']]' ? context.pos + 2 : context.pos,
        filter: false, // ranked above; the typed "[[ako" wouldn't match "Akónetchie" by CodeMirror's own filter
        options,
    };
}

// [[links]] coloured in the editor; a name that matches nothing (yet) is marked
const wikiDeco = new MatchDecorator({
    regexp: /\[\[([^\[\]|\n]+?)(?:\|[^\[\]\n]+?)?\]\]/g,
    decoration: (m) => Decoration.mark({ class: resolve(m[1]) ? 'cm-wikilink' : 'cm-wikilink cm-wikilink-missing' }),
});
const underlineDeco = new MatchDecorator({ regexp: /\+\+(?=\S)[^+\n]*?\S\+\+/g, decoration: () => Decoration.mark({ class: 'cm-underline' }) });
const underlines = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = underlineDeco.createDeco(view); }
    update(u) { this.decorations = underlineDeco.updateDeco(u, this.decorations); }
}, { decorations: (v) => v.decorations });

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
    '.cm-underline': { textDecoration: 'underline' },
    // other people's cursors in live mode (y-codemirror.next)
    '.cm-ySelectionInfo': { fontFamily: 'system-ui, sans-serif', fontSize: '11px', padding: '1px 4px', borderRadius: '3px', opacity: '1', top: '-1.25em' },
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

// "[[" at the cursor and the suggestions open — or, around a selection, the selection becomes a link (selectionLink).
function wikiLink(view) {
    if (selectionLink(view)) return true;
    const { from } = view.state.selection.main;
    view.dispatch({ changes: { from, to: from, insert: '[[' }, selection: { anchor: from + 2 }, userEvent: 'input' });
    view.focus();
    startCompletion(view);
    return true;
}

// A word written without a link is selected and "[" typed (or the [[ ]] button pressed): it becomes a link.
//   the text is an entry's name or alias      → [[Name]] / [[Name|text as written]] — done
//   otherwise                                 → [[text]] and the suggestions open, searched for the text; picking one
//                                               keeps the text as written: "Aykans" → [[Aykan|Aykans]]
// The selection's own spaces stay outside; nothing happens for a selection over several lines or with brackets.
let linkLabel = null; // { from, text } while the suggestions for a selection are open
function selectionLink(view) {
    const sel = view.state.selection.main;
    if (sel.empty) return false;
    let { from, to } = sel;
    const raw = view.state.sliceDoc(from, to);
    if (/[\n\[\]|]/.test(raw)) return false;
    from += raw.length - raw.trimStart().length;
    to -= raw.length - raw.trimEnd().length;
    const text = view.state.sliceDoc(from, to);
    if (!text) return false;
    const hit = entries().find((e) => fold(e.alias || e.name) === fold(text));
    if (hit) {
        const link = hit.name === text ? `[[${hit.name}]]` : `[[${hit.name}|${text}]]`;
        view.dispatch({ changes: { from, to, insert: link }, selection: { anchor: from + link.length }, userEvent: 'input' });
        view.focus();
        return true;
    }
    view.dispatch({ changes: { from, to, insert: `[[${text}]]` }, selection: { anchor: from + 2 + text.length }, userEvent: 'input' });
    linkLabel = { from, text };
    view.focus();
    startCompletion(view);
    return true;
}
// "[" typed over a selection — whatever the keyboard (on Swiss/German layouts it is AltGr + ü / AltGr + 8)
const bracketOverSelection = EditorView.inputHandler.of((view, from, to, text) => text === '[' && from !== to && selectionLink(view));

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
    // Markdown has no underline; ++…++ is the usual extension (markdown-it-ins). Ctrl+U would otherwise open the
    // browser's page source.
    { key: 'Mod-u', run: (v) => wrap(v, '++'), preventDefault: true },
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

// collab: { text: Y.Text, awareness, undoManager } (live-client.js room) — the editor then edits the shared text:
// other people's cursors and selections show with their names, and undo only undoes one's own typing.
function enhance(textarea, collab = null) {
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
            doc: collab ? collab.text.toString() : nativeValue.get.call(textarea),
            extensions: [
                collab ? yCollab(collab.text, collab.awareness, { undoManager: collab.undoManager }) : history(),
                drawSelection(),
                keymap.of([...shortcuts, ...defaultKeymap, ...(collab ? yUndoManagerKeymap : historyKeymap)]),
                new LanguageSupport(markdownLanguage),
                syntaxHighlighting(liveStyle),
                EditorView.lineWrapping,
                autocompletion({ override: [linkCompletions], icons: false }),
                bracketOverSelection,
                wikiLinks,
                underlines,
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
        button('U', 'Unterstrichen (Ctrl/⌘+U)', () => wrap(view, '++')),
        button('[[ ]]', 'Link zu einem Eintrag — oder [[ tippen, oder ein Wort markieren und [ tippen', () => wikiLink(view)),
        button('Web', 'Weblink (Ctrl/⌘+K)', () => webLink(view)),
        button('H', 'Überschrift', () => linePrefix(view, '## ')),
        button('• Liste', 'Aufzählung', () => linePrefix(view, '- ')),
        button('❝', 'Zitat', () => linePrefix(view, '> ')),
        Object.assign(document.createElement('span'), { className: 'md-spacer' }),
        previewButton,
    );
    toolbar.children[0].style.fontWeight = '700';
    toolbar.children[1].style.fontStyle = 'italic';
    toolbar.children[2].style.textDecoration = 'underline';

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

window.AdenaiLive = AdenaiLive;
window.AdenaiEditor = { ...(window.AdenaiEditor || {}), enhance, enhanceAll, resolve, viewOf: (textarea) => views.get(textarea) };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhanceAll());
else enhanceAll();
