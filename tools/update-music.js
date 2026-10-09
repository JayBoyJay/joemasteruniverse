// Rebuilds music/music.json from the files in music/background and music/intro.
// GitHub Pages can't list folders, so the game reads this file instead.
// Runs automatically on GitHub (see .github/workflows/music.yml); run it yourself with: node tools/update-music.js
'use strict';
const fs = require('fs');
const path = require('path');

const MUSIC = path.join(__dirname, '..', 'music');
const EXT = new Set(['.mp3', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.flac', '.webm']);
const out = {};
for (const d of ['background', 'intro']) {
  const dir = path.join(MUSIC, d);
  fs.mkdirSync(dir, { recursive: true });
  out[d] = fs.readdirSync(dir).filter(f => EXT.has(path.extname(f).toLowerCase())).sort()
    .map(f => `music/${d}/${encodeURIComponent(f)}`);
}
const file = path.join(MUSIC, 'music.json');
const text = JSON.stringify(out, null, 2) + '\n';
const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (before !== text) { fs.writeFileSync(file, text); console.log('Updated music/music.json'); }
else console.log('music/music.json already up to date');
console.log(`  ${out.background.length} background, ${out.intro.length} intro`);
