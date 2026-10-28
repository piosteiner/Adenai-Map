// How every image tag is written: lower case, trimmed, each once ("Human, human " → ["human"]), and the settled
// spellings — a tag written the other way becomes this one (routes/media.js, routes/tag-groups.js).
// settled 2026-10-28
const TAG_RENAMES = { firbold: ['firbolg'], 'gate. portal': ['gate', 'portal'], beastfolk: ['beastkin'], chlid: ['child'], wizard: ['mage'], wizardd: ['mage'] };
const normalizeTags = (list) => [...new Set((Array.isArray(list) ? list : String(list || '').split(','))
  .map((t) => String(t).trim().toLowerCase()).filter(Boolean).flatMap((t) => TAG_RENAMES[t] || [t]))];

module.exports = { normalizeTags, TAG_RENAMES };
