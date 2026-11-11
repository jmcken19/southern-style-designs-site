// STARTER LAYOUT – replace for each client so the new site matches THEIR current website
// (see docs/PLAYBOOK.md, step 3 "Rebuild"). Keep the pieces marked "keep" – they power the editor,
// the testing banner, SEO and accessibility. Every visible word goes through t() (src/lib/text.mjs) so the owner
// can change it in the editor; the words live in content/text.json / content/site.json.
import { e } from '../lib/core.mjs';
import { headTags, testingBanner } from '../parts/index.mjs';
import { t, tText } from '../lib/text.mjs';

/** Main menu. Paths should match the client's OLD site addresses so Google and old links keep working.
 *  Each item's words are content/text.json → "nav.<key>" (client.config.json → nav: [{ "href", "key" }] to change the list). */
export function nav(ctx) {
  return ctx.config.nav || [
    { href: '/', key: 'home' },
    { href: '/about/', key: 'about' },
    ...(ctx.config.features?.reviews !== false ? [{ href: ctx.config.reviewsPath || '/reviews/', key: 'reviews' }] : []),
    { href: '/contact/', key: 'contact' },
  ];
}

export function layout(ctx, { path, title, description, body }) {
  const { site, url } = ctx;
  const fullTitle = path === '/' ? (site.homeTitle || site.name) : `${title} | ${site.name}`;
  const items = nav(ctx).map((n) => {
    const current = n.href === '/' ? path === '/' : path.startsWith(n.href);
    return `<li><a href="${url(n.href)}"${current ? ' aria-current="page"' : ''}>${t(ctx, `nav.${n.key}`)}</a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(fullTitle)}</title>
<meta name="description" content="${e(description || site.metaDescription || '')}">
<meta property="og:title" content="${e(fullTitle)}">
<meta property="og:description" content="${e(description || site.metaDescription || '')}">
<meta name="theme-color" content="${e(ctx.config.themeColor || '#1f2a44')}">
${headTags(ctx, { path })}
</head>
<body>
<a class="skip" href="#main">${t(ctx, 'layout.skip')}</a>
${testingBanner(ctx)}
<header class="site-header">
  <div class="wrap site-header__in">
    <a class="brand" href="${url('/')}">${site.logo ? `<img src="${url(site.logo)}" alt="${e(tText(ctx, 'site.name'))}" height="48">` : `<span class="brand__name">${t(ctx, 'site.name')}</span>`}</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">${t(ctx, 'layout.menu')}</button>
    <nav id="site-nav" class="site-nav" aria-label="Main"><ul>${items}</ul></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="site-footer__name">${t(ctx, 'site.name')}</p>
    ${site.phone ? `<p><a href="${e(site.phoneHref || 'tel:' + site.phone.replace(/[^\d+]/g, ''))}">${t(ctx, 'site.phone')}</a></p>` : ''}
    ${site.email ? `<p><a href="mailto:${e(site.email)}">${t(ctx, 'site.email')}</a></p>` : ''}
    ${site.address ? `<p>${t(ctx, 'site.address')}</p>` : ''}
    <p class="site-footer__small">© ${new Date().getFullYear()} ${t(ctx, site.legalName ? 'site.legalName' : 'site.name')}</p>
  </div>
</footer>
</body>
</html>`;
}
