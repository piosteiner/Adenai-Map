// Links Adenai's characters with the name list in the Grimoire (lib/name-links.js). Safe to run again.
//   node scripts/link-names.js [--dry]
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { linkCharacters } = require('../lib/name-links');

const dry = process.argv.includes('--dry');
const { characters } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/characters.json'), 'utf8'));
linkCharacters(characters, { dry, note: 'linked by name (scripts/link-names.js)' }).then((r) => {
    r.log.forEach((l) => console.log(l));
    console.log(`${dry ? '(dry run) ' : ''}${r.linked} marked uses linked, ${r.added} uses added, ${r.kept} already linked`);
}).catch((e) => { console.error(e.message); process.exit(1); });
