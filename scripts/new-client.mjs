#!/usr/bin/env node
// Fill in a new client's details. Run in a fresh copy of the template:  npm run new-client
// Asks a few questions, writes client.config.json + the basics in content/site.json,
// then writes the Cloudflare config files (npm run configure). Safe to run again.
// Non-interactive: npm run new-client -- --name "Acme Plumbing" --domain www.acmeplumbing.com --repo you/acme-site --email owner@acme.com --phone "(704) 555-0100"
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { slugify } from '../src/lib/core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = join(root, 'client.config.json');
const sitePath = join(root, 'content/site.json');
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const site = JSON.parse(await readFile(sitePath, 'utf8'));

const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const interactive = !args.name;
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
const ask = async (key, q, def = '') => {
  if (args[key] !== undefined) return args[key];
  if (!rl) return def;
  const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
};

const name = await ask('name', 'Business name (as on their current website)', cfg.client.name === 'Example Business' ? '' : cfg.client.name);
if (!name) { console.error('A business name is required.'); process.exit(1); }
const slug = slugify(await ask('slug', 'Short id (lowercase, dashes)', slugify(name)));
let domain = (await ask('domain', 'Main web address (e.g. www.acmeplumbing.com)', cfg.domain.main === 'www.example.com' ? '' : cfg.domain.main)).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
const apex = domain.replace(/^www\./, '');
const repo = await ask('repo', 'GitHub repo for this client (owner/name)', cfg.github.repo.startsWith('OWNER/') ? `jmcken19/${slug}-site` : cfg.github.repo);
const email = await ask('email', 'Owner email (contact + where form messages go)', site.email === 'owner@example.com' ? '' : site.email);
const phone = await ask('phone', 'Business phone (as shown on their site)', site.phone === '(555) 555-0100' ? '' : site.phone);
const ownerName = await ask('owner', "Owner's name", cfg.owner.name === 'Owner Name' ? '' : cfg.owner.name);
const helper = await ask('helper', 'Your name (shown to the owner as their help contact)', cfg.owner.supportName);
const yes = (v) => /^(y|yes|true|1)$/i.test(String(v));
const slideshow = yes(await ask('slideshow', 'Homepage photo slideshow? (y/n)', cfg.features.slideshow ? 'y' : 'n'));
const reviews = yes(await ask('reviews', 'Client reviews? (y/n)', cfg.features.reviews ? 'y' : 'n'));
const form = yes(await ask('form', 'Contact form? (y/n)', cfg.features.contactForm ? 'y' : 'n'));
rl?.close();

cfg.client = { slug, name };
cfg.domain = { main: domain || 'www.example.com', apex: apex || 'example.com' };
cfg.github = { repo, pagesPath: '/' + repo.split('/')[1] };
cfg.cloudflare = { ...cfg.cloudflare, siteWorker: `${slug}-site`, editorWorker: `${slug}-editor`, d1Name: `${slug}-editor` };
cfg.owner = { name: ownerName || cfg.owner.name, supportName: helper };
cfg.features = { slideshow, reviews, contactForm: form };
if (cfg.photoSpots?.headshot && ownerName) { cfg.photoSpots.headshot.newAlt = ownerName; cfg.photoSpots.headshot.defaults.alt = ownerName; }
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

site.name = name;
if (email) { site.email = email; site.contactFormTo = email; }
if (phone) site.phone = phone;
if (!slideshow) { delete site.heroSlides; delete site.heroSlideSeconds; delete site.heroFade; delete site.heroAutoplay; }
await writeFile(sitePath, JSON.stringify(site, null, 2) + '\n');

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
pkg.name = `${slug}-site`; pkg.description = `${name} website + owner editor (made from client-site-template)`;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

execFileSync(process.execPath, [join(root, 'scripts/configure.mjs')], { stdio: 'inherit' });
console.log(`\nDone. ${name} is set up in client.config.json and content/site.json.
Next: docs/PLAYBOOK.md step 2 (copy their content) and step 3 (rebuild their design in src/site/ + site.css).`);
