// github.js - The one GitHub client of the CMS, with the data-file cache (github-cache.js).
// Every route must use this instance: a second client would write files behind the cache's back.
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { withFileCache } = require('./github-cache');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// The media library (1.3 MB, written on every tag or caption) and the review log: committed together, a few times an
// hour, instead of once per change; waiting in data/github-pending meanwhile (lib/github-cache.js). Only in the CMS
// server itself (server.js sets ADENAI_CMS_SERVER): a test or a script that loads this client must not take over the
// server's waiting changes — there, writes go to GitHub at once.
// A test instance (server/test/e2e/cms-test-server.cjs): ADENAI_JOURNAL_DIR, a journal of its own;
// ADENAI_READ_ONLY, nothing is written to GitHub at all.
const cache = withFileCache(octokit, console, {
    ...(process.env.ADENAI_CMS_SERVER ? {
        deferred: ['public/data/media-library.json', 'public/data/reviews.json'],
        journalDir: process.env.ADENAI_JOURNAL_DIR || path.join(__dirname, '..', 'data', 'github-pending'),
    } : {}),
    readOnly: !!process.env.ADENAI_READ_ONLY,
});

module.exports = { octokit, cache };

// Writes that nobody waits for (e.g. the review log after a save): run one after another, in the background, so two
// of them never write the same file with the same sha. Errors are logged, not thrown.
let queue = Promise.resolve();
function inBackground(label, job) {
    queue = queue.then(job).catch((err) => console.error(`Background ${label} failed:`, err.message));
    return queue;
}

module.exports.inBackground = inBackground;
