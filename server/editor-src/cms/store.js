// All CMS data in memory: loaded once (the server answers from its cache in milliseconds), reloaded after a save.
// Views subscribe with onChange() and read the lists and lookups below.
import { api } from './api';
import { fold } from './dom';

export const store = {
    auth: { authenticated: false, username: null, role: null },
    config: { locationTypes: {}, locationRegions: {}, characterStatus: {}, characterRelationships: {}, movementTypes: {} },
    locations: [],   // GeoJSON features
    characters: [],
    terms: [],       // glossary
    media: {},       // id → media entry
    emotes: { sources: [], custom: [], emotes: {} }, // public/data/emotes.json
    loaded: false,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (what) => listeners.forEach((fn) => fn(what));

export async function loadAll() {
    const [auth, config, locations, characters, media, glossary, emotes] = await Promise.all([
        api('/api/auth-status'),
        api('/api/config'),
        api('/api/locations'),
        api('/api/characters'),
        api('/api/media?page=1&limit=10000'),
        api('/api/glossary'),
        api('/api/emotes').catch(() => null), // no emotes is no reason not to start
    ]);
    store.terms = glossary.terms || [];
    setEmotes(emotes);
    store.auth = auth;
    store.config = config.config || store.config;
    store.locations = locations.features || [];
    store.characters = characters.characters || [];
    store.media = media.media || {};
    store.loaded = true;
    emit('all');
}

export async function reload(...what) {
    await Promise.all(what.map(async (w) => {
        if (w === 'locations') store.locations = (await api('/api/locations')).features || [];
        if (w === 'characters') store.characters = (await api('/api/characters')).characters || [];
        if (w === 'terms') store.terms = (await api('/api/glossary')).terms || [];
        if (w === 'media') store.media = (await api('/api/media?page=1&limit=10000')).media || {};
        if (w === 'auth') store.auth = await api('/api/auth-status');
        if (w === 'emotes') setEmotes(await api('/api/emotes'));
    }));
    emit(what.join(','));
}

export const canEdit = () => !!store.auth.authenticated;

function setEmotes(data) {
    store.emotes = { sources: data?.sources || [], custom: data?.custom || [], emotes: data?.emotes || {}, lastUpdated: data?.lastUpdated };
    window.RichText?.setEmotes(store.emotes.emotes);
}

// ---------- lookups ----------

export const locationByName = (name) => store.locations.find((f) => fold(f.properties?.name) === fold(name));
export const characterById = (id) => store.characters.find((c) => c.id === id);
export const characterByName = (name) => store.characters.find((c) => fold(c.name) === fold(name));
export const termById = (id) => store.terms.find((t) => t.id === id);
// by name or alias
export const termByName = (name) => store.terms.find((t) => [t.name, ...(t.aliases || [])].some((n) => fold(n) === fold(name)));

// Config values come as { key: { value, label } }
export const options = (section) => Object.values(store.config[section] || {});
export const labelOf = (section, value) => store.config[section]?.[value]?.label || value || '';

export const imagesOf = (entity) => {
    const list = Array.isArray(entity?.images) ? entity.images.filter(Boolean) : [];
    return list.length ? list : (entity?.image ? [entity.image] : []);
};
export const thumbOf = (url) => (url ? String(url).replace(/-(small|medium|large|original)\.webp$/, '-thumb.webp') : '');
export const mediumOf = (url) => (url ? String(url).replace(/-(thumb|small)\.webp$/, '-medium.webp') : '');

// ---------- relations ----------

// Entries whose texts link to name ([[name]]), as { kind, name, id }
export function backlinks(name) {
    const key = fold(name);
    const linksIn = (text) => [...String(text || '').matchAll(/\[\[([^\[\]|\n]+?)(?:\|[^\[\]\n]+?)?\]\]/g)].map((m) => fold(m[1]));
    const out = [];
    for (const c of store.characters) {
        if (fold(c.name) !== key && [c.description, c.notes].some((t) => linksIn(t).includes(key))) out.push({ kind: 'character', name: c.name, id: c.id });
    }
    for (const f of store.locations) {
        const p = f.properties || {};
        if (fold(p.name) !== key && linksIn(p.description).includes(key)) out.push({ kind: 'location', name: p.name });
    }
    for (const t of store.terms) {
        if (fold(t.name) !== key && linksIn(t.description).includes(key)) out.push({ kind: 'term', name: t.name, id: t.id });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// Characters from / currently at a location (current: the server's computedCurrentLocation)
export function charactersAt(locationName) {
    const key = fold(locationName);
    return {
        origin: store.characters.filter((c) => fold(c.placeOfOrigin) === key),
        current: store.characters.filter((c) => fold(c.computedCurrentLocation || c.currentLocation?.location) === key),
    };
}
