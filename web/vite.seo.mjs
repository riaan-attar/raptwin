// Build step: writes a crawlable static copy of index.html for every tab and docs page, plus a
// sitemap that lists those path URLs. Search engines ignore "#fragment" routes, so without this
// only the home page is indexable. Each copy has its own title, description, canonical and
// Open Graph tags, a JSON-LD page entry naming the author, and plain links to its siblings.
import { AUTHOR, DOCS, SITE, TABS } from './seo.config.mjs'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function setMeta(html, attr, name, content) {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`, 's')
  return re.test(html) ? html.replace(re, `$1${esc(content)}$2`) : html
}

function renderPage(base, page) {
  const url = `${SITE}${page.path}`
  const full = `${page.title} | RAP Twin by ${AUTHOR}`
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(full)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  html = setMeta(html, 'name', 'description', page.description)
  if (page.keywords) html = html.replace(/(<meta\s+name="keywords"\s+content=")([^"]*)(")/s, `$1${esc(page.keywords)}, $2$3`)
  html = setMeta(html, 'property', 'og:title', `${page.title} | RAP Twin by ${AUTHOR}`)
  html = setMeta(html, 'property', 'og:description', page.description)
  html = setMeta(html, 'property', 'og:url', url)
  html = setMeta(html, 'name', 'twitter:title', `${page.title} | RAP Twin by ${AUTHOR}`)
  html = setMeta(html, 'name', 'twitter:description', page.description)

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.kind === 'docs' ? 'TechArticle' : 'WebPage',
        '@id': `${url}#page`,
        url,
        name: full,
        headline: page.title,
        description: page.description,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#software` },
        author: { '@id': `${SITE}/#riaan-attar` },
        publisher: { '@id': `${SITE}/#riaan-attar` },
        dateModified: page.lastmod,
        image: `${SITE}/og-image.png`,
        breadcrumb: { '@id': `${url}#breadcrumbs` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'RAP Twin', item: `${SITE}/` },
          ...(page.kind === 'docs' ? [{ '@type': 'ListItem', position: 2, name: 'Documentation', item: `${SITE}/docs/introduction/` }] : []),
          { '@type': 'ListItem', position: page.kind === 'docs' ? 3 : 2, name: page.title, item: url },
        ],
      },
    ],
  }
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  </head>`)

  // Land on the right in-app view: the SPA routes on the hash.
  const boot = `<script>if(!location.hash)history.replaceState(null,'',location.pathname+'#${page.hash}')</script>`
  html = html.replace('<!-- Primary Title & Verification -->', `${boot}\n    <!-- Primary Title & Verification -->`)

  const links = (list, prefix) => list.map((p) => `<li><a href="${prefix}${p.id}/">${esc(p.title)}</a></li>`).join('')
  const noscript = `<noscript>
      <div style="padding:2.5rem;max-width:900px;margin:0 auto;font-family:system-ui,sans-serif;color:#e7eef7;background:#0b0f14;line-height:1.6">
        <h1>${esc(page.title)} — RAP Twin</h1>
        <p>${esc(page.description)}</p>
        <p><strong>Architected and developed by ${AUTHOR}.</strong> <a href="${SITE}/" style="color:#6fc1ff">RAP Twin home</a> · <a href="https://github.com/riaan-attar/raptwin" style="color:#6fc1ff">GitHub</a></p>
        <h2>Dashboard</h2><ul>${links(TABS, '/')}</ul>
        <h2>Documentation</h2><ul>${links(DOCS, '/docs/')}</ul>
      </div>
    </noscript>`
  return html.replace(/<noscript>[\s\S]*?<\/noscript>/, noscript)
}

export function seoPages() {
  let outDir = 'dist'
  return {
    name: 'raptwin-seo-pages',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    async closeBundle() {
      const { readFile, writeFile, mkdir } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const base = await readFile(join(outDir, 'index.html'), 'utf8')
      const lastmod = new Date().toISOString().slice(0, 10)
      const pages = [
        ...TABS.map((t) => ({ ...t, kind: 'tab', path: `/${t.id}/`, hash: t.hash, lastmod })),
        ...DOCS.map((d) => ({ ...d, kind: 'docs', path: `/docs/${d.id}/`, hash: `docs/${d.id}`, lastmod })),
      ]
      for (const page of pages) {
        const dir = join(outDir, page.path)
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'index.html'), renderPage(base, page))
      }
      const entry = (loc, priority, freq) =>
        `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
      const urls = [
        entry('/', '1.0', 'daily'),
        ...TABS.map((t) => entry(`/${t.id}/`, '0.85', 'weekly')),
        ...DOCS.map((d) => entry(`/docs/${d.id}/`, '0.70', 'monthly')),
      ]
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
      await writeFile(join(outDir, 'sitemap.xml'), xml)
    },
  }
}
