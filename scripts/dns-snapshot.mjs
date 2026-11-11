#!/usr/bin/env node
// Record a domain's DNS BEFORE changing anything (playbook step 7). Writes docs/DNS-BEFORE.md.
// Follows SPF "include:" names on the client's own domain (GoDaddy hides email SPF in "_spfm" helper records –
// Cloudflare's import missed one on Dan's domain) and checks common DKIM/verification names.
//   npm run dns:snapshot -- example.com
// Uses Google's public DNS-over-HTTPS (dns.google). Read-only: changes nothing.
import { writeFile } from 'node:fs/promises';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = { 1: 'A', 5: 'CNAME', 2: 'NS', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA' };
export async function resolve(name, type, fetchImpl = fetch) {
  const r = await fetchImpl(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  const j = await r.json();
  return (j.Answer || []).filter((a) => a.name.replace(/\.$/, '').toLowerCase() === name.toLowerCase() || a.type === 5).map((a) => ({ name: a.name.replace(/\.$/, ''), type: TYPES[a.type] || a.type, data: a.data }));
}

export async function snapshot(domain, fetchImpl = fetch) {
  const names = [domain, `www.${domain}`, `_dmarc.${domain}`, `autodiscover.${domain}`, `mail.${domain}`, `email.${domain}`,
    ...['google', 'selector1', 'selector2', 'k1', 's1', 's2', 'default'].map((s) => `${s}._domainkey.${domain}`)];
  const rows = []; const seen = new Set();
  const add = (list) => { for (const x of list) { const k = `${x.name}|${x.type}|${x.data}`; if (!seen.has(k)) { seen.add(k); rows.push(x); } } };
  for (const n of names) for (const t of ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'CAA']) add(await resolve(n, t, fetchImpl));
  // Follow SPF includes that live on this domain (the hidden ones).
  const queue = rows.filter((r) => r.type === 'TXT' && /v=spf1/i.test(r.data)).map((r) => r.data);
  const followed = new Set();
  while (queue.length) {
    for (const m of queue.shift().matchAll(/include:([^\s"]+)/gi)) {
      const inc = m[1].toLowerCase();
      if (!inc.endsWith(domain) || followed.has(inc)) continue;
      followed.add(inc);
      const got = await resolve(inc, 'TXT', fetchImpl);
      add(got); for (const g of got) if (/v=spf1/i.test(g.data)) queue.push(g.data);
    }
  }
  return { rows, hiddenSpf: [...followed] };
}

// Run directly (works on Windows too).
if (process.argv[1] && import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href) {
const domain = (process.argv[2] || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { console.error('Usage: npm run dns:snapshot -- example.com'); process.exit(1); }
  const { rows, hiddenSpf } = await snapshot(domain);
  const ns = rows.filter((r) => r.type === 'NS' && r.name === domain).map((r) => r.data).join(', ');
  const mx = rows.filter((r) => r.type === 'MX');
  const md = `# DNS before the switch – ${domain}\n\nTaken ${new Date().toISOString()} via dns.google. **Every record below must exist in Cloudflare before nameservers change.**\n\n` +
    `* Nameservers now: ${ns || '(none found)'}\n* Email (MX): ${mx.length ? mx.map((r) => r.data).join(' · ') : 'none – no email on this domain?'}\n` +
    `* Hidden SPF helper records followed: ${hiddenSpf.length ? hiddenSpf.join(', ') + ' ⚠️ make sure these are copied' : 'none'}\n\n` +
    `| Name | Type | Value |\n|---|---|---|\n${rows.map((r) => `| ${r.name} | ${r.type} | \`${String(r.data).replace(/\|/g, '\\|')}\` |`).join('\n')}\n\n` +
    `Not visible from outside (check the registrar's DNS page too): other custom subdomains, SRV records for phones/Teams, any records the registrar adds itself.\n`;
  await writeFile(join(root, 'docs/DNS-BEFORE.md'), md);
  console.log(md);
}
