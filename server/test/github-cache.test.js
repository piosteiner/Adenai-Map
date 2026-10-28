// lib/github-cache.js against a GitHub kept in memory: deferred files, one commit for several changes, the journal.
//   npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withFileCache, blobSha, combinedMessage } = require('../lib/github-cache');

const OWNER = 'o', REPO = 'r';
const LIB = 'public/data/media-library.json', REVIEWS = 'public/data/reviews.json', CHARS = 'public/data/characters.json';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const fromB64 = (s) => JSON.parse(Buffer.from(s, 'base64').toString());

// A repository: files (path → base64), commits (message, files), the head; the git calls the cache uses
function fakeGitHub(initial) {
    const state = { files: { ...initial }, commits: [], contentWrites: 0 };
    const sha = (path) => blobSha(Buffer.from(state.files[path], 'base64'));
    const notFound = () => Object.assign(new Error('Not Found'), { status: 404 });
    const octokit = {
        rest: {
            repos: {
                getContent: async ({ path }) => {
                    if (!(path in state.files)) throw notFound();
                    return { status: 200, headers: {}, data: { type: 'file', encoding: 'base64', path, sha: sha(path), content: state.files[path] } };
                },
                createOrUpdateFileContents: async ({ path, content, message, sha: given }) => {
                    if (path in state.files && given !== sha(path)) throw Object.assign(new Error('sha mismatch'), { status: 409 });
                    state.files[path] = content;
                    state.contentWrites += 1;
                    state.commits.push({ message, paths: [path] });
                    return { data: { content: { sha: sha(path) }, commit: { sha: `c${state.commits.length}` } } };
                },
                deleteFile: async () => ({}),
                listCommits: async () => ({ data: [] }),
            },
            git: {
                getRef: async () => ({ data: { object: { sha: `c${state.commits.length}` } } }),
                getCommit: async () => ({ data: { tree: { sha: 'tree' } } }),
                getBlob: async () => { throw new Error('not used'); },
                createBlob: async ({ content }) => { const s = blobSha(Buffer.from(content, 'base64')); state.blobs = { ...state.blobs, [s]: content }; return { data: { sha: s } }; },
                createTree: async ({ tree }) => { state.tree = tree; return { data: { sha: 'newtree' } }; },
                createCommit: async ({ message }) => { state.pendingCommit = { message, tree: state.tree }; return { data: { sha: 'newcommit' } }; },
                updateRef: async () => {
                    const { message, tree } = state.pendingCommit;
                    for (const t of tree) state.files[t.path] = state.blobs[t.sha];
                    state.commits.push({ message, paths: tree.map((t) => t.path) });
                    return {};
                },
            },
        },
    };
    return { octokit, state, sha };
}

const quiet = { log() {}, warn() {}, error() {} };
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'github-pending-'));
const setup = (files, dir = tmpDir()) => {
    const gh = fakeGitHub(files);
    const cache = withFileCache(gh.octokit, quiet, { deferred: [LIB, REVIEWS], journalDir: dir, quietMs: 60000, maxWaitMs: 60000 });
    return { ...gh, cache, dir, repos: gh.octokit.rest.repos };
};
// a route's read-modify-write, as routes/media.js does it
async function edit(repos, path, change, message) {
    const { data } = await repos.getContent({ owner: OWNER, repo: REPO, path });
    const doc = fromB64(data.content);
    change(doc);
    return repos.createOrUpdateFileContents({ owner: OWNER, repo: REPO, path, message, content: b64(doc), sha: data.sha });
}

