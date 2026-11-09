// lib/emotes-live.js: the event stream parser, and a set change from a stand-in for 7TV's event feed leading to a refresh.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

test('eventParser splits server-sent events, also across chunks', () => {
    const { eventParser } = require('../lib/emotes-live');
    const got = [];
    const feed = eventParser((name, data) => got.push([name, data]));
    feed('event: hello\ndata: {"heartbeat_interval":1000}\n\nevent: dispa');
    feed('tch\ndata: {"type":"emote_set.update"}\n\n');
    assert.deepStrictEqual(got, [['hello', '{"heartbeat_interval":1000}'], ['dispatch', '{"type":"emote_set.update"}']]);
});

test('a set change on 7TV refreshes the emotes', async () => {
    let urls = [];
    const server = http.createServer((req, res) => {
        urls.push(decodeURIComponent(req.url));
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('event: hello\ndata: {"heartbeat_interval":5000}\n\n');
        setTimeout(() => res.write('event: dispatch\ndata: {"type":"emote_set.update","body":{"id":"SET1"}}\n\n'), 100);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    process.env.SEVENTV_EVENTS = `http://127.0.0.1:${server.address().port}/v3`;
    delete require.cache[require.resolve('../lib/emotes-live')];
    const live = require('../lib/emotes-live');
    let refreshed = 0;
    const quiet = { log() {}, error() {} };
    live.start({ setIds: async () => ['SET1'], refreshFrom7tv: async () => { refreshed++; return { changed: true, count: 1, added: 1, removed: 0 }; } }, { logger: quiet });
    await new Promise((r) => setTimeout(r, 6500)); // the refresh waits 5 s for further changes
    live.stop();
    server.closeAllConnections();
    server.close();
    assert.ok(urls[0].includes('emote_set.update<object_id=SET1>'), urls[0]);
    assert.strictEqual(refreshed, 1);
});
