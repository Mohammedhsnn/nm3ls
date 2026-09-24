// Static export of the theme preview, for sharing on GitHub Pages.
//
// Starts dev/server.mjs, crawls every page, rewrites links for the Pages base
// path and writes plain HTML to _site/. The Shopify cart endpoints don't exist
// on a static host, so dev/static-shim.js replaces them with a localStorage
// cart that renders the same drawer markup.
//
//   BASE=/nm3ls/ npm run build

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THEME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(THEME, '_site');
const BASE = (process.env.BASE || '/nm3ls/').replace(/\/?$/, '/');
const PORT = 9393;
const ORIGIN = `http://localhost:${PORT}`;

const server = spawn(process.execPath, [path.join(THEME, 'dev', 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => { if (String(d).includes('preview →')) resolve(); });
  server.on('exit', (code) => reject(new Error(`preview server exited with ${code}`)));
});

try {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const rewrite = (html) => html
    // live reload only makes sense locally
    .replace(/<script>new EventSource\('\/__livereload'\)[^<]*<\/script>/, '')
    // root-relative links, assets and form actions -> Pages base path
    .replace(/(href|src|action)="\/(?!\/)/g, `$1="${BASE}`)
    .replace(/"root":"\/"|root: "\/"/g, (m) => m.replace('"/"', JSON.stringify(BASE)))
    .replace('</body>', `<script>window.STATIC_BASE=${JSON.stringify(BASE)}</script><script src="${BASE}assets/static-shim.js"></script>\n</body>`);

  const seen = new Set();
  const queue = ['/', '/collections', '/collections/all', '/cart', '/search', '/account/login', '/account/register', '/404-page'];
  while (queue.length) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    const res = await fetch(ORIGIN + route);
    const html = await res.text();
    const file = route === '/404-page' ? path.join(OUT, '404.html') : path.join(OUT, route, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rewrite(html));
    for (const m of html.matchAll(/href="(\/(?:products|collections|pages|blogs)\/[^"?#]+)"/g)) {
      if (!seen.has(m[1])) queue.push(m[1]);
    }
  }

  // Theme assets + the static cart shim
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(THEME, 'assets'))) fs.copyFileSync(path.join(THEME, 'assets', f), path.join(OUT, 'assets', f));
  fs.copyFileSync(path.join(THEME, 'dev', 'static-shim.js'), path.join(OUT, 'assets', 'static-shim.js'));

  // Catalog the shim needs to render bag lines
  const catalog = await (await fetch(`${ORIGIN}/__catalog.json`)).json();
  for (const v of [...Object.values(catalog.variants), ...catalog.products]) v.url = BASE + v.url.replace(/^\//, "");
  fs.writeFileSync(path.join(OUT, 'assets', 'catalog.json'), JSON.stringify(catalog));

  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`  Built ${seen.size} pages into _site/ (base ${BASE})`);
} finally {
  server.kill();
}
