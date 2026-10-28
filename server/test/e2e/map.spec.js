// The map (../index.html) in a browser: it loads without errors, shows the campaign, and a [[link]] opens its entry.
const { test, expect } = require('@playwright/test');

// collects what the page reports as an error: uncaught exceptions and console.error
function watchErrors(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });
    return errors;
}

test('the map loads without errors and shows the characters and places', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.characterSystem?.getCharacters?.().length > 0 && window.locationSystem?.getLocations?.().length > 0);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    expect(await page.locator('.leaflet-marker-icon').count()).toBeGreaterThan(10);
    await page.waitForTimeout(2000); // the background loads
    expect(errors).toEqual([]);
});

test('a [[link]] in a place opens the linked character, the place stays open', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    // a place whose description links to a character
    const target = await page.waitForFunction(() => {
        const chars = window.characterSystem?.getCharacters?.() || [];
        const names = new Set(chars.map((c) => c.name.toLowerCase()));
        for (const l of window.locationSystem?.getLocations?.() || []) {
            const p = l.feature?.properties || l;
            for (const m of String(p.description || '').matchAll(/\[\[([^\]|]+)/g)) if (names.has(m[1].trim().toLowerCase())) return { place: p.name, character: m[1].trim() };
        }
        return null;
    }).then((h) => h.jsonValue());
    await page.evaluate((name) => window.locationSystem.focusLocation(name), target.place);
    const placePopup = page.locator('.leaflet-popup').filter({ hasText: target.place }).first();
    await expect(placePopup).toBeVisible();
    await placePopup.locator('a.wiki-link', { hasText: target.character }).first().click();
    await expect(page.locator('.leaflet-popup.character-focus-popup')).toBeVisible();
    await expect(placePopup).toBeVisible(); // pinned: links can be followed in a chain
    expect(errors).toEqual([]);
});

test('an emote shows no name on hover: no title, the bigger image only', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const name = await page.waitForFunction(() => window.AdenaiEmotes?.list?.()[0]?.name).then((h) => h.jsonValue());
    // an emote in a text, as every text of the map renders it
    await page.evaluate((n) => {
        const box = Object.assign(document.createElement('div'), { id: 'emote-test', innerHTML: RichText.render(`hi :${n}:`) });
        Object.assign(box.style, { position: 'fixed', top: '300px', left: '300px', zIndex: 99999, background: '#fff', padding: '10px' });
        document.body.append(box);
    }, name);
    const emote = page.locator('#emote-test img.emote');
    await expect(emote).toHaveCount(1);
    await expect(emote).not.toHaveAttribute('title', /.*/);
    await emote.hover();
    const tip = page.locator('.emote-tip');
    await expect(tip).toBeVisible();
    await expect(tip.locator('img')).toHaveCount(1);
    await expect(tip).toHaveText('');
});
