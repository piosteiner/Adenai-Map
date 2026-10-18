// link-rename.js - Keep [[links]] in descriptions working when a character or location is renamed.
// Links name their target (src/utils/rich-text.js): [[Mae]] or [[Mae|die Prinzessin]]. A rename rewrites every link to
// the old name, in location descriptions and in character descriptions and notes; the link text after "|" is kept.

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const WIKI = /\[\[([^\[\]|\n]+?)(\|[^\[\]\n]+?)?\]\]/g;

// The text with links to oldName pointing to newName, or the same string when it has none.
function renameInText(text, oldName, newName) {
    if (!text || fold(oldName) === fold(newName) && oldName === newName) return text;
    const key = fold(oldName);
    return String(text).replace(WIKI, (match, target, label = '') => (fold(target) === key ? `[[${newName}${label}]]` : match));
}

// Rewrites in place; returns how many entries changed.
function renameInLocations(geojson, oldName, newName) {
    let changed = 0;
    for (const f of geojson.features || []) {
        const before = f.properties?.description;
        const after = renameInText(before, oldName, newName);
        if (after !== before) { f.properties.description = after; changed++; }
    }
    return changed;
}

// locationRefs: the renamed thing is a location — characters also name it in placeOfOrigin, currentLocation.location,
// the old field location and in each movement's location.
function renameInCharacters(data, oldName, newName, { locationRefs = false } = {}) {
    let changed = 0;
    const key = fold(oldName);
    const same = (v) => typeof v === 'string' && fold(v) === key;
    for (const c of data.characters || []) {
        let touched = false;
        for (const field of ['description', 'notes']) {
            const after = renameInText(c[field], oldName, newName);
            if (after !== c[field]) { c[field] = after; touched = true; }
        }
        if (locationRefs) {
            if (same(c.placeOfOrigin)) { c.placeOfOrigin = newName; touched = true; }
            if (same(c.location)) { c.location = newName; touched = true; }
            if (c.currentLocation && same(c.currentLocation.location)) { c.currentLocation.location = newName; touched = true; }
            for (const m of c.movementHistory || []) if (same(m.location)) { m.location = newName; touched = true; }
        }
        if (touched) changed++;
    }
    return changed;
}

function renameInTerms(data, oldName, newName) {
    let changed = 0;
    for (const t of data.terms || []) {
        const after = renameInText(t.description, oldName, newName);
        if (after !== t.description) { t.description = after; changed++; }
    }
    return changed;
}

const FILES = {
    location: { path: 'public/data/places.geojson', rename: renameInLocations, label: 'location' },
    character: { path: 'public/data/characters.json', rename: renameInCharacters, label: 'character' },
    term: { path: 'public/data/glossary.json', rename: renameInTerms, label: 'glossary term' },
};

// Rewrites the links in one of the data files as its own commit. Returns the number of entries changed.
// locationRefs: a location was renamed — characters also name it in their origin, current location and movements.
async function renameInRepoFile(octokit, owner, repo, which, oldName, newName, user, { locationRefs = false } = {}) {
    const { path, rename, label } = FILES[which];
    let file;
    try {
        ({ data: file } = await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' }));
    } catch (err) {
        if (err.status === 404) return 0; // e.g. no glossary yet
        throw err;
    }
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString());
    const changed = rename(content, oldName, newName, { locationRefs });
    if (!changed) return 0;
    content.lastUpdated = new Date().toISOString();
    await octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path, sha: file.sha,
        message: locationRefs
            ? `Rename location in characters: ${oldName} → ${newName} (links, origin, current location, movements) in ${changed} character${changed === 1 ? '' : 's'} (by ${user})`
            : `Update links: [[${oldName}]] → [[${newName}]] in ${changed} ${label}${changed === 1 ? '' : 's'} (by ${user})`,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    });
    return changed;
}

// After a route has saved its own file (with the links in it already renamed): the links in every other data file
// and in the session minutes. kind: what was renamed — 'location', 'character' or 'term'.
// → { counts: { locations, characters, terms, protocols }, warnings: [] } (a failure in one place doesn't stop the rest)
async function renameElsewhere(octokit, owner, repo, kind, oldName, newName, user) {
    const counts = {};
    const warnings = [];
    for (const which of Object.keys(FILES)) {
        if (which === kind) continue;
        const key = { location: 'locations', character: 'characters', term: 'terms' }[which];
        try {
            counts[key] = await renameInRepoFile(octokit, owner, repo, which, oldName, newName, user, { locationRefs: kind === 'location' && which === 'character' });
        } catch (err) {
            warnings.push(`${FILES[which].label}s: ${err.message}`);
        }
    }
    try {
        counts.protocols = await require('./protocol-store').renameLinks(oldName, newName, user);
    } catch (err) {
        warnings.push(`session minutes: ${err.message}`);
    }
    return { counts, warnings };
}

module.exports = { renameInText, renameInLocations, renameInCharacters, renameInTerms, renameInRepoFile, renameElsewhere };
