// CMS → Media: the tags to click. The live CMS, as if logged in (the login check answered by the test) — the save is
// caught by the test too, so nothing is written.
const { test, expect } = require('@playwright/test');

const CMS = 'https://adenai-admin.piogino.ch';

test('clicking tags sets and removes them in the field, saved like typing', async ({ page }) => {
    await page.route('**/api/auth-status', (route) => route.fulfill({ json: { authenticated: true, username: 'test', role: 'gm' } }));
    const saved = [];
    await page.route('**/api/media/*', (route) => {
        if (route.request().method() !== 'PUT') return route.continue();
        saved.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true } });
    });
    await page.route(/\/api\/(protocols|pending|quality)/, (route) => route.fulfill({ json: { success: true, sessions: [], entries: [], ok: {} } }));

    // an image of a character
    const lib = await (await page.request.get(`${CMS}/api/data/media-library.json`)).json();
    const [id, image] = Object.entries(lib.images).find(([, m]) => m.category === 'characters');
    await page.goto(`${CMS}/v2/#/media/${encodeURIComponent(id)}`);

    const tags = page.getByLabel('Tags', { exact: true });
    await expect(tags).toBeVisible();
    for (const group of ['Gender', 'Age', 'Ancestry', 'Often used']) await expect(page.locator('.tag-pick-label', { hasText: group })).toBeVisible();

    const before = (image.tags || []).map((t) => t.toLowerCase());
    const pick = (name) => page.locator('.tag-picks button.tag-pick', { hasText: new RegExp(`^${name}$`) });
    // a tag the image doesn't have: on, into the field; off again
    const tag = ['nonbinary', 'elder', 'goliath', 'genasi'].find((t) => !before.includes(t));
    await pick(tag).click();
    await expect(pick(tag)).toHaveClass(/\bon\b/);
    await expect(tags).toHaveValue(new RegExp(`(^|, )${tag}$`));
    await expect.poll(() => saved.length, { timeout: 10000 }).toBeGreaterThan(0);
    expect(saved.at(-1).tags.map((t) => t.toLowerCase())).toContain(tag);
    await pick(tag).click();
    await expect(pick(tag)).not.toHaveClass(/\bon\b/);
    await expect.poll(() => saved.at(-1).tags.map((t) => t.toLowerCase()).includes(tag), { timeout: 10000 }).toBe(false);

    // typing in the field marks the tag; another case counts as the same tag
    await tags.fill('Human');
    await expect(pick('human')).toHaveClass(/\bon\b/);
    await pick('human').click();
    await expect(tags).toHaveValue('');
    // leaving the field: lower case, each once — and saved so
    await tags.fill('Elf, ELF, Child');
    await tags.blur();
    await expect(tags).toHaveValue('elf, child');
    await expect.poll(() => JSON.stringify(saved.at(-1).tags), { timeout: 10000 }).toBe('["elf","child"]');
});

test('a location image offers only its often used tags, no character groups', async ({ page }) => {
    await page.route('**/api/auth-status', (route) => route.fulfill({ json: { authenticated: true, username: 'test', role: 'gm' } }));
    await page.route(/\/api\/(protocols|pending|quality)/, (route) => route.fulfill({ json: { success: true, sessions: [], entries: [], ok: {} } }));
    await page.route('**/api/media/*', (route) => (route.request().method() === 'PUT' ? route.fulfill({ json: { success: true } }) : route.continue()));
    const lib = await (await page.request.get(`${CMS}/api/data/media-library.json`)).json();
    const [id] = Object.entries(lib.images).find(([, m]) => m.category === 'locations');
    await page.goto(`${CMS}/v2/#/media/${encodeURIComponent(id)}`);
    await expect(page.getByLabel('Tags', { exact: true })).toBeVisible();
    await expect(page.locator('.tag-pick-label', { hasText: 'Gender' })).toHaveCount(0);
});

