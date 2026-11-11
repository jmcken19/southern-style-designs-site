// Southern Style Designs – layout (header, menu, footer, concept banner). One-page site: the menu links to sections
// on the home page. Every visible word goes through t() (src/lib/text.mjs); the words live in content/text.json /
// content/site.json, so the owner can change them in the editor.
import { e } from '../lib/core.mjs';
import { headTags, testingBanner } from '../parts/index.mjs';
import { t } from '../lib/text.mjs';

/** Main menu: anchors on the home page (client.config.json → nav: [{ "href", "key" }], words = text.json "nav.<key>"). */
export function nav(ctx) {
  return ctx.config.nav || [];
}

export const phoneHref = (site) => site.phoneHref || (site.phone ? 'tel:' + site.phone.replace(/[^\d+]/g, '') : '');

export function layout(ctx, { path, title, description, body }) {
  const { site, url } = ctx;
  const fullTitle = path === '/' ? (site.homeTitle || site.name) : `${title} | ${site.name}`;
  const items = nav(ctx).map((n) => `<li><a href="${url(n.href)}">${t(ctx, `nav.${n.key}`)}</a></li>`).join('');
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(fullTitle)}</title>
${ctx.preview ? '' : '<meta name="robots" content="noindex, nofollow">'}
<meta name="description" content="${e(description || site.metaDescription || '')}">
<meta property="og:title" content="${e(fullTitle)}">
<meta property="og:description" content="${e(description || site.metaDescription || '')}">
<meta name="theme-color" content="${e(ctx.config.themeColor || '#2e2a25')}">
<link rel="preload" href="${url('/assets/fonts/cormorant-garamond-latin-500-normal.woff2')}" as="font" type="font/woff2" crossorigin>
${headTags(ctx, { path })}
<script src="${url('/assets/js/client.js')}?v=${ctx.buildId}" defer></script>
</head>
<body>
<a class="skip" href="#main">${t(ctx, 'layout.skip')}</a>
${testingBanner(ctx)}
<div class="concept-bar" role="note" data-concept-bar><p>${t(ctx, 'concept.banner')}</p><button type="button" class="concept-bar__hide" data-concept-hide>${t(ctx, 'concept.hide')}</button></div>
<header class="site-header">
  <div class="wrap site-header__in">
    <a class="brand" href="${url('/')}"><span class="brand__name">${t(ctx, 'site.name')}</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">${t(ctx, 'layout.menu')}</button>
    <nav id="site-nav" class="site-nav" aria-label="Main"><ul>${items}</ul></nav>
    ${site.phone ? `<a class="header-call" href="${e(phoneHref(site))}">${t(ctx, 'site.phone')}</a>` : ''}
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap site-footer__in">
    <p class="site-footer__name">${t(ctx, 'site.name')}</p>
    ${site.phone ? `<p><a href="${e(phoneHref(site))}">${t(ctx, 'site.phone')}</a></p>` : ''}
    ${site.address ? `<p>${t(ctx, 'site.address')}</p>` : ''}
    <p class="site-footer__small">© ${new Date().getFullYear()} ${t(ctx, 'site.name')} · ${t(ctx, 'footer.credit')}</p>
  </div>
</footer>
</body>
</html>`;
}
