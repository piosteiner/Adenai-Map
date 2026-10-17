// entity-images.js - Several images per location or character
// Data (CMS): `images` is the list of image URLs, the first one the cover; `image` stays the cover for older readers.
// Popups show the cover as before plus thumbnails of the others; clicking any of them opens the image viewer
// (image-popup-manager.js) with the whole list to page through (data-gallery).
(function () {
    const esc = (s) => RichText.escape(s);

    function imagesOf(entity) {
        const list = Array.isArray(entity?.images) ? entity.images.filter(Boolean) : [];
        if (list.length) return list;
        return entity?.image ? [entity.image] : [];
    }

    // The 150 px version for thumbnails (media URLs end in -thumb/-small/-medium/-large/-original.webp)
    const thumbOf = (url) => String(url).replace(/-(small|medium|large|original)\.webp$/, '-thumb.webp');

    // Attributes for an <img> that belongs to the list: the viewer pages through all of them.
    function galleryAttrs(list, url) {
        return list.length > 1 ? ` data-gallery="${esc(JSON.stringify(list))}" data-src="${esc(url)}"` : '';
    }

    // Thumbnails of the images after the cover; nothing for 0 or 1 image.
    function galleryStrip(list, name) {
        if (list.length < 2) return '';
        const thumbs = list.slice(1).map((url, i) =>
            `<img class="popup-gallery-thumb" src="${esc(thumbOf(url))}" alt="${esc(name)} – Bild ${i + 2}" loading="lazy"${galleryAttrs(list, url)}>`);
        return `<div class="popup-gallery" title="${list.length} Bilder – klicken zum Vergrössern">${thumbs.join('')}</div>`;
    }

    window.EntityImages = { imagesOf, galleryAttrs, galleryStrip, thumbOf };
})();
