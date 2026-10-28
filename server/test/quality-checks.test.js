// The Quality page's checks (editor-src/cms/quality-checks.js) on small made-up data.
const test = require('node:test');
const assert = require('node:assert/strict');

let checkAll;
test.before(async () => { ({ checkAll } = await import('../editor-src/cms/quality-checks.js')); });

const place = (name, extra = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name, description: 'x', image: 'https://a/media/aaaaaa-small.webp', ...extra } });
const person = (id, name, extra = {}) => ({ id, name, description: 'x', image: 'https://a/media/aaaaaa-small.webp', ...extra });
const media = { 'characters-aaaaaa': { sizes: { small: { url: 'https://a/media/aaaaaa-small.webp' } } } };
const kinds = (issues) => issues.map((i) => `${i.level}:${i.kind}:${i.entry.name}`);

test('a clean campaign has nothing to report', () => {
    assert.deepEqual(checkAll({ characters: [person('mae', 'Mae', { description: 'In [[Valaris]], sees [[Kunos|him]].' }), person('kunos', 'Kunos')], locations: [place('Valaris')], media }), []);
});

test('links: to nothing (once per name), through an alias, to a proposal, escaped', () => {
    const issues = checkAll({
        characters: [person('mae', 'Mae', { description: '[[Nowhere]] and [[nowhere]] again, [[Katze]], [[Neu]], \\[[kein Link]]' })],
        terms: [{ id: 't', name: 'Schwarze Katze', aliases: ['Katze'], description: 'x', image: 'https://a/media/aaaaaa-small.webp' }],
        proposals: [{ name: 'Neu' }], media,
    });
    assert.deepEqual(kinds(issues), ['error:link:Mae']);
    assert.match(issues[0].text, /Nowhere/);
});

test('links in the minutes count too', () => {
    const issues = checkAll({ sessions: [{ id: 's1', number: 1, title: 'Start', ingameStart: '5663-06-03', content: 'We met [[Mae]].' }], media });
    assert.deepEqual(kinds(issues), ['error:link:Session 1 — Start']);
});

test('an image no longer in the media library', () => {
    const issues = checkAll({ characters: [person('mae', 'Mae', { image: 'https://a/media/gone12-small.webp' })], media });
    assert.deepEqual(kinds(issues), ['error:image:Mae']);
});

test('names: the same twice, the same across kinds, one letter apart', () => {
    const issues = checkAll({ characters: [person('a', 'Toftgard'), person('b', 'Mae'), person('c', 'Mäe')], locations: [place('Toftgard'), place('Torftgard')], media });
    assert.deepEqual(kinds(issues).sort(), ['warning:ambiguous:Toftgard', 'warning:duplicate:Mäe', 'warning:similar:Torftgard']);
});

test('sessions: one beginning before the previous ends, end before start, no in-game date', () => {
    const issues = checkAll({ media, sessions: [
        { id: 'a', number: 54, ingameStart: '5663-09-01', ingameEnd: '5663-09-06', content: '' },
        { id: 'b', number: 55, ingameStart: '5663-09-04', ingameEnd: '5663-09-03', content: '' },
        { id: 'c', number: 56, content: '' },
    ] });
    assert.deepEqual(kinds(issues).sort(), ['hint:session-undated:Session 56', 'warning:session-dates:Session 55', 'warning:session-order:Session 55']);
});

test('movements: out of order, ending before they begin, the current location older, outside the sessions', () => {
    const issues = checkAll({ media,
        sessions: [{ id: 's', number: 1, ingameStart: '5663-06-03', ingameEnd: '5663-09-30', content: '' }],
        characters: [person('m', 'Mae', {
            currentLocation: { location: 'Valaris', dateStart: '5663-07-01' },
            movementHistory: [
                { id: 'm0', movement_nr: 0, location: 'Rena', dateStart: '5663-08-20' },
                { id: 'm1', movement_nr: 1, location: 'Wesdalen', dateStart: '5663-08-10', dateEnd: '5663-08-01' },
                { id: 'm2', movement_nr: 2, location: 'Tangoa', dateStart: '5663-10-02' },
            ],
        })],
    });
    assert.deepEqual(kinds(issues).sort(), ['hint:outside-campaign:Mae', 'warning:current-stale:Mae', 'warning:move-dates:Mae', 'warning:move-order:Mae']);
});

test('unfinished: no description, no picture; keys are unique and stable', () => {
    const data = { characters: [person('m', 'Mae', { description: '', image: '' })], media };
    const a = checkAll(data), b = checkAll(data);
    assert.deepEqual(kinds(a), ['hint:no-description:Mae', 'hint:no-image:Mae']);
    assert.deepEqual(a.map((i) => i.key), b.map((i) => i.key));
    assert.equal(new Set(a.map((i) => i.key)).size, a.length);
});
