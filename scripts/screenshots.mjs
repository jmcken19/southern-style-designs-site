#!/usr/bin/env node
// Visual check: builds the site, opens every page at phone + laptop size in Chrome, saves full-page screenshots,
// and reports problems a human would notice: page errors, broken images, sideways scrolling, tiny tap targets.
//   npm run shots                 → screenshots/<page>-phone.png and -laptop.png, report in the terminal
//   npm run shots -- /about/      → just that page
// Needs Google Chrome (set CHROME_PATH if it isn't at the usual place).
import puppeteer from 'puppeteer-core';
import { serveDir } from './lib/static-server.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'screenshots');
const only = process.argv.slice(2).filter((a) => a.startsWith('/'));
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!CHROME) { console.error('Chrome not found – set CHROME_PATH.'); process.exit(1); }

execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit', env: { ...process.env, OUT_DIR: dist } });
const { routes } = await import('../src/site/routes.mjs');
const config = JSON.parse(await readFile(join(root, 'client.config.json'), 'utf8'));
const site = JSON.parse(await readFile(join(root, 'content/site.json'), 'utf8'));
const reviews = existsSync(join(root, 'content/reviews.json')) ? JSON.parse(await readFile(join(root, 'content/reviews.json'), 'utf8')).items : [];
let paths = routes({ config, site, reviews }).map((r) => r.path).filter((p) => !/\/reviews\/[^/]+\/$/.test(p) || p === (config.reviewsPath || '/reviews/'));
if (only.length) paths = only;

const server = await serveDir(dist);
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const sizes = { phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, laptop: { width: 1366, height: 768 } };
let problems = 0;
for (const path of paths) {
  for (const [name, viewport] of Object.entries(sizes)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (e) => errors.push('script error: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) errors.push(`${r.status()} ${r.url().replace(base, '')}`); });
    await page.goto(base + path, { waitUntil: 'networkidle0' });
    // Scroll through so lazy images and fade-ins load.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await new Promise((r) => setTimeout(r, 400));
    const found = await page.evaluate((isPhone) => {
      const out = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px wide)`);
      for (const img of document.images) if (img.complete && img.naturalWidth === 0) out.push('broken image: ' + img.getAttribute('src'));
      for (const img of document.images) if (!img.hasAttribute('alt')) out.push('image without alt: ' + img.getAttribute('src'));
      if (isPhone) for (const el of document.querySelectorAll('a.btn, button, input, select, textarea')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.height < 40 && !el.closest('.cform__trap') && !el.matches('.sr-focus, .skip') /* only shown (full size) when focused */ && getComputedStyle(el).visibility !== 'hidden') out.push(`small tap target (${Math.round(r.height)}px): ${(el.innerText || el.name || el.tagName).trim().slice(0, 40)}`);
      }
      if (!document.querySelector('h1')) out.push('no <h1> on the page');
      return out;
    }, name === 'phone');
    const file = join(outDir, `${path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '_')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const all = [...errors, ...found];
    problems += all.length;
    console.log(`${all.length ? '✗' : '✓'} ${path} (${name})  → ${file.replace(root + '/', '')}`);
    for (const p of all) console.log('    - ' + p);
    await page.close();
  }
}
await browser.close(); server.close();
console.log(problems ? `\n${problems} problem(s) found.` : '\nNo problems found. Now LOOK at the screenshots – the tool can\'t judge design.');
process.exitCode = problems ? 1 : 0;
