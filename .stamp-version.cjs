// Версія = хеш контенту гри (як у MoneyMe .build-pwa.cjs). Будь-яка зміна коду
// → новий хеш → видно, який білд підтягнувся на GitHub Pages.
// Запуск: node .stamp-version.cjs  (перед commit/push гри).
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const dir = path.join(__dirname, 'web');
const files = ['game.js', 'sprites.js', 'mapgen.js', 'audio.js', 'net.js'];
const h = crypto.createHash('sha256');
for (const f of files) h.update(fs.readFileSync(path.join(dir, f)));
const build = h.digest('hex').slice(0, 10);
const idx = path.join(dir, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace(/(<div id="version"[^>]*>)версія [^<]*(<\/div>)/, `$1версія ${build}$2`);
fs.writeFileSync(idx, html);
console.log('версія збірки:', build);
