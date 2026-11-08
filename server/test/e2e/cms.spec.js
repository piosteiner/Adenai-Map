// The CMS (test instance, test/e2e/cms-test-server.cjs): the GM's alone — without the GM's login only a login form,
// no data; a player's account is refused; the map's own addresses stay open.
const { test, expect } = require('@playwright/test');
const { CMS, GM, PLAYER, loginGm } = require('./cms-helpers');

test("the map's data comes from the CMS with its version, without a login", async ({ request }) => {
    for (const file of ['characters.json', 'places.geojson', 'glossary.json', 'media-library.json']) {
        const res = await request.get(`${CMS}/api/data/${file}`);
        expect(res.status(), file).toBe(200);
        expect(res.headers()['x-data-version'], file).toMatch(/^[0-9a-f]{40}$/);
    }
});

test("without the GM's login the CMS's data is closed; the map's addresses stay open", async ({ request }) => {
    for (const path of ['/api/locations', '/api/characters', '/api/media?page=1&limit=5', '/api/glossary', '/api/emotes',
        '/api/config', '/api/changelog/history', '/api/quality/ok', '/api/media-tag-groups', '/api/character-paths',
        '/api/protocols/export', '/uploads/temp_media_upload/', '/api/anything-new']) {
        expect((await request.get(`${CMS}${path}`)).status(), path).toBe(401);
    }
    expect((await request.get(`${CMS}/api/data/characters.json`)).status()).toBe(200);
    expect((await request.get(`${CMS}/api/auth-status`)).status()).toBe(200);
    // the proposals: past the GM's lock, to their own (the minutes' password)
    expect((await (await request.get(`${CMS}/api/pending`)).json()).error).toBe('Protocol password required');
    // an image the map shows
    const lib = await (await request.get(`${CMS}/api/data/media-library.json`)).json();
    const url = Object.values(lib.images)[0].sizes.small.url.replace('https://adenai-admin.piogino.ch', CMS);
    expect((await request.get(url)).status()).toBe(200);
});

test('the CMS shows only a login form and loads nothing of the data', async ({ page }) => {
    const asked = [];
    page.on('request', (r) => { if (/\/api\/(locations|characters|media|glossary|config|emotes)/.test(r.url())) asked.push(r.url()); });
    await page.goto(`${CMS}/v2/`);
    await expect(page.getByRole('heading', { name: 'Adenai CMS' })).toBeVisible();
    await expect(page.getByText('For the GM only')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Areas' })).toBeHidden();
    await page.goto(`${CMS}/v2/#/media`); // a deep link too
    await expect(page.getByRole('heading', { name: 'Adenai CMS' })).toBeVisible();
    expect(asked).toEqual([]);
});

test("a player's account is refused, even with the right password", async ({ page, request }) => {
    const res = await request.post(`${CMS}/api/login`, { data: PLAYER });
    expect(res.status()).toBe(403);
    await page.goto(`${CMS}/v2/`);
    await page.getByLabel('User').fill(PLAYER.username);
    await page.getByLabel('Password').fill(PLAYER.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('The CMS is for the GM only.');
    await expect(page.getByRole('navigation', { name: 'Areas' })).toBeHidden();
});

test("the GM logs in, the CMS opens; logging out locks it again", async ({ page }) => {
    await page.goto(`${CMS}/v2/`);
    await page.getByLabel('User').fill(GM.username);
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Wrong user name or password');
    await page.getByLabel('Password').fill(GM.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    for (const area of ['Locations', 'Characters', 'Glossary', 'Media']) await expect(page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: area })).toBeVisible();
    await page.getByRole('button', { name: /Log out/ }).click();
    await expect(page.getByRole('heading', { name: 'Adenai CMS' })).toBeVisible();
    expect((await page.request.get(`${CMS}/api/locations`)).status()).toBe(401);
});

test('the Quality page counts errors, warnings and unfinished entries, and links to them', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loginGm(page);
    await page.goto(`${CMS}/v2/#/quality`);
    await expect(page.locator('.quality .stats .stat')).toHaveCount(3);
    await expect(page.locator('.quality-row a.chip').first()).toHaveAttribute('href', /^#\/(characters|locations|glossary|protocols)\//);
    await expect(page.locator('.quality')).not.toContainText('[object');
    expect(errors).toEqual([]);
});