test('a deferred file: the write is there at once, nothing goes to GitHub until the flush', async () => {
    const { repos, state, cache } = setup({ [LIB]: b64({ images: { a: { tags: [] } } }) });
    const seen = [];
    cache.events.on('changed', (p) => seen.push(p));
    await edit(repos, LIB, (d) => { d.images.a.tags = ['x']; }, 'Update metadata for media a');
    await edit(repos, LIB, (d) => { d.images.a.tags = ['x', 'y']; }, 'Update metadata for media a');
    assert.equal(state.commits.length, 0);
    assert.deepEqual(fromB64((await repos.getContent({ owner: OWNER, repo: REPO, path: LIB })).data.content).images.a.tags, ['x', 'y']);
    assert.deepEqual(seen, [LIB, LIB]);                       // the map hears of both at once
    assert.deepEqual(cache.pending().map((p) => [p.path, p.changes]), [[LIB, 2]]);
    await cache.flush();
    assert.equal(state.commits.length, 1);
    assert.equal(state.commits[0].message, '2 changes from the CMS\n\n- Update metadata for media a (×2)');
    assert.deepEqual(fromB64(state.files[LIB]).images.a.tags, ['x', 'y']);
    assert.deepEqual(cache.pending(), []);
});

test('two deferred files go to GitHub in one commit; other files are written at once as before', async () => {
    const { repos, state, cache } = setup({ [LIB]: b64({ images: {} }), [REVIEWS]: b64({ reviews: [] }), [CHARS]: b64({ characters: [] }) });
    await edit(repos, LIB, (d) => { d.images.b = {}; }, 'Add 1 new media files via CMS');
    await edit(repos, REVIEWS, (d) => { d.reviews.push({ commitSha: 'c1' }); }, 'Update review status');
    await edit(repos, CHARS, (d) => { d.characters.push({ id: 'z' }); }, 'Create character: Z (by gm) - Initial character creation');
    assert.equal(state.contentWrites, 1);                     // only the character, right away
    await cache.flush();
    assert.equal(state.commits.length, 2);
    assert.deepEqual(state.commits[1].paths.sort(), [LIB, REVIEWS]);
    assert.match(state.commits[1].message, /^2 changes from the CMS/);
});

test('a write based on an older version is refused (409), as GitHub does — the routes read again and retry', async () => {
    const { repos } = setup({ [LIB]: b64({ images: {} }) });
    const { data } = await repos.getContent({ owner: OWNER, repo: REPO, path: LIB });
    await edit(repos, LIB, (d) => { d.images.c = {}; }, 'one');
    await assert.rejects(repos.createOrUpdateFileContents({ owner: OWNER, repo: REPO, path: LIB, message: 'two', content: b64({ images: {} }), sha: data.sha }), { status: 409 });
});

test('after a restart the journal brings the waiting changes back, and they are committed', async () => {
    const dir = tmpDir();
    const first = setup({ [LIB]: b64({ images: {} }) }, dir);
    await edit(first.repos, LIB, (d) => { d.images.d = { caption: 'kept' }; }, 'Update metadata for media d');
    // a new process: GitHub still has the old file
    const gh = fakeGitHub(first.state.files);
    const cache = withFileCache(gh.octokit, quiet, { deferred: [LIB, REVIEWS], journalDir: dir, quietMs: 60000, maxWaitMs: 60000 });
    const read = await gh.octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: LIB });
    assert.equal(fromB64(read.data.content).images.d.caption, 'kept');
    await cache.flush();
    assert.equal(fromB64(gh.state.files[LIB]).images.d.caption, 'kept');
    assert.deepEqual(fs.readdirSync(dir), []);                // the journal is emptied
});

test('a file changed on GitHub meanwhile is not overwritten: it keeps waiting', async () => {
    const { repos, state, cache } = setup({ [LIB]: b64({ images: {} }) });
    await edit(repos, LIB, (d) => { d.images.e = {}; }, 'Update metadata for media e');
    state.files[LIB] = b64({ images: { outside: {} } });       // a commit from elsewhere
    await cache.flush();
    assert.equal(state.commits.length, 0);
    assert.ok(fromB64(state.files[LIB]).images.outside);
    assert.deepEqual(cache.pending().map((p) => p.path), [LIB]);
});

test('combined messages', () => {
    assert.equal(combinedMessage(['Delete media x']), 'Delete media x');
    assert.equal(combinedMessage(['a', 'b', 'a']), '3 changes from the CMS\n\n- a (×2)\n- b');
});
