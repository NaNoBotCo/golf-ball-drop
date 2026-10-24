// node tools/check.mjs [--w 390] [--look picnic] [--path index.html]
// Plays the page in headless Chrome: pulls the cord and waits for the medals, drops a lucky
// number, runs the drop, picks an amount to give, copies the account, presses "I've sent it",
// taps a medal. Prints what each answered and any page error. Exit 1 on an error.
import { createRequire } from 'module'; import path from 'path'; import fs from 'fs'; import http from 'http'; import { fileURLToPath } from 'url';
const require = createRequire('/Users/annikapeacock/Developer/claude code projects/anidoodle-motdang/package.json');
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i < 0 ? d : A[i + 1]; };
const W = +opt('--w', '390'), H = W < 700 ? 844 : 860, look = opt('--look', ''), sub = opt('--path', 'index.html'), reduced = A.includes('--calm');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ics': 'text/calendar' };
const server = http.createServer((req, res) => { let f = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SHELL = fs.readdirSync(path.join(process.env.HOME, 'Library/Caches/ms-playwright')).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
const browser = await chromium.launch({ executablePath: path.join(process.env.HOME, 'Library/Caches/ms-playwright', SHELL, 'chrome-headless-shell-mac-arm64/chrome-headless-shell') });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: W < 700, reducedMotion: reduced ? 'reduce' : 'no-preference', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/tp-em\.com|ERR_FAILED|config is not valid/.test(m.text()) && !(m.location()?.url || '').includes('motdang.net')) errs.push('console: ' + m.text()); });
page.on('requestfailed', (r) => { if (!/fonts|motdang\.net/.test(r.url())) errs.push('failed: ' + r.url()); });
const base = `http://127.0.0.1:${server.address().port}/${sub}${look ? '?look=' + look : ''}`;
await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(1500);
const toast = () => page.$eval('#toast', (t) => t.textContent);
const say = (k, v) => console.log(k.padEnd(10), v);
// the cord: 300 balls, then the medals
await page.click('#cord'); await page.waitForTimeout(reduced ? 600 : 9000); say('cord', await toast());
await page.screenshot({ path: path.join(root, `dev/out/check-hero-${W}.png`) });
// the lucky number machine
await page.locator('#luck-go').scrollIntoViewIfNeeded(); await page.click('#luck-go'); await page.waitForTimeout(reduced ? 800 : 7000);
say('luck', (await page.$eval('#luck-out', (o) => o.textContent)) + ' · num=' + (await page.$eval('#num', (i) => i.value)));
// the drop
await page.locator('#go').scrollIntoViewIfNeeded(); await page.click('#go'); await page.waitForTimeout(reduced ? 800 : 9000);
say('drop', (await page.$eval('#res', (r) => r.innerText)).replace(/\s+/g, ' '));
await page.locator('.board').screenshot({ path: path.join(root, `dev/out/check-board-${W}.png`) });
// give
await page.locator('.chips button[data-amt="5000"]').scrollIntoViewIfNeeded(); await page.click('.chips button[data-amt="5000"]'); await page.waitForTimeout(1500);
say('give', (await page.$eval('#give-say', (s) => s.innerText)).replace(/\s+/g, ' '));
say('mailto', decodeURIComponent(await page.$eval('#give-mail', (a) => a.href)).slice(0, 110).replace(/\n/g, ' / '));
await page.locator('.fill').screenshot({ path: path.join(root, `dev/out/check-give-${W}.png`) });
await page.click('.give .copy'); await page.waitForTimeout(300); say('copy', await toast() + ' · clipboard=' + (await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'n/a'))));
await page.fill('#give-amt', '2500'); await page.waitForTimeout(400); say('other', (await page.$eval('#give-say', (s) => s.innerText)).replace(/\s+/g, ' '));
await page.click('#give-sent'); await page.waitForTimeout(600); say('sent', await toast() + ' · share button=' + !!(await page.$('#give-ask')));
// prizes
await page.locator('.medal.m1').scrollIntoViewIfNeeded(); await page.click('.medal.m1'); await page.waitForTimeout(2500);
await page.locator('.prizes').screenshot({ path: path.join(root, `dev/out/check-prizes-${W}.png`) });
// languages
for (const l of ['en', 'th', 'both']) { await page.click(`.lang button[data-set="${l}"]`); }
// overflow at this width
say('overflow', await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map((e) => e.tagName + '.' + e.className).join(' ') || 'none'));
say('errors', errs.length ? errs.join('\n') : 'none');
await browser.close(); server.close();
process.exit(errs.length ? 1 : 0);
