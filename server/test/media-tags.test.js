// routes/media.js normalizeTags: how every tag is written
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTags } = require('../routes/media');

test('tags: lower case, trimmed, each once, from a list or a comma-separated text', () => {
    assert.deepEqual(normalizeTags(['Human', ' human ', 'Tabaxi', '', 'NPC']), ['human', 'tabaxi', 'npc']);
    assert.deepEqual(normalizeTags('Elf, Child ,elf,,'), ['elf', 'child']);
    assert.deepEqual(normalizeTags(undefined), []);
});
