// github-cache.js - Keep the repo's data files in memory, so the CMS doesn't wait for GitHub on every request.
//
// The routes read and write public/data/*.json through octokit.rest.repos.getContent / createOrUpdateFileContents
// (about 50 calls). withFileCache() wraps those two (plus deleteFile and listCommits) on the given octokit:
//   - reads of a file on main are answered from memory; an entry older than FRESH_MS is refreshed in the background
//     with a conditional request (ETag), so the answer is immediate and at most a minute behind outside changes;
//   - a write goes to GitHub as before and then replaces the cached copy with exactly what was written (new sha), so
//     the next read is current at once — GitHub's own API can lag behind a commit for some seconds;
//   - writes stay safe: GitHub only accepts a write with the file's current sha, so a change made outside the CMS
//     makes the write fail (409) instead of being overwritten; the entry is then dropped and fetched anew.
//   - "changed" (path, sha) on .events whenever a file's content changes: a write, or a refresh that found a newer
//     version (an outside commit) — routes/data.js tells the open maps.
//   - deferred files (options.deferred: media-library.json, reviews.json): a write is done once it is in memory and in
//     a journal on disk (options.journalDir) — no GitHub round trip of the whole file, one commit per tag. They go to
//     GitHub together, as one commit, after a quiet minute or at most five minutes after the first change (flush());
//     the journal brings them back after a restart. Their sha is git's blob sha, the one GitHub will give them. While
//     a file waits, it is not refreshed from GitHub; if GitHub's copy changed meanwhile (a commit from outside the
//     CMS), the flush leaves that file alone and logs it — its journal holds the CMS's version until it is resolved.
const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const nodePath = require('path');

const FRESH_MS = 60 * 1000;
const COMMITS_MS = 30 * 1000;
const QUIET_MS = 60 * 1000;      // deferred files: committed after this long without a change …
const MAX_WAIT_MS = 5 * 60 * 1000; // … or at the latest this long after the first one

// git's id of a file's content: GitHub's "sha" of the file
const blobSha = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

// One commit message for several changes: "3 changes from the CMS" and the list (repeated messages counted)
function combinedMessage(messages) {
    if (messages.length === 1) return messages[0];
    const counts = new Map();
    for (const m of messages) counts.set(m, (counts.get(m) || 0) + 1);
    const lines = [...counts].map(([m, n]) => `- ${m}${n > 1 ? ` (×${n})` : ''}`);
    return `${messages.length} changes from the CMS\n\n${lines.slice(0, 60).join('\n')}${lines.length > 60 ? `\n- … and ${lines.length - 60} more` : ''}`;
}

