// The picture addresses in the map's data moved to the Grimoire's library (2026-11-20): every
// "https://adenai-admin.piogino.ch/media/<file>" in characters.json, places.geojson and glossary.json becomes the
// Grimoire's address of the same file. Run by the CMS at start; once done there is nothing left to change and nothing
// is written. (The old addresses would still work — /media leads to the Grimoire — but each would cost a detour.)
const github = require('./github');
const { GRIMOIRE_FILES } = require('./media-access');

const FILES = ['public/data/characters.json', 'public/data/places.geojson', 'public/data/glossary.json'];
const OLD = 'https://adenai-admin.piogino.ch/media/';

async function moveMediaAddresses(owner, repo) {
    let total = 0;
    for (const path of FILES) {
        const { data } = await github.octokit.rest.repos.getContent({ owner, repo, path });
        const text = Buffer.from(data.content, 'base64').toString();
        const n = text.split(OLD).length - 1;
        if (!n) continue;
        await github.octokit.rest.repos.createOrUpdateFileContents({
            owner, repo, path, sha: data.sha,
            message: `Pictures: ${n} addresses to the Grimoire's library`,
            content: Buffer.from(text.split(OLD).join(GRIMOIRE_FILES)).toString('base64'),
        });
        total += n;
        console.log(`media: ${n} picture addresses in ${path} now the Grimoire's`);
    }
    return total;
}

module.exports = { moveMediaAddresses };
