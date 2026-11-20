// media-lock.js - The pictures of the media library are only for the group (2026-11-20): most come from artists who
// never allowed them on an open website (the owner's own and AI ones are for everyone). The Grimoire's image library,
// where they live, sends a picture only with its cookie for Adenai, which it gives for the minutes token — the same
// password (it asks the CMS whether the token is valid: server/lib/media-access.js). Without it a picture fails, and this puts a placeholder
// in its place (wherever on the map it is: panels, popups, galleries, previews). An unlocked device asks for the
// cookie on every visit (its stored token is swapped for it), and once it has it, the placeholders turn back into
// the pictures. Loaded first, so it sees every picture fail.
(function () {
    // the pictures are in the Grimoire's library since 2026-11-20; old addresses (adenai-admin …/media/) lead there
    const MEDIA = /^https:\/\/(adenai-admin\.piogino\.ch\/media|grimoire\.piogino\.ch\/api\/media\/files)\//;
    const ACCESS = 'https://grimoire.piogino.ch/api/projects/adenai/media-access';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="#e9e1cf"/>`
        + `<g fill="none" stroke="#8a7a5e" stroke-width="4"><rect x="62" y="52" width="36" height="30" rx="4" fill="#d8ccb2"/><path d="M68 52v-8a12 12 0 0 1 24 0v8"/></g>`
        + `<text x="80" y="102" font-family="sans-serif" font-size="10" fill="#6f6352" text-anchor="middle">mit Protokoll-Passwort</text></svg>`;
    const PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    const TITLE = 'Bild – sichtbar mit dem Protokoll-Passwort (Protokolle → Passwort)';

    // a picture of the media library that failed: the placeholder, the address kept for later
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || img.dataset.lockedSrc || !MEDIA.test(img.src)) return;
        img.dataset.lockedSrc = img.src;
        if (img.srcset) { img.dataset.lockedSrcset = img.srcset; img.removeAttribute('srcset'); }
        img.src = PLACEHOLDER;
        img.title = img.title || TITLE;
        img.classList.add('media-locked');
    }, true);

    // the cookie is there: every placeholder back to its picture
    function reveal() {
        document.querySelectorAll('img[data-locked-src]').forEach((img) => {
            const src = img.dataset.lockedSrc;
            if (img.dataset.lockedSrcset) img.srcset = img.dataset.lockedSrcset;
            delete img.dataset.lockedSrc; delete img.dataset.lockedSrcset;
            if (img.title === TITLE) img.removeAttribute('title');
            img.classList.remove('media-locked');
            img.src = src;
        });
    }

    // an unlocked device's token → the picture cookie (components/protocols.js calls this)
    async function requestAccess(token) {
        if (!token) return false;
        try {
            const res = await fetch(ACCESS, { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) { reveal(); return true; }
        } catch { /* offline: the pictures stay as they are */ }
        return false;
    }
    const lock = () => fetch(ACCESS, { method: 'DELETE', credentials: 'include' }).catch(() => {});

    window.AdenaiMedia = { requestAccess, reveal, lock };
})();
