// Builds dist/: a plain static site for any host (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
// Works on Windows, macOS and Linux:  node scripts/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
fs.writeFileSync(path.join(dist, 'index.html'),
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
  '</head>\n<body>\n' + page + '\n</body>\n</html>\n');
for (const dir of ['js', 'vendor']) fs.cpSync(path.join(root, dir), path.join(dist, dir), { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('built dist/');
