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
const FRESH_MS = 60 * 1000;
const COMMITS_MS = 30 * 1000;

function withFileCache(octokit, log = console) {
    const repos = octokit.rest.repos;
    const get = repos.getContent.bind(repos);
    const put = repos.createOrUpdateFileContents.bind(repos);
    const del = repos.deleteFile.bind(repos);
    const commits = repos.listCommits.bind(repos);

    const files = new Map();   // "owner/repo/path" → { data, etag, at, refreshing }
    let commitCache = new Map(); // JSON of params → { res, at }
    const keyOf = (p) => `${p.owner}/${p.repo}/${p.path}`;
    const onMain = (p) => !p.ref || p.ref === 'main';
    const copy = (entry) => ({ status: 200, data: { ...entry.data }, headers: {} });

    async function fetchInto(params, entry) {
        const headers = entry?.etag ? { ...(params.headers || {}), 'if-none-match': entry.etag } : params.headers;
        try {
            const res = await get({ ...params, headers });
            // files over 1 MB come without content (encoding "none"): not cached
            if (res.data && res.data.type === 'file' && res.data.encoding === 'base64' && res.data.content) {
                files.set(keyOf(params), { data: res.data, etag: res.headers?.etag || null, at: Date.now() });
            }
            return res;
        } catch (err) {
            if (err.status === 304 && entry) { entry.at = Date.now(); return copy(entry); }
            throw err;
        }
    }

    repos.getContent = async (params) => {
        if (!onMain(params)) return get(params);
        const entry = files.get(keyOf(params));
        if (!entry) return fetchInto(params);
        if (Date.now() - entry.at > FRESH_MS && !entry.refreshing) {
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

    repos.createOrUpdateFileContents = async (params) => {
        try {
            const res = await serialPut(params);
            files.set(keyOf(params), {
                data: { type: 'file', encoding: 'base64', path: params.path, name: params.path.split('/').pop(), sha: res.data.content.sha, content: params.content },
                etag: null, // the next refresh fetches the file in full
                at: Date.now(),
            });
            commitCache = new Map();
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

    return { warm, stats: () => ({ files: [...files.keys()].map((k) => k.split('/').slice(2).join('/')) }) };
}

module.exports = { withFileCache };
