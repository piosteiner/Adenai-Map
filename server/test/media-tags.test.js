// lib/tags.js normalizeTags: how every tag is written
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTags } = require('../lib/tags');

test('tags: lower case, trimmed, each once, from a list or a comma-separated text', () => {
    assert.deepEqual(normalizeTags(['Human', ' human ', 'Tabaxi', '', 'NPC']), ['human', 'tabaxi', 'npc']);
    assert.deepEqual(normalizeTags('Elf, Child ,elf,,'), ['elf', 'child']);
    assert.deepEqual(normalizeTags(undefined), []);
});

test('tags: settled spellings — a typo, two tags written as one, the name chosen of two', () => {
    assert.deepEqual(normalizeTags(['Firbold', 'gate. portal', 'Beastfolk', 'beastkin', 'chlid']), ['firbolg', 'gate', 'portal', 'beastkin', 'child']);
});
