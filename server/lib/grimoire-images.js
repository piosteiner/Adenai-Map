// The pictures live in the Grimoire's image library (grimoire.piogino.ch, src/images.js there) since 2026-11-20 —
// one library for every campaign, the way the names are one list. Adenai keeps its own record of each picture there
// (its media id as ref, its title, caption, category and tags); the credits and the "visible to everyone" mark belong
// to the picture. This is the CMS's client for it, with Adenai's project key (GRIMOIRE_URL, GRIMOIRE_KEY in .env).
// public/data/media-library.json stays as Adenai's copy of its set, in the shape the map and the CMS read
// (routes/media.js keeps it in step: mirrorEntry).
const BASE = (process.env.GRIMOIRE_URL || 'http://127.0.0.1:3005').replace(/\/+$/, '');
const PROJECT = 'adenai';

async function call(method, path, { body, form } = {}) {
    if (!process.env.GRIMOIRE_KEY) throw Object.assign(new Error('The Grimoire key is not set on the server (GRIMOIRE_KEY)'), { status: 503 });
    const r = await fetch(`${BASE}/api/projects/${PROJECT}/images${path}`, {
        method,
        headers: { Authorization: `Bearer ${process.env.GRIMOIRE_KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: form || (body ? JSON.stringify(body) : undefined),
        signal: AbortSignal.timeout(form ? 120000 : 15000),
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw Object.assign(new Error(data?.error || `The Grimoire answered ${r.status}`), { status: r.status });
    return data;
}

const list = async () => (await call('GET', '')).images;
const update = async (gid, patch) => (await call('PUT', `/${encodeURIComponent(gid)}`, { body: patch })).image;
const remove = (gid) => call('DELETE', `/${encodeURIComponent(gid)}?files=1`);
// one file (bytes) → the new picture in Adenai's set
async function upload(buffer, { filename, mimetype, credits, open, title, caption, category, tags }) {
    const form = new FormData();
    form.append('images', new Blob([buffer], { type: mimetype }), filename);
    for (const [k, v] of Object.entries({ credits, open: String(!!open), title, caption, category, tags: Array.isArray(tags) ? tags.join(',') : tags })) if (v != null) form.append(k, v);
    return (await call('POST', '/upload', { form })).images[0];
}

// a picture of the Grimoire (with Adenai's record) → an entry of media-library.json
const SIZE_KEYS = ['thumbnail', 'small', 'medium', 'large', 'original'];
function mirrorEntry(g) {
    const u = g.use || {};
    return {
        id: u.ref,
        grimoireId: g.id,
        category: u.category || g.category || 'general',
        title: u.title || '',
        caption: u.caption || '',
        credits: g.credits,
        open: g.open,
        tags: u.tags || [],
        uploadDate: g.createdAt,
        lastModified: [u.updatedAt, g.updatedAt].filter(Boolean).sort().pop(),
        sizes: Object.fromEntries(SIZE_KEYS.filter((k) => g.sizes[k]).map((k) => [k, { filename: g.sizes[k].file, url: g.sizes[k].url, width: g.sizes[k].width, height: g.sizes[k].height }])),
        fileSize: g.fileSize,
        mimeType: g.mime,
    };
}

module.exports = { list, update, remove, upload, mirrorEntry, BASE };
