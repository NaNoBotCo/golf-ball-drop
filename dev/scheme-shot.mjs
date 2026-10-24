import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scheme, sel, out] = process.argv.slice(2);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.body.scrollHeight); for (let y = 0; y < total; y += 500) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(100); }
await page.addStyleTag({ content: '.dock{display:none!important}.top{position:static!important}' }); await page.waitForTimeout(800);
const parts = []; for (const s of sel.split(',')) { const el = await page.$(s); if (el) parts.push((await el.screenshot()).toString('base64')); }
const p2 = await browser.newPage({ viewport: { width: 400 * parts.length + 20, height: 600 } });
await p2.setContent(`<body style="margin:0;background:#777;display:flex;gap:10px;padding:5px;align-items:flex-start">${parts.map((b) => `<img style="width:390px" src="data:image/png;base64,${b}">`).join('')}</body>`);
await p2.screenshot({ path: out, fullPage: true }); await browser.close(); server.close(); console.log(out);
