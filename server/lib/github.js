// github.js - The one GitHub client of the CMS, with the data-file cache (github-cache.js).
// Every route must use this instance: a second client would write files behind the cache's back.
const { Octokit } = require('@octokit/rest');
const { withFileCache } = require('./github-cache');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const cache = withFileCache(octokit);

module.exports = { octokit, cache };

// Writes that nobody waits for (e.g. the review log after a save): run one after another, in the background, so two
// of them never write the same file with the same sha. Errors are logged, not thrown.
let queue = Promise.resolve();
function inBackground(label, job) {
    queue = queue.then(job).catch((err) => console.error(`Background ${label} failed:`, err.message));
    return queue;
}

module.exports.inBackground = inBackground;
