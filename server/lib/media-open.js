// Which pictures of the media library everyone may see, without the minutes password (2026-11-20): the owner's own
// drawings and pictures made purely with AI — nobody else's work is in them. A picture carries this as `open: true`
// in media-library.json; the CMS shows it as a tick ("Visible to everyone") and the owner can change it. A new upload
// is ticked when its credits say own work or AI (ownWork); everything that names another artist, a book, an artbook
// or a game stays for the group (lib/media-access.js).
const OWN = /^\s*(myself|me|own (work|drawing)|drawn by (me|myself|pio\b)|ai[ -]generated)\b/i;
// AI work "based on" something: open only when that something is the owner's own or no one's work (a real landscape)
const OTHERS = /design from|artbook|art of|\bfrom\s*["“]|\bart by\b|\bsketch by\b|\bby\s+(?!pio\b)[A-Z]|wizards|wotc|square enix|copy of|pinterest|artstation|https?:\/\//i;
const ownWork = (credits) => OWN.test(credits || '') && !OTHERS.test(credits || '');

// file name → open, for the gate; rebuilt only when the library changes (its sha)
let memo = { sha: null, files: new Set() };
function openFiles(library, sha) {
    if (sha && sha === memo.sha) return memo.files;
    const files = new Set();
    for (const m of Object.values(library.images || {})) {
        if (!m.open) continue;
        for (const z of Object.values(m.sizes || {})) if (z?.filename) files.add(z.filename);
    }
    memo = { sha, files };
    return files;
}

module.exports = { ownWork, openFiles };
