// ../index.html: every local script and stylesheet exists and carries a version (?v= / ?t=) — a changed file needs a
// new one, or browsers keep the old copy (see the commits of 2026-10: emotes shipped without a bump).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const refs = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:)?\/\//.test(u) && /\.(js|css)(\?|$)/.test(u));

test('index.html refers to local scripts and styles', () => assert.ok(refs.length > 20));

test('every local script and stylesheet of index.html exists', () => {
    const missing = refs.filter((u) => !fs.existsSync(path.join(ROOT, u.split('?')[0].replace(/^\//, ''))));
    assert.deepEqual(missing, []);
});

test('every local script and stylesheet of index.html has a version', () => {
    // third-party libraries in src/vendor never change (a new release gets a new name); our build md-editor.js does
    const ours = refs.filter((u) => !u.startsWith('src/vendor/') || /md-editor/.test(u));
    assert.deepEqual(ours.filter((u) => !/\?(v|t)=[^&]+/.test(u)), []);
});
