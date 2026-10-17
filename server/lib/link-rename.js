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

function renameInCharacters(data, oldName, newName) {
    let changed = 0;
    for (const c of data.characters || []) {
        let touched = false;
        for (const field of ['description', 'notes']) {
            const after = renameInText(c[field], oldName, newName);
            if (after !== c[field]) { c[field] = after; touched = true; }
        }
        if (touched) changed++;
    }
    return changed;
}

const FILES = {
    location: { path: 'public/data/places.geojson', rename: renameInLocations },
    character: { path: 'public/data/characters.json', rename: renameInCharacters },
};

// Rewrites the links in the *other* data file (the one the route doesn't save itself) as its own commit.
// which: 'location' (places.geojson) or 'character' (characters.json). Returns the number of entries changed.
async function renameInRepoFile(octokit, owner, repo, which, oldName, newName, user) {
    const { path, rename } = FILES[which];
    const { data: file } = await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' });
    const content = JSON.parse(Buffer.from(file.content, 'base64').toString());
    const changed = rename(content, oldName, newName);
    if (!changed) return 0;
    if (which === 'character') content.lastUpdated = new Date().toISOString();
    await octokit.rest.repos.createOrUpdateFileContents({
        owner, repo, path, sha: file.sha,
        message: `Update links: [[${oldName}]] → [[${newName}]] in ${changed} ${which === 'location' ? 'location' : 'character'}${changed === 1 ? '' : 's'} (by ${user})`,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    });
    return changed;
}

module.exports = { renameInText, renameInLocations, renameInCharacters, renameInRepoFile };
