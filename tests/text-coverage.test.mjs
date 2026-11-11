// "Every visible word is editable" – the guarantee behind the owner editor's text editing.
// Renders EVERY page of this client's site the way the editor shows it (edit mode) and fails when any visible
// words are not inside a data-edit="text" element (drawn by t()/tBlock()/tList() from src/lib/text.mjs) or an element
// another editor owns (ownedBy(ctx, 'reviews') – review words; ownedBy(ctx, 'preview') – the testing banner).
// So a new page, part or layout that hard-codes words fails here, before it can be deployed.
// Also checks: every marked key really exists in content/text.json / site.json, and the real website has no marks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes, renderRoute, notFoundHtml } from '../src/site/routes.mjs';
import { textEntries, cleanText, textMeta } from '../src/lib/text.mjs';
import { uncoveredText, textMarks } from './html-text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const config = await readJson('client.config.json');
const site = await readJson('content/site.json');
const text = await readJson('content/text.json');
const reviews = existsSync(join(root, 'content/reviews.json')) ? (await readJson('content/reviews.json')).items || [] : [];

function pagesOf(cfg, editMode) {
  const ctx = { site, config: cfg, text, reviews, preview: true, editMode, siteUrl: '', buildId: 'test', url: (p) => p };
  return [...routes(ctx).map((r) => ({ path: r.path, html: renderRoute(ctx, r) })), { path: '/404', html: notFoundHtml(ctx) }];
}

function check(cfg, label) {
  const entries = textEntries(text, site);
  const problems = [];
  const used = new Set();
  for (const { path, html } of pagesOf(cfg, true)) {
    for (const u of uncoveredText(html)) problems.push(`${label}${path}: "${u.text}" (in ${u.where}) can't be changed by the owner – put it through t(ctx, '<key>') with the words in content/text.json (or, if another editor owns it, mark it with ownedBy(ctx, '<kind>'))`);
    for (const m of textMarks(html)) {
      used.add(m.key);
      if (!(m.key in entries)) problems.push(`${label}${path}: text key "${m.key}" is not in content/text.json / site.json siteFields`);
      else if (Array.isArray(entries[m.key]) !== !!m.multi) problems.push(`${label}${path}: "${m.key}" – a list of paragraphs needs tBlock()/tList(), one line needs t()`);
    }
  }
  return { problems, used };
}

test('every visible word on every page can be changed by the owner (edit mode marks it)', () => {
  const { problems, used } = check(config, '');
  assert.deepEqual(problems, [], '\n' + problems.join('\n'));
  assert.ok(used.size > 5, 'pages use t() for their words');
});

test('… also with features switched off (slideshow, reviews, contact form) – any client made from this template', () => {
  const f = config.features || {};
  for (const off of ['slideshow', 'reviews', 'contactForm']) {
    const cfg = { ...config, features: { ...f, [off]: false } };
    const { problems } = check(cfg, `[${off} off] `);
    assert.deepEqual(problems, [], '\n' + problems.join('\n'));
  }
});

test('the real website and the testing link carry no edit marks; the words are the same as in edit mode', () => {
  for (const preview of [false, true]) {
    const ctx = { site, config, text, reviews, preview, editMode: false, siteUrl: '', buildId: 'test', url: (p) => p };
    for (const r of routes(ctx)) assert.doesNotMatch(renderRoute(ctx, r), /data-edit|data-text-/, r.path);
  }
});

test('every word in content/text.json passes the editor\'s own checks (so the owner can save it unchanged)', () => {
  for (const [k, v] of Object.entries(textEntries(text, site))) {
    const meta = { multi: Array.isArray(v) ? 'p' : false, ...textMeta(text, k) };
    const r = cleanText(v, meta);
    assert.ok(!r.error, `${k}: ${r.error}`);
    assert.deepEqual(r.value, v, `${k}: the stored words are already tidy (no double spaces, no HTML)`);
  }
});

test('the coverage check itself: hard-coded words are caught; marked, owned, hidden and non-word text is fine', () => {
  const html = `<html><head><title>T</title><style>p{}</style></head><body><h1>Hard coded</h1><p data-edit="text" data-edit-key="a.b">ok</p>
<div data-edit-owned="reviews"><p>Review words</p></div><div aria-hidden="true">spam trap</div><p>© 2026 · 704-555-0100</p><script>var x = "words";</script>
<a href="/">Link <span data-edit="text">ok</span></a></body></html>`;
  assert.deepEqual(uncoveredText(html).map((u) => u.text), ['Hard coded', 'Link']);
});