function withFileCache(octokit, log = console, options = {}) {
    const { deferred = [], journalDir = null, quietMs = QUIET_MS, maxWaitMs = MAX_WAIT_MS } = options;
    const events = new EventEmitter();
    events.setMaxListeners(0);
    const repos = octokit.rest.repos;
    const get = repos.getContent.bind(repos);
    const put = repos.createOrUpdateFileContents.bind(repos);
    const del = repos.deleteFile.bind(repos);
    const commits = repos.listCommits.bind(repos);

    const files = new Map();   // "owner/repo/path" → { data, etag, at, refreshing }
    let commitCache = new Map(); // JSON of params → { res, at }
    const keyOf = (p) => `${p.owner}/${p.repo}/${p.path}`;
    const onMain = (p) => !p.ref || p.ref === 'main';
    const dirty = new Map();   // key → { owner, repo, path, base: GitHub's sha, messages, since } of a deferred file waiting
    const isDeferred = (p) => onMain(p) && deferred.includes(p.path) && !!journalDir;
    const copy = (entry) => ({ status: 200, data: { ...entry.data }, headers: {} });

    // Files over 1 MB come without content (encoding "none", e.g. media-library.json): the content from the blob API
    // instead (up to 100 MB), so the routes get them as a small file
    async function withContent(params, res) {
        if (res.data?.type !== 'file' || res.data.content || !res.data.sha) return res;
        const blob = await octokit.rest.git.getBlob({ owner: params.owner, repo: params.repo, file_sha: res.data.sha });
        return { ...res, data: { ...res.data, encoding: 'base64', content: blob.data.content } };
    }

    async function fetchInto(params, entry) {
        const headers = entry?.etag ? { ...(params.headers || {}), 'if-none-match': entry.etag } : params.headers;
        try {
            const res = await withContent(params, await get({ ...params, headers }));
            if (res.data && res.data.type === 'file' && res.data.encoding === 'base64' && res.data.content) {
                const before = files.get(keyOf(params))?.data.sha;
                files.set(keyOf(params), { data: res.data, etag: res.headers?.etag || null, at: Date.now() });
                if (before && before !== res.data.sha) events.emit('changed', params.path, res.data.sha);
            }
            return res;
        } catch (err) {
            if (err.status === 304 && entry) { entry.at = Date.now(); return copy(entry); }
            throw err;
        }
    }

    repos.getContent = async (params) => {
        if (!onMain(params)) return withContent(params, await get(params));
        const entry = files.get(keyOf(params));
        if (!entry) return fetchInto(params);
        if (Date.now() - entry.at > FRESH_MS && !entry.refreshing && !dirty.has(keyOf(params))) {
            entry.refreshing = true; // answer now, refresh behind the scenes
            fetchInto(params, entry).catch((err) => log.warn?.(`github-cache: refresh of ${params.path} failed: ${err.message}`))
                .finally(() => { entry.refreshing = false; });
        }
        return copy(entry);
    };

    // Writes go to GitHub one at a time: two commits sent at once (e.g. a save and the review log written behind it)
    // race for the branch head and GitHub rejects one ("is at <sha> but expected <sha>"). Lost that race anyway (a
    // commit from elsewhere): try once more — the file's own sha still guards against overwriting its changes.
    let writes = Promise.resolve();
    const headRace = (err) => err.status === 409 && /is at [0-9a-f]{40} but expected [0-9a-f]{40}/.test(err.message || '');
    const putOnce = async (params) => {
        try { return await put(params); } catch (err) {
            if (!headRace(err)) throw err;
            await new Promise((r) => setTimeout(r, 700));
            return put(params);
        }
    };
    const serialPut = (params) => { const job = writes.then(() => putOnce(params)); writes = job.catch(() => {}); return job; };

    // ---------- deferred files ----------
    const journalOf = (key) => nodePath.join(journalDir, `${encodeURIComponent(key)}.json`);
    function writeJournal(key) {
        const d = dirty.get(key);
        const { data } = files.get(key);
        const tmp = `${journalOf(key)}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ owner: d.owner, repo: d.repo, path: d.path, base: d.base, messages: d.messages, since: d.since, sha: data.sha, content: data.content }));
        fs.renameSync(tmp, journalOf(key)); // whole or not at all
    }

    // What waited at the last stop comes back as it was
    if (journalDir) {
        fs.mkdirSync(journalDir, { recursive: true });
        for (const name of fs.readdirSync(journalDir).filter((n) => n.endsWith('.json'))) {
            try {
                const j = JSON.parse(fs.readFileSync(nodePath.join(journalDir, name), 'utf8'));
                const key = keyOf(j);
                files.set(key, { data: { type: 'file', encoding: 'base64', path: j.path, name: j.path.split('/').pop(), sha: j.sha, content: j.content }, etag: null, at: Date.now() });
                dirty.set(key, { owner: j.owner, repo: j.repo, path: j.path, base: j.base, messages: j.messages, since: j.since });
                log.log?.(`github-cache: ${j.path} — ${j.messages.length} change(s) from before the restart, not yet on GitHub`);
            } catch (err) {
                log.error?.(`github-cache: journal ${name} unreadable, left in place: ${err.message}`);
            }
        }
    }

    let timer = null;
    function schedule() {
        clearTimeout(timer);
        if (!dirty.size) return;
        const oldest = Math.min(...[...dirty.values()].map((d) => d.since));
        timer = setTimeout(() => flush().catch(() => {}), Math.max(0, Math.min(quietMs, oldest + maxWaitMs - Date.now())));
        timer.unref?.();
    }

    async function deferWrite(params) {
        const key = keyOf(params);
        if (!files.has(key)) await fetchInto(params);
        const entry = files.get(key);
        if (params.sha !== entry.data.sha) { // as GitHub answers a write based on an older version
            throw Object.assign(new Error(`${params.path} does not match ${params.sha}`), { status: 409 });
        }
        const content = Buffer.from(params.content, 'base64');
        const sha = blobSha(content);
        const d = dirty.get(key) || { owner: params.owner, repo: params.repo, path: params.path, base: entry.data.sha, messages: [], since: Date.now() };
        d.messages.push(params.message);
        files.set(key, { data: { type: 'file', encoding: 'base64', path: params.path, name: params.path.split('/').pop(), sha, content: content.toString('base64') }, etag: null, at: Date.now() });
        dirty.set(key, d);
        writeJournal(key);
        events.emit('changed', params.path, sha);
        schedule();
        return { status: 200, data: { content: { path: params.path, sha }, commit: { sha: null, message: 'waiting to be committed' } } };
    }

    // f is on GitHub: no longer waiting — unless it changed meanwhile, then the rest waits, based on what is there
    function done(f) {
        const d = dirty.get(f.key);
        if (files.get(f.key).data.sha === f.sha) {
            dirty.delete(f.key);
            fs.rmSync(journalOf(f.key), { force: true });
        } else {
            d.base = f.sha;
            d.messages = d.messages.slice(f.count);
            writeJournal(f.key);
        }
    }

    // Everything waiting, as one commit per repository (on the write queue: never beside another commit)
    async function flushNow() {
        const byRepo = new Map();
        for (const [key, d] of dirty) {
            const r = `${d.owner}/${d.repo}`;
            if (!byRepo.has(r)) byRepo.set(r, []);
            byRepo.get(r).push({ key, d, sha: files.get(key).data.sha, content: files.get(key).data.content, count: d.messages.length });
        }
        for (const list of byRepo.values()) {
            const { owner, repo } = list[0].d;
            for (let attempt = 0; ; attempt++) {
                const head = (await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' })).data.object.sha;
                // a file changed on GitHub since the CMS took it would be overwritten: left out, and said so
                const ok = [];
                for (const f of list) {
                    let remote = null;
                    try { remote = (await get({ owner, repo, path: f.d.path, ref: head })).data.sha; } catch (err) { if (err.status !== 404) throw err; }
                    if (remote === f.sha) done(f); // already there (committed just before a stop that left the journal)
                    else if (remote === f.d.base) ok.push(f);
                    else log.error?.(`github-cache: ${f.d.path} changed on GitHub outside the CMS (${remote}, the CMS began from ${f.d.base}) — not committed; its changes wait in ${journalOf(f.key)}`);
                }
                if (!ok.length) return;
                const baseTree = (await octokit.rest.git.getCommit({ owner, repo, commit_sha: head })).data.tree.sha;
                const tree = [];
                for (const f of ok) {
                    const blob = (await octokit.rest.git.createBlob({ owner, repo, content: f.content, encoding: 'base64' })).data.sha;
                    tree.push({ path: f.d.path, mode: '100644', type: 'blob', sha: blob });
                }
                const treeSha = (await octokit.rest.git.createTree({ owner, repo, base_tree: baseTree, tree })).data.sha;
                const message = combinedMessage(ok.flatMap((f) => f.d.messages.slice(0, f.count)));
                const commit = (await octokit.rest.git.createCommit({ owner, repo, message, tree: treeSha, parents: [head] })).data.sha;
                try {
                    await octokit.rest.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit, force: false });
                } catch (err) {
                    if (err.status === 422 && attempt < 2) continue; // another commit came first: build on it
                    throw err;
                }
                for (const f of ok) done(f);
                commitCache = new Map();
                log.log?.(`github-cache: committed ${ok.map((f) => `${f.d.path} (${f.count})`).join(', ')} as ${commit.slice(0, 7)}`);
                break;
            }
        }
    }
    function flush() {
        clearTimeout(timer);
        if (!dirty.size) return Promise.resolve();
        const job = writes.then(flushNow);
        writes = job.catch((err) => log.error?.(`github-cache: commit of the waiting files failed: ${err.message}`));
        return job.finally(schedule);
    }

    repos.createOrUpdateFileContents = async (params) => {
        if (isDeferred(params) && params.sha) return deferWrite(params);
        try {
            const res = await serialPut(params);
            files.set(keyOf(params), {
                data: { type: 'file', encoding: 'base64', path: params.path, name: params.path.split('/').pop(), sha: res.data.content.sha, content: params.content },
                etag: null, // the next refresh fetches the file in full
                at: Date.now(),
            });
            commitCache = new Map();
            events.emit('changed', params.path, res.data.content.sha);
            return res;
        } catch (err) {
            files.delete(keyOf(params)); // e.g. 409: changed outside the CMS — read it fresh next time
            throw err;
        }
    };

    repos.deleteFile = async (params) => {
        files.delete(keyOf(params));
        commitCache = new Map();
        return del(params);
    };

    repos.listCommits = async (params) => {
        const k = JSON.stringify(params);
        const hit = commitCache.get(k);
        if (hit && Date.now() - hit.at < COMMITS_MS) return hit.res;
        const res = await commits(params);
        commitCache.set(k, { res, at: Date.now() });
        return res;
    };

    // Fetch the main data files once at start, so the first page load is fast too.
    async function warm(owner, repo, paths) {
        await Promise.all(paths.map((path) => repos.getContent({ owner, repo, path }).catch((err) => log.warn?.(`github-cache: warm-up of ${path} failed: ${err.message}`))));
    }

    schedule(); // what the journal brought back

    const pending = () => [...dirty.values()].map((d) => ({ path: d.path, changes: d.messages.length, since: new Date(d.since).toISOString() }));
    return { warm, events, flush, pending, stats: () => ({ files: [...files.keys()].map((k) => k.split('/').slice(2).join('/')), pending: pending() }) };
}

module.exports = { withFileCache, blobSha, combinedMessage };
