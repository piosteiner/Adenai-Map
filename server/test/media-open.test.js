// lib/media-open.js: which credits make a picture visible to everyone
const test = require('node:test');
const assert = require('node:assert');
const { ownWork, openFiles } = require('../lib/media-open');

test('own work and pure AI pictures are open', () => {
    for (const c of ['myself', 'drawn by Pio Gino Steiner', 'AI generated', 'AI Generated - Midjourney & GPT5', 'AI Generated - GPT5: based on own drawing', 'AI Generated - GPT5: based on the the High Dunes in Colorado, USA']) assert.ok(ownWork(c), c);
});

test('anything with someone else\'s art in it stays locked', () => {
    for (const c of ['https://www.pinterest.com/pin/1/', 'AI Generated - GPT5: heavily based on a design from Dungeon Meshi', 'Wizards of the Coast', 'from "Divinity Original Sin II Artbook" (p. 47) - Altered by AI (GPT5)',
        'AI Altered - GPT5: Art "Rabbit Village II" by pixel cat', 'AI modified with GPT-5', 'hand drawn copy of a cacaocat design from an article in Japan', '', undefined]) assert.ok(!ownWork(c), c);
});

test('the open files are every size of an open picture', () => {
    const lib = { images: { a: { open: true, sizes: { small: { filename: 'a-small.webp' }, large: { filename: 'a-large.webp' } } }, b: { open: false, sizes: { small: { filename: 'b-small.webp' } } } } };
    const files = openFiles(lib, 'sha1');
    assert.deepStrictEqual([...files].sort(), ['a-large.webp', 'a-small.webp']);
});
