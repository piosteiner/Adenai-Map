// rich-text.js - Descriptions and notes as light Markdown with Obsidian-style links
//
//   [[Mae]]                 link to a character or location by name (case does not matter)
//   [[Tangoa|die Stadt]]    same, with its own link text
//   **fett**  *kursiv*  ++unterstrichen++  ~~durchgestrichen~~  ==markiert==  ||Spoiler||  [Text](https://…)
//   :catJAM:                an emote (RichText.setEmotes; 7TV and our own, set in the CMS) — an unknown name stays text
//   At the start of a line: "# " heading ("## ", "### " smaller), "- " list, "1. " numbered list (2 spaces deeper =
//   nested), "- [ ] " / "- [x] " open / done item, "> " quote, "---" divider, "| a | b |" table (a "|---|" line
//   under the first row makes it the header). Blank line = new paragraph.
//   Boxes (as in Obsidian): "> [!quote] Abu" and the lines after it with "> " — quote, loot, quest, info, warning,
//   note, secret; the words after the type are the box's title (default: Zitat, Beute, Auftrag …).
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
    // boxes: type → icon, default title
    const CALLOUTS = {
        quote: ['💬', 'Zitat'], loot: ['💰', 'Beute'], quest: ['📜', 'Auftrag'], info: ['ℹ️', 'Info'],
        warning: ['⚠️', 'Achtung'], note: ['📝', 'Notiz'], secret: ['🤫', 'Geheim'],
    };
    const ALIASES = { zitat: 'quote', beute: 'loot', auftrag: 'quest', hinweis: 'info', tip: 'info', achtung: 'warning', danger: 'warning', notiz: 'note', geheim: 'secret', spoiler: 'secret' };

    let defaultResolver = () => null;
    let emotes = {};          // name → { url, w, h }
    let emotesLower = new Map(); // lower-case name → name, for :catjam: when only catJAM exists

    // ":name:" → the emote's image; the closing colon is only taken by an emote, so ":nix::catJAM:" still finds catJAM.
    // Not right after a letter or digit: "2:3:1" stays text even with an emote "3" (7TV's ":3", written :3:)
    function emote(name) {
        const key = emotes[name] ? name : emotesLower.get(name.toLowerCase());
        const e = key && emotes[key];
        if (!e) return null;
        return `<img class="emote" src="${escape(e.url)}" alt=":${escape(key)}:" loading="lazy" decoding="async" draggable="false" style="height:1.75em;width:auto;vertical-align:middle;margin:-0.3em 0;cursor:default">`;
    }

    // Links first, as placeholders (so **[[Mae]]** works), then escaping and emphasis, then the links back in.
    // A backslash keeps the next character literal, as in Markdown: Arbeiter\*innen, 1\. Sitzung, \[[kein Link]], \:kein Emote:.
    function inline(text, resolve) {
        const parts = [];
        const hold = (html) => `\u0000${parts.push(html) - 1}\u0000`;
        let s = String(text)
            .replace(/\\([\\`*_{}\[\]()#+\-.!>~|&=:])/g, (_, c) => hold(escape(c)))
            .replace(WIKI, (_, target, label) => {
                const name = target.trim();
                const shown = escape((label || target).trim());
                const hit = resolve(name);
                if (!hit) return hold(`<span class="wiki-link missing" title="Nicht gefunden: ${escape(name)}">${shown}</span>`);
                return hold(`<a href="#" class="wiki-link wiki-${hit.kind}" data-kind="${hit.kind}" data-name="${escape(hit.name)}">${shown}</a>`);
            })
            .replace(MDLINK, (_, label, url) => hold(`<a href="${escape(url)}" target="_blank" rel="noopener">${escape(label)}</a>`))
            .replace(/(?<![\p{L}\p{N}]):([^\s:\u0000]{1,64})(?=:)/gu, (m, name) => { const img = emote(name); return img ? `${hold(img)}\u0002` : m; })
            .replace(/\u0002:/g, '');
        s = escape(s)
            .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/~~(?=\S)([^~]*?\S)~~/g, '<del>$1</del>')
            .replace(/\+\+(?=\S)([^+]*?\S)\+\+/g, '<u>$1</u>') // Markdown has no underline: ++…++ (as markdown-it-ins)
            .replace(/==(?=\S)([^=]*?\S)==/g, '<mark>$1</mark>')
            // a spoiler: shown once clicked (focused) — CSS .spoiler:focus, no script needed
            .replace(/\|\|(?=\S)([^|]*?\S)\|\|/g, '<span class="spoiler" tabindex="0" title="Spoiler — anklicken zum Anzeigen">$1</span>');
        return s.replace(/\u0000(\d+)\u0000/g, (_, i) => parts[Number(i)]);
    }

    function render(text, { resolve = defaultResolver } = {}) {
        if (!text) return '';
        const out = [];
        let kind = null; // the open block: 'p', 'list', 'quote' or 'table'
        let lines = [];
        const flush = () => {
            if (kind === 'p') out.push(`<p>${lines.map((l) => inline(l, resolve)).join('<br>')}</p>`);
            if (kind === 'list') out.push(nestedList(lines.map((l) => ({ ...l, html: item(l.text, resolve) }))));
            if (kind === 'quote') out.push(quote(lines, resolve));
            if (kind === 'table') out.push(table(lines, resolve));
            kind = null;
            lines = [];
        };
        const add = (k, line) => { if (kind !== k) flush(); kind = k; lines.push(line); };
        for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
            const line = raw.trimEnd();
            let m;
            if (!line.trim()) flush();
            else if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); out.push('<hr>'); }
            else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
                flush();
                const tag = ['h4', 'h5', 'h6'][Math.min(m[1].length, 3) - 1]; // "#" as before (h4), "##" and "###" smaller
                out.push(`<${tag}>${inline(m[2], resolve)}</${tag}>`);
            }
            else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) add('list', { level: depthOf(m[1]), tag: 'ul', text: m[2] });
            else if ((m = /^(\s*)(\d{1,3})[.)]\s+(.*)$/.exec(line))) add('list', { level: depthOf(m[1]), tag: 'ol', start: Number(m[2]), text: m[3] });
            else if ((m = /^>\s?(.*)$/.exec(line))) add('quote', m[1]);
            else if (/^\s*\|.*\|\s*$/.test(line)) add('table', line.trim());
            else add('p', line);
        }
        flush();
        return out.join('');
    }

    const depthOf = (indent) => Math.floor(indent.replace(/\t/g, '  ').length / 2);

    // a list item, with "[ ]" / "[x]" at its start as a checkbox (open / done)
    function item(text, resolve) {
        const m = /^\[([ xX])\]\s+(.*)$/.exec(text);
        if (!m) return inline(text, resolve);
        const done = m[1] !== ' ';
        return `<span class="task${done ? ' done' : ''}"><input type="checkbox" disabled${done ? ' checked' : ''} aria-label="${done ? 'erledigt' : 'offen'}"> <span>${inline(m[2], resolve)}</span></span>`;
    }

    // "> [!loot] Title" → a box; any other quote stays a quote
    function quote(lines, resolve) {
        const m = /^\[!([a-zA-ZäöüÄÖÜ]+)\][+-]?\s*(.*)$/.exec(lines[0] || '');
        if (!m) return `<blockquote>${lines.map((l) => inline(l, resolve)).join('<br>')}</blockquote>`;
        const type = ALIASES[m[1].toLowerCase()] || m[1].toLowerCase();
        const [icon, label] = CALLOUTS[type] || ['📌', m[1]];
        const body = lines.slice(1).join('\n');
        return `<div class="callout callout-${escape(CALLOUTS[type] ? type : 'other')}"><div class="callout-title"><span aria-hidden="true">${icon}</span> ${inline(m[2] || label, resolve)}</div>`
            + `${body.trim() ? `<div class="callout-body">${render(body, { resolve })}</div>` : ''}</div>`;
    }

    // "| a | b |" rows; a "|---|---|" row after the first makes it the header
    function table(rows, resolve) {
        // cells split at "|" — not at the one inside [[Name|text]] or a ||spoiler||
        const cells = (r) => {
            const kept = [];
            const safe = r.replace(/\[\[[^\]\n]*\]\]|\|\|[^|\n]*\|\|/g, (x) => `\u0001${kept.push(x) - 1}\u0001`);
            return safe.replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\u0001(\d+)\u0001/g, (_, i) => kept[Number(i)]));
        };
        const rule = (r) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(r);
        const head = rows.length > 1 && rule(rows[1]) ? cells(rows[0]) : null;
        const body = (head ? rows.slice(2) : rows).filter((r) => !rule(r)).map(cells);
        const tr = (cs, tag) => `<tr>${cs.map((c) => `<${tag}>${inline(c, resolve)}</${tag}>`).join('')}</tr>`;
        return `<div class="table-wrap"><table>${head ? `<thead>${tr(head, 'th')}</thead>` : ''}<tbody>${body.map((cs) => tr(cs, 'td')).join('')}</tbody></table></div>`;
    }

    // List items with indentation levels (2 spaces per level) → nested <ul> / <ol>; a level can only go one deeper at a
    // time; a level's first item decides whether it is numbered (and where the numbers start)
    function nestedList(items) {
        let html = '';
        const open = []; // the tags of the open levels
        const openList = (it) => (it.tag === 'ol' ? `<ol${it.start && it.start !== 1 ? ` start="${it.start}"` : ''}>` : '<ul>');
        for (const it of items) {
            const level = Math.min(it.level, open.length);
            if (level === open.length) { html += openList(it) + '<li>'; open.push(it.tag); }
            else {
                html += '</li>';
                while (open.length > level + 1) html += `</${open.pop()}></li>`;
                if (open[level] !== it.tag) { html += `</${open.pop()}>${openList(it)}`; open.push(it.tag); } // "- " after "1." at the same depth: a new list
                html += '<li>';
            }
            html += it.html;
        }
        while (open.length) html += `</li></${open.pop()}>`;
        return html;
    }

    // Names of all links in a text, e.g. to find what links where.
    function links(text) {
        return [...String(text || '').matchAll(WIKI)].map((m) => m[1].trim());
    }

    function setEmotes(map) {
        emotes = map || {};
        emotesLower = new Map();
        for (const name of Object.keys(emotes)) if (!emotesLower.has(name.toLowerCase())) emotesLower.set(name.toLowerCase(), name);
    }

    const RichText = { render, links, escape, setResolver(fn) { defaultResolver = fn || (() => null); }, setEmotes };
    if (typeof module !== 'undefined' && module.exports) module.exports = RichText;
    root.RichText = RichText;
})(typeof window !== 'undefined' ? window : globalThis);