test('"Tag lists…": a list added in the dialog is saved and offered beside the tags at once', async ({ page }) => {
    await page.route('**/api/auth-status', (route) => route.fulfill({ json: { authenticated: true, username: 'test', role: 'gm' } }));
    await page.route(/\/api\/(protocols|pending|quality)/, (route) => route.fulfill({ json: { success: true, sessions: [], entries: [], ok: {} } }));
    await page.route('**/api/media/*', (route) => (route.request().method() === 'PUT' ? route.fulfill({ json: { success: true } }) : route.continue()));
    let sent = null;
    await page.route('**/api/media-tag-groups', (route) => {
        if (route.request().method() !== 'PUT') return route.continue();
        sent = route.request().postDataJSON();
        // as the server cleans them: tags lower case, trimmed, empty ones dropped
        const groups = sent.groups.map((g) => ({ ...g, label: g.label.trim(), tags: [...new Set(g.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))] }));
        return route.fulfill({ json: { success: true, groups } });
    });
    const lib = await (await page.request.get(`${CMS}/api/data/media-library.json`)).json();
    const [id] = Object.entries(lib.images).find(([, m]) => m.category === 'characters');
    await page.goto(`${CMS}/v2/#/media/${encodeURIComponent(id)}`);
    await expect(page.locator('.tag-pick-label', { hasText: 'Ancestry' })).toBeVisible();

    await page.getByRole('button', { name: 'Tag lists…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tag lists' });
    await expect(dialog.locator('.tag-list')).toHaveCount(3);
    await dialog.getByRole('button', { name: '＋ Add list' }).click();
    const last = dialog.locator('.tag-list').last();
    await last.getByLabel('Name of the list').fill('Constructs');
    await last.locator('textarea').fill('Warforged, Golem');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);

    expect(sent.groups.map((g) => g.label)).toEqual(['Gender', 'Age', 'Ancestry', 'Constructs']);
    expect(sent.groups[3].categories).toEqual(['characters']);
    await expect(page.locator('.tag-pick-label', { hasText: 'Constructs' })).toBeVisible();
    await expect(page.locator('.tag-picks button.tag-pick', { hasText: /^warforged$/ })).toBeVisible();
});

test('in the grid, an image without tags has a dot in its corner, a tagged one none', async ({ page }) => {
    const lib = await (await page.request.get(`${CMS}/api/data/media-library.json`)).json();
    const entries = Object.entries(lib.images);
    const untagged = entries.filter(([, m]) => !(m.tags || []).length).length;
    await page.goto(`${CMS}/v2/#/media`);
    await expect(page.locator('.media-card').first()).toBeVisible();
    await expect(page.locator('.media-card .media-card-untagged')).toHaveCount(untagged);
    const [taggedId] = entries.find(([, m]) => (m.tags || []).length);
    await expect(page.locator(`.media-card[data-id="${taggedId}"] .media-card-untagged`)).toHaveCount(0);
});

test('"No tags yet" shows only the images still to tag, also within a category, with their number', async ({ page }) => {
    const lib = await (await page.request.get(`${CMS}/api/data/media-library.json`)).json();
    const images = Object.values(lib.images);
    const untagged = images.filter((m) => !(m.tags || []).length);
    const chars = untagged.filter((m) => m.category === 'characters');
    await page.goto(`${CMS}/v2/#/media`);
    const tagsFilter = page.getByRole('combobox', { name: 'Tag filter' });
    await expect(tagsFilter.locator('option[value="untagged"]')).toHaveText(`No tags yet (${untagged.length})`);
    await tagsFilter.selectOption('untagged');
    await expect(page.locator('.media-card')).toHaveCount(untagged.length);
    await expect(page.locator('.media-card .media-card-untagged')).toHaveCount(untagged.length);
    await page.getByRole('combobox', { name: 'Category' }).selectOption('characters');
    await expect(page.locator('.media-card')).toHaveCount(chars.length);
    await expect(tagsFilter.locator('option[value="untagged"]')).toHaveText(`No tags yet (${chars.length})`);
    await tagsFilter.selectOption('');
    await expect(page.locator('.media-card')).toHaveCount(images.filter((m) => m.category === 'characters').length);
});
