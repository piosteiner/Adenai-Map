// images.js - Several images per location or character.
// Stored as `images` (list of URLs, the first is the cover) and `image` (= the cover, which older parts of the map and
// the CMS still read). normalizeImages() keeps the two consistent, whatever the form sent.
function normalizeImages(images, image) {
    let list = images;
    if (typeof list === 'string') {
        try { list = JSON.parse(list); } catch { list = list ? [list] : []; }
    }
    list = Array.isArray(list) ? list.map((u) => String(u || '').trim()).filter(Boolean) : [];
    if (!list.length && image) list = [String(image).trim()];
    list = [...new Set(list)];
    return { images: list, image: list[0] || '' };
}

module.exports = { normalizeImages };
