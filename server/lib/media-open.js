// Which pictures of the media library everyone may see, without the minutes password (2026-11-20): the owner's own
// drawings and pictures made purely with AI — nobody else's work is in them. A picture carries this as `open: true`
// in media-library.json; the CMS shows it as a tick ("Visible to everyone") and the owner can change it. A new upload
// is ticked when its credits say own work or AI (ownWork); everything that names another artist, a book, an artbook
// or a game stays for the group. The mark itself lives with the picture in the Grimoire (lib/grimoire-images.js).
const OWN = /^\s*(myself|me|own (work|drawing)|drawn by (me|myself|pio\b)|ai[ -]generated)\b/i;
// AI work "based on" something: open only when that something is the owner's own or no one's work (a real landscape)
const OTHERS = /design from|artbook|art of|\bfrom\s*["“]|\bart by\b|\bsketch by\b|\bby\s+(?!pio\b)[A-Z]|wizards|wotc|square enix|copy of|pinterest|artstation|https?:\/\//i;
const ownWork = (credits) => OWN.test(credits || '') && !OTHERS.test(credits || '');

module.exports = { ownWork };
