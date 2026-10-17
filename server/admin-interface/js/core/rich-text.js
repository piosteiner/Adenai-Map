// rich-text.js - Descriptions and notes as light Markdown with Obsidian-style links
//
//   [[Mae]]                 link to a character or location by name (case does not matter)
//   [[Tangoa|die Stadt]]    same, with its own link text
//   **fett**  *kursiv*  ~~durchgestrichen~~  [Text](https://…)
//   "## " heading, "- " list, "> " quote at the start of a line; blank line = new paragraph
//
// All other HTML is escaped, so text from the CMS can't inject markup. Used by the map (src/) and, as a copy made by
// the editor build (server/editor-src), by the admin interface: edit this file, then run `npm run build` there.
// RichText.render(text, { resolve }) → HTML. resolve(name) returns { kind: 'character'|'location', name } or null;
// without one, RichText.setResolver() sets the default. Clicks on links are the page's business (class "wiki-link").
(function (root) {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

    const WIKI = /\[\[([^\[\]|\n]+?)(?:\|([^\[\]\n]+?))?\]\]/g;
    const MDLINK = /\[([^\[\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

    let defaultResolver = () => null;

    // Links first, as placeholders (so **[[Mae]]** works), then escaping and emphasis, then the links back in.
    function inline(text, resolve) {
        const parts = [];
        const hold = (html) => `\u0000${parts.push(html) - 1}\u0000`;
        let s = String(text)
            .replace(WIKI, (_, target, label) => {
                const name = target.trim();
                const shown = escape((label || target).trim());
                const hit = resolve(name);
                if (!hit) return hold(`<span class="wiki-link missing" title="Nicht gefunden: ${escape(name)}">${shown}</span>`);
                return hold(`<a href="#" class="wiki-link wiki-${hit.kind}" data-kind="${hit.kind}" data-name="${escape(hit.name)}">${shown}</a>`);
            })
            .replace(MDLINK, (_, label, url) => hold(`<a href="${escape(url)}" target="_blank" rel="noopener">${escape(label)}</a>`));
        s = escape(s)
            .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/~~(?=\S)([^~]*?\S)~~/g, '<del>$1</del>');
        return s.replace(/\u0000(\d+)\u0000/g, (_, i) => parts[Number(i)]);
    }

    function render(text, { resolve = defaultResolver } = {}) {
        if (!text) return '';
        const out = [];
        let kind = null; // the open block: 'p', 'ul' or 'quote'
        let lines = [];
        const flush = () => {
            const html = lines.map((l) => inline(l, resolve));
            if (kind === 'p') out.push(`<p>${html.join('<br>')}</p>`);
            if (kind === 'ul') out.push(`<ul>${html.map((h) => `<li>${h}</li>`).join('')}</ul>`);
            if (kind === 'quote') out.push(`<blockquote>${html.join('<br>')}</blockquote>`);
            kind = null;
            lines = [];
        };
        const add = (k, line) => { if (kind !== k) flush(); kind = k; lines.push(line); };
        for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
            const line = raw.trimEnd();
            let m;
            if (!line.trim()) flush();
            else if ((m = /^#{1,6}\s+(.*)$/.exec(line))) { flush(); out.push(`<h4>${inline(m[1], resolve)}</h4>`); }
            else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) add('ul', m[1]);
            else if ((m = /^>\s?(.*)$/.exec(line))) add('quote', m[1]);
            else add('p', line);
        }
        flush();
        return out.join('');
    }

    // Names of all links in a text, e.g. to find what links where.
    function links(text) {
        return [...String(text || '').matchAll(WIKI)].map((m) => m[1].trim());
    }

    const RichText = { render, links, escape, setResolver(fn) { defaultResolver = fn || (() => null); } };
    if (typeof module !== 'undefined' && module.exports) module.exports = RichText;
    root.RichText = RichText;
})(typeof window !== 'undefined' ? window : globalThis);
