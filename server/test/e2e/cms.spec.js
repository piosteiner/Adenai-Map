// The live CMS server, read-only: the map's data API, the CMS page, and what stays closed without a login.
const { test, expect } = require('@playwright/test');

const CMS = 'https://adenai-admin.piogino.ch';

test("the map's data comes from the CMS with its version", async ({ request }) => {
    for (const file of ['characters.json', 'places.geojson', 'glossary.json', 'media-library.json']) {
        const res = await request.get(`${CMS}/api/data/${file}`);
        expect(res.status(), file).toBe(200);
        expect(res.headers()['x-data-version'], file).toMatch(/^[0-9a-f]{40}$/);
        expect(await res.json(), file).toBeTruthy();
    }
});

test('the CMS opens for reading, with its areas and a login', async ({ page }) => {
    await page.goto(`${CMS}/v2/`);
    for (const area of ['Locations', 'Characters', 'Glossary']) await expect(page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: area })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('private routes are closed without a login', async ({ request }) => {
    for (const path of ['/api/quality/ok', '/api/protocols/export']) {
        const res = await request.get(`${CMS}${path}`);
        expect([401, 403], path).toContain(res.status());
    }
});

test('the Quality page counts errors, warnings and unfinished entries, and links to them', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${CMS}/v2/#/quality`);
    await expect(page.locator('.quality .stats .stat')).toHaveCount(3);
    await expect(page.locator('.quality-row a.chip').first()).toHaveAttribute('href', /^#\/(characters|locations|glossary|protocols)\//);
    await expect(page.locator('.quality')).not.toContainText('[object');
    expect(errors).toEqual([]);
});
