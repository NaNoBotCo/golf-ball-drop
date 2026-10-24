// The doodle dingbats this page uses: the kit's core and the families its names live in,
// minified into js/dingbats.js. Source: ../doodle-dingbats/src. Run after that set changes.
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url'; import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, '../doodle-dingbats/src');
const esb = path.resolve(ROOT, '../anidoodle-motdang/node_modules/.bin/esbuild');
const used = new Set();
for (const f of ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f)]) {
  if (f.endsWith('dingbats.js')) continue;
  for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/data-dingbat="([a-z0-9-]+)"|dingbat\(['"]([a-z0-9-]+)['"]/g)) used.add(m[1] || m[2]);
}
const fams = new Map();
for (const f of fs.readdirSync(path.join(SRC, 'fam')).filter((f) => f.endsWith('.js'))) for (const m of fs.readFileSync(path.join(SRC, 'fam', f), 'utf8').matchAll(/\badd\('([a-z0-9-]+)'/g)) fams.set(m[1], f);
const need = [...new Set([...used].map((n) => { if (!fams.has(n)) throw new Error('no dingbat ' + n); return fams.get(n); }))].sort();
const tmp = path.join(ROOT, 'dev/out/dingbats-src.js'); fs.mkdirSync(path.dirname(tmp), { recursive: true });
// keep each family's helpers, drop the D.add blocks this page does not use
function trim(src) {
  let out = '', i = 0;
  const re = /D\.add\('([a-z0-9-]+)',\s*\{/g; let m;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length - 1, depth = 0, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
      if (c === "'" || c === '"' || c === '`') q = c; else if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
    }
    const end = src.indexOf(';', j) + 1;
    if (end <= m.index) throw new Error('could not find the end of ' + m[1]);
    out += src.slice(i, m.index) + (used.has(m[1]) ? src.slice(m.index, end) : '');
    i = end; re.lastIndex = end;
  }
  return out + src.slice(i);
}
fs.writeFileSync(tmp, [fs.readFileSync(path.join(SRC, 'core.js'), 'utf8'), ...need.map((f) => trim(fs.readFileSync(path.join(SRC, 'fam', f), 'utf8')))].join('\n'));
execFileSync(esb, [tmp, '--minify', '--outfile=' + path.join(ROOT, 'js/dingbats.js'), '--log-level=warning']);
console.log('js/dingbats.js', (fs.statSync(path.join(ROOT, 'js/dingbats.js')).size / 1024).toFixed(0) + ' KB ·', used.size, 'names from', need.join(' '));
