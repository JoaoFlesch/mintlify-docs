#!/usr/bin/env node
// Gera a documentação do Trackup em HTML estático, sem dependências.
// Uso: node site/build.mjs            → site/dist/<caminho>/index.html
//      node site/build.mjs --serve    → gera e abre um servidor local em http://localhost:4321
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { icon } from './src/icons.mjs';
import { buildApiPages } from './src/api.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const SITE = {
	name: 'Trackup Docs',
	url: 'https://docs.trackup.me',
	app: 'https://dash.trackup.me',
	home: 'https://trackup.me',
};

const read = p => readFileSync(p, 'utf8');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = html => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
	.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
	.replace(/\s+/g, ' ').trim();
export function slugify(s) {
	return strip(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const urlOf = slug => (slug === 'index' ? '/' : '/' + slug);

/* ---------- Leitura das páginas ---------- */
function parsePage(file) {
	const raw = read(file);
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	const meta = {};
	if (m) {
		for (const line of m[1].split('\n')) {
			const i = line.indexOf(':');
			if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
		}
	}
	return { meta, body: m ? raw.slice(m[0].length) : raw };
}

/* ---------- Componentes ---------- */
const attrs = s => {
	const o = {};
	for (const m of (s || '').matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) o[m[1]] = m[2];
	return o;
};
let currentSlug = '';
const shotsTodo = [];
const CALLOUT_ICON = { note: 'info', tip: 'lightbulb', warning: 'alert', danger: 'ban' };

function expand(html) {
	// Bloco de código: conteúdo literal, escapado
	html = html.replace(/<code-block([^>]*)>\n?([\s\S]*?)\n?<\/code-block>/g, (_, a, code) => {
		const { title, lang } = attrs(a);
		const head = title ? `<div class="code-head"><span>${esc(title)}</span></div>` : '';
		return `<div class="code">${head}<pre><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(code)}</code></pre></div>`;
	});
	html = html
		.replace(/<steps>/g, '<ol class="steps">').replace(/<\/steps>/g, '</ol>')
		.replace(/<step([^>]*)>/g, (_, a) => `<li><span class="step-title">${esc(attrs(a).title)}</span>`).replace(/<\/step>/g, '</li>')
		.replace(/<callout([^>]*)>/g, (_, a) => {
			const t = attrs(a).type || 'note';
			return `<div class="callout ${t}">${icon(CALLOUT_ICON[t] || 'info')}<div>`;
		}).replace(/<\/callout>/g, '</div></div>')
		.replace(/<cards([^>]*)>/g, (_, a) => `<div class="cards${attrs(a).cols === '3' ? ' cols-3' : ''}">`).replace(/<\/cards>/g, '</div>')
		.replace(/<card([^>]*)>([\s\S]*?)<\/card>/g, (_, a, text) => {
			const { title, href, icon: ic } = attrs(a);
			const tag = href ? 'a' : 'div';
			return `<${tag} class="card"${href ? ` href="${esc(href)}"` : ''}>${ic ? `<span class="card-icon">${icon(ic)}</span>` : ''}<span class="card-title">${esc(title)}</span><span class="card-text">${text.trim()}</span></${tag}>`;
		})
		.replace(/<tabs>/g, '<div class="ctabs">').replace(/<\/tabs>/g, '</div>')
		.replace(/<tab(\s[^>]*)?>/g, (_, a) => `<div class="ctabs-panel" data-title="${esc(attrs(a).title)}">`).replace(/<\/tab>/g, '</div>')
		.replace(/<accordion([^>]*)>/g, (_, a) => `<details class="acc"><summary>${esc(attrs(a).title)}</summary><div class="acc-body">`).replace(/<\/accordion>/g, '</div></details>')
		.replace(/<shot([^>]*)\/?>/g, (_, a) => {
			const { src, alt, caption, todo } = attrs(a);
			if (!src || !existsSync(join(SRC, src.replace(/^\//, '')))) {
				shotsTodo.push({ page: currentSlug, src, caption, todo });
				return `<figure class="shot shot-todo"><div class="shot-box">${icon('pixel')}<div><strong>Print pendente${src ? ` · <code>${esc(src)}</code>` : ''}</strong><p>${esc(todo || caption || '')}</p></div></div>${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
			}
			return `<figure class="shot"><img src="${esc(src)}" alt="${esc(alt || caption || '')}" loading="lazy">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
		})
		.replace(/<icon name="([a-z-]+)"\s*\/?>/g, (_, n) => icon(n));
	// Títulos com âncora
	const toc = [];
	const used = new Set();
	html = html.replace(/<h([23])(?:\s+id="([^"]*)")?>([\s\S]*?)<\/h\1>/g, (_, lvl, id, inner) => {
		let base = id || slugify(inner) || 'secao';
		let uid = base, n = 2;
		while (used.has(uid)) uid = `${base}-${n++}`;
		used.add(uid);
		toc.push({ lvl: Number(lvl), id: uid, text: strip(inner) });
		return `<h${lvl} id="${uid}">${inner}<a class="anchor" href="#${uid}" aria-label="Link para esta seção">#</a></h${lvl}>`;
	});
	return { html, toc };
}

/* ---------- Navegação ---------- */
const nav = JSON.parse(read(join(SRC, 'nav.json')));
const pages = new Map();
for (const f of readdirSync(join(SRC, 'content'))) {
	if (extname(f) !== '.html') continue;
	const slug = f.replace(/\.html$/, '');
	pages.set(slug, { slug, ...parsePage(join(SRC, 'content', f)) });
}

// API: páginas geradas a partir do OpenAPI
const apiTab = nav.tabs.find(t => t.api);
if (apiTab) {
	const specPath = join(SRC, 'openapi.json');
	if (existsSync(specPath)) {
		const spec = JSON.parse(read(specPath));
		const { groups, pages: apiPages } = buildApiPages(spec, { esc, slugify });
		apiTab.groups = [...(apiTab.groups || []), ...groups];
		for (const p of apiPages) pages.set(p.slug, p);
	} else {
		console.warn('! site/src/openapi.json não encontrado: a aba API sai só com a introdução. Rode `node site/build.mjs --fetch-openapi`.');
	}
}

const order = []; // { slug, tab, group }
const missing = [];
for (const tab of nav.tabs) {
	for (const group of tab.groups || []) {
		for (const item of group.pages) {
			const slug = typeof item === 'string' ? item : item.slug;
			if (!pages.has(slug)) { missing.push(slug); continue; }
			order.push({ slug, tab, group });
		}
	}
}
for (const slug of pages.keys()) {
	if (!order.find(o => o.slug === slug)) console.warn(`! ${slug} não está no nav.json (publicada sem aparecer no menu)`);
}
const titleOf = slug => pages.get(slug).meta.sidebarTitle || pages.get(slug).meta.title || slug;

function sidebar(tab, current) {
	return (tab.groups || []).filter(g => g.pages.some(i => pages.has(typeof i === 'string' ? i : i.slug))).map(g => `<div class="nav-group"><div class="nav-group-title">${esc(g.name)}</div><ul class="nav-list">${g.pages.filter(i => pages.has(typeof i === 'string' ? i : i.slug)).map(item => {
		const slug = typeof item === 'string' ? item : item.slug;
		const p = pages.get(slug);
		const ic = p.meta.icon ? icon(p.meta.icon) : '';
		const method = p.meta.method ? `<span class="method ${p.meta.method}">${p.meta.method === 'delete' ? 'del' : p.meta.method}</span>` : '';
		const badge = p.meta.badge ? `<span class="badge">${esc(p.meta.badge)}</span>` : '';
		return `<li><a class="nav-link${slug === current ? ' active' : ''}" href="${urlOf(slug)}">${method || ic}<span>${esc(titleOf(slug))}</span>${badge}</a></li>`;
	}).join('')}</ul></div>`).join('');
}

function tabsBar(currentTab) {
	return nav.tabs.map(t => {
		const first = order.find(o => o.tab === t);
		const slug = first?.slug;
		if (!slug && !t.href) return '';
		const href = t.href || urlOf(slug);
		return `<a class="tab-link${t === currentTab ? ' active' : ''}" href="${href}">${icon(t.icon || 'book')}${esc(t.name)}</a>`;
	}).join('');
}

/* ---------- Montagem ---------- */
// Arquivos compartilhados: todas as páginas apontam para ASSETS/style.css e ASSETS/shell.js.
// Uma mudança no layout, no menu ou no rodapé é só reenviar esses arquivos.
// Defina a base com --assets=https://... (padrão /assets, na raiz do domínio da documentação).
const argAssets = process.argv.find(a => a.startsWith('--assets='));
const ASSETS = (argAssets ? argAssets.slice(9) : process.env.TU_ASSETS || '/assets').replace(/\/$/, '');
const absAsset = f => (/^https?:/.test(ASSETS) ? ASSETS : SITE.url + ASSETS) + '/' + f;

const layout = read(join(SRC, 'layout.html'));
const css = read(join(SRC, 'assets', 'style.css'));
const appJs = read(join(SRC, 'assets', 'app.js'));
const shellJs = read(join(SRC, 'assets', 'shell.js'));
const logoLight = read(join(SRC, 'assets', 'logo-light.svg'));
const logoDark = read(join(SRC, 'assets', 'logo-dark.svg'));

// Data de última alteração de cada página (git), para sitemap e dados estruturados
const gitDate = file => {
	try { return execSync(`git log -1 --format=%cI -- "${file}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
};
const today = new Date().toISOString();
const dateOf = slug => {
	const f = join(SRC, 'content', slug + '.html');
	return (existsSync(f) ? gitDate(f) : gitDate(join(SRC, 'openapi.json'))) || today;
};

const searchIndex = [];
const rendered = [];
for (const [i, entry] of order.entries()) {
	const page = pages.get(entry.slug);
	currentSlug = entry.slug;
	const { html, toc } = expand(page.body);
	page.html = html; page.toc = toc;
	searchIndex.push({
		t: page.meta.title, u: urlOf(entry.slug), p: `${entry.tab.name} › ${entry.group.name}`,
		h: toc.map(h => h.text), x: strip(html).slice(0, 1600),
	});
	rendered.push({ entry, page, i });
}

// Dados da moldura (menu, abas, ordem das páginas), embutidos no shell.js
const tabFirst = t => { const f = order.find(o => o.tab === t); return t.href || (f ? urlOf(f.slug) : '/'); };
const usedIcons = new Set(['menu', 'search', 'moon', 'arrow', 'copy', 'chat', 'sparkles']);
const shellData = {
	site: SITE,
	logo: logoLight + logoDark,
	tabs: nav.tabs.filter(t => order.some(o => o.tab === t) || t.href).map(t => ({
		n: t.name, u: tabFirst(t), i: icon(t.icon || 'book'),
		g: (t.groups || []).map(g => ({
			n: g.name,
			p: g.pages.map(it => (typeof it === 'string' ? it : it.slug)).filter(sl => pages.has(sl)).map(sl => {
				const m = pages.get(sl).meta;
				if (m.icon && !m.method) usedIcons.add(m.icon);
				return { u: urlOf(sl), t: titleOf(sl), ...(m.method ? { m: m.method } : m.icon ? { i: m.icon } : {}), ...(m.badge ? { b: m.badge } : {}) };
			}),
		})).filter(g => g.p.length),
	})),
	order: [],
	icons: {},
};
const tabIndex = new Map(nav.tabs.filter(t => order.some(o => o.tab === t) || t.href).map((t, i) => [t, i]));
shellData.order = order.map(o => ({ u: urlOf(o.slug), t: titleOf(o.slug), tab: tabIndex.get(o.tab) }));
for (const n of usedIcons) shellData.icons[n] = icon(n);
const shellOut = `/* gerado por site/build.mjs — não edite: altere src/assets/shell.js, app.js ou nav.json */\n`
	+ `window.TU={A:${JSON.stringify(ASSETS)},data:${JSON.stringify(shellData)}};\n${shellJs}\nTU.init=function(){\n${appJs}\n};\n`;

const jsonEsc = o => JSON.stringify(o).replace(/</g, '\\u003c');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const sitemap = [];
mkdirSync(join(DIST, 'assets'), { recursive: true });
for (const f of ['og.jpg', 'favicon.svg']) copyFileSync(join(SRC, 'assets', f), join(DIST, 'assets', f));
writeFileSync(join(DIST, 'assets', 'search.js'), `window.__SEARCH__=${JSON.stringify(searchIndex)};`);
writeFileSync(join(DIST, 'assets', 'style.css'), css);
writeFileSync(join(DIST, 'assets', 'shell.js'), shellOut);
for (const { entry, page } of rendered) {
	const { meta, toc, html } = page;
	const showToc = meta.toc !== 'false' && toc.length > 1;
	const tocHtml = showToc ? `<aside class="toc"><div class="toc-title">${icon('list')} Nesta página</div><ul>${toc.map(h => `<li class="lvl-${h.lvl}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ul></aside>` : '';
	const canonical = SITE.url + urlOf(entry.slug);
	const isHome = entry.slug === 'index';
	const title = isHome ? `${SITE.name}: documentação oficial do Trackup` : `${meta.title} | ${SITE.name}`;
	const modified = dateOf(entry.slug);
	const tabUrl = SITE.url + tabFirst(entry.tab);
	const crumbs = [{ n: entry.tab.name, u: tabFirst(entry.tab) }, { n: entry.group.name }];
	const breadcrumb = isHome ? esc(entry.group.name) : `<a href="${crumbs[0].u}">${esc(crumbs[0].n)}</a><span aria-hidden="true"> › </span><span>${esc(crumbs[1].n)}</span>`;
	const ld = [
		isHome ? {
			'@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url + '/', inLanguage: 'pt-BR',
			publisher: { '@type': 'Organization', name: 'Trackup', url: SITE.home, logo: absAsset('favicon.svg') },
		} : {
			'@context': 'https://schema.org', '@type': 'TechArticle', headline: meta.title, description: meta.description || '',
			url: canonical, inLanguage: 'pt-BR', dateModified: modified, image: absAsset('og.jpg'),
			isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url + '/' },
			publisher: { '@type': 'Organization', name: 'Trackup', url: SITE.home, logo: absAsset('favicon.svg') },
			about: { '@type': 'SoftwareApplication', name: 'Trackup', applicationCategory: 'BusinessApplication', url: SITE.home },
		},
		{
			'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: SITE.name, item: SITE.url + '/' },
				...(isHome ? [] : [
					{ '@type': 'ListItem', position: 2, name: entry.tab.name, item: tabUrl },
					{ '@type': 'ListItem', position: 3, name: meta.title, item: canonical },
				]),
			],
		},
	];
	const out = layout
		.replaceAll('{{title}}', esc(title))
		.replaceAll('{{ogTitle}}', esc(isHome ? SITE.name : meta.title))
		.replaceAll('{{description}}', esc(meta.description || ''))
		.replaceAll('{{canonical}}', canonical)
		.replaceAll('{{ogImage}}', absAsset('og.jpg'))
		.replaceAll('{{A}}', ASSETS)
		.replace('{{articleTime}}', isHome ? '' : `<meta property="article:modified_time" content="${modified}">`)
		.replace('{{jsonld}}', () => jsonEsc(ld))
		.replace('{{layoutClass}}', showToc ? 'layout' : 'layout no-toc')
		.replace('{{breadcrumb}}', () => breadcrumb)
		.replace('{{pageTitle}}', esc(meta.title))
		.replace('{{pageDesc}}', meta.description ? `<p class="page-desc">${esc(meta.description)}</p>` : '')
		.replace('{{pageActions}}', () => (meta.actions === 'false' ? '' : '<script>TU.actions()</script>'))
		.replace('{{content}}', () => html)
		.replace('{{toc}}', () => tocHtml);
	const depth = isHome ? 0 : entry.slug.split('/').length;
	const final = out.replace(/(src|href)="img\//g, (_, a) => `${a}="${'../'.repeat(depth)}img/`);
	const dir = isHome ? DIST : join(DIST, entry.slug);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'index.html'), final);
	sitemap.push({ loc: canonical, lastmod: modified.slice(0, 10) });
}

// Imagens (pré-visualização local: /img/... ; no Trackup cada página envia as suas)
const imgSrc = join(SRC, 'img');
if (existsSync(imgSrc)) {
	mkdirSync(join(DIST, 'img'), { recursive: true });
	const copyDir = (from, to) => {
		mkdirSync(to, { recursive: true });
		for (const f of readdirSync(from)) {
			const p = join(from, f);
			if (statSync(p).isDirectory()) copyDir(p, join(to, f)); else copyFileSync(p, join(to, f));
		}
	};
	copyDir(imgSrc, join(DIST, 'img'));
}

// llms.txt (índice para agentes de IA) e sitemap
const llms = [`# ${SITE.name}`, '', '> Documentação oficial do Trackup: rastreamento, páginas, testes A/B, filtro, integrações e API.', '', `Documentação completa em um só arquivo: ${SITE.url}/llms-full.txt`, ''];
for (const tab of nav.tabs) {
	for (const g of tab.groups || []) {
		const present = g.pages.map(i => (typeof i === 'string' ? i : i.slug)).filter(sl => pages.has(sl));
		if (!present.length) continue;
		llms.push(`## ${tab.name} › ${g.name}`, '');
		for (const slug of present) {
			const p = pages.get(slug);
			llms.push(`- [${titleOf(slug)}](${SITE.url}${urlOf(slug)})${p.meta.description ? `: ${p.meta.description}` : ''}`);
		}
		llms.push('');
	}
}
writeFileSync(join(DIST, 'llms.txt'), llms.join('\n'));
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
// robots.txt: libera buscadores e assistentes de IA, aponta o sitemap e o llms.txt
writeFileSync(join(DIST, 'robots.txt'), [
	'User-agent: *', 'Allow: /', '',
	...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot']
		.flatMap(b => [`User-agent: ${b}`, 'Allow: /', '']),
	`Sitemap: ${SITE.url}/sitemap.xml`, `# Índice para IA: ${SITE.url}/llms.txt e ${SITE.url}/llms-full.txt`, '',
].join('\n'));
// llms-full.txt: a documentação inteira em texto, para assistentes de IA lerem de uma vez
const toMd = html => html
	.replace(/<a class="anchor"[^>]*>#<\/a>/g, '')
	.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (_, c) => '\n```\n' + c.replace(/<[^>]+>/g, '') + '\n```\n')
	.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n## $1\n').replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n### $1\n')
	.replace(/<span class="step-title">([\s\S]*?)<\/span>/g, '**$1** ')
	.replace(/<li[^>]*>/g, '\n- ').replace(/<\/(p|div|ul|ol|figure|details|table|tr)>/g, '\n')
	.replace(/<\/t[hd]>/g, ' | ').replace(/<summary>([\s\S]*?)<\/summary>/g, '\n**$1**\n')
	.replace(/<a [^>]*href="(\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, h, t) => `[${t}](${SITE.url}${h})`)
	.replace(/<a [^>]*href="(https?:[^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
	.replace(/<code>([\s\S]*?)<\/code>/g, '`$1`').replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**')
	.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')
	.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
	.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const full = [`# ${SITE.name}`, '', '> Documentação oficial do Trackup em português. Cada seção abaixo é uma página de ' + SITE.url + '.', ''];
for (const { entry, page } of rendered) {
	full.push(`---`, '', `# ${page.meta.title}`, '', `URL: ${SITE.url}${urlOf(entry.slug)}`, '');
	if (page.meta.description) full.push(`> ${page.meta.description}`, '');
	full.push(toMd(page.html), '');
}
writeFileSync(join(DIST, 'llms-full.txt'), full.join('\n'));

// Manifesto: hash de cada arquivo publicado. Compare com o da última publicação
// (node site/changed.mjs) para subir só o que mudou.
import('node:crypto').then(({ createHash }) => {
	const manifest = {};
	const walk = d => {
		for (const f of readdirSync(d)) {
			const pth = join(d, f);
			if (statSync(pth).isDirectory()) walk(pth);
			else manifest[pth.slice(DIST.length + 1)] = createHash('sha256').update(readFileSync(pth)).digest('hex').slice(0, 16);
		}
	};
	walk(DIST);
	delete manifest['manifest.json'];
	writeFileSync(join(DIST, 'manifest.json'), JSON.stringify({ assets: ASSETS, files: manifest }, null, 2));
});
writeFileSync(join(DIST, 'pages.json'), JSON.stringify(order.map(o => ({ slug: o.slug, path: urlOf(o.slug), title: titleOf(o.slug), file: o.slug === 'index' ? 'index.html' : `${o.slug}/index.html` })), null, 2));

// Links internos quebrados
const known = new Set(order.map(o => urlOf(o.slug)));
const broken = [];
for (const { entry, page } of rendered) {
	for (const m of page.html.matchAll(/href="(\/[^"#?]*)/g)) {
		const u = m[1].replace(/\/$/, '') || '/';
		if (!known.has(u) && !/\.(txt|xml|json)$/.test(u)) broken.push(`${urlOf(entry.slug)} → ${u}`);
	}
}
if (missing.length) console.warn(`! ${missing.length} páginas do nav.json ainda não existem: ${missing.join(', ')}`);
if (broken.length) console.warn(`! ${broken.length} links internos sem página:\n  ${[...new Set(broken)].join('\n  ')}`);

// Lista de prints pendentes, para tirar todos de uma vez
const shotLines = ['# Prints pendentes', '', `Gerado pelo build. ${shotsTodo.length} prints faltando.`, ''];
let lastPage = '';
for (const s of shotsTodo) {
	if (s.page !== lastPage) { shotLines.push('', `## ${titleOf(s.page)} (${urlOf(s.page)})`, ''); lastPage = s.page; }
	shotLines.push(`- [ ] \`${s.src || '(sem arquivo)'}\`: ${s.todo || s.caption || ''}`);
}
writeFileSync(join(ROOT, 'PRINTS.md'), shotLines.join('\n') + '\n');

console.log(`✓ ${rendered.length} páginas geradas em site/dist · ${shotsTodo.length} prints pendentes (site/PRINTS.md)`);

/* ---------- Servidor local ---------- */
if (process.argv.includes('--serve')) {
	const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json' };
	createServer((req, res) => {
		let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		let file = join(DIST, p);
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
		if (!existsSync(file)) { res.writeHead(404); return res.end('404'); }
		res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
		res.end(readFileSync(file));
	}).listen(4321, () => console.log('→ http://localhost:4321'));
}

// Redirecionamentos das URLs da documentação anterior (Mintlify).
// No Trackup, cada um vira uma página Redirect 301; aqui geramos também um HTML de fallback.
const redirects = JSON.parse(readFileSync(join(SRC, 'redirects.json'), 'utf8'));
for (const [from, to] of Object.entries(redirects)) {
	if (existsSync(join(DIST, from, 'index.html'))) { console.warn(`! redirect ignorado, a página existe: /${from}`); continue; }
	const dest = to.split('#')[0].replace(/^\//, '');
	if (dest && !existsSync(join(DIST, dest, 'index.html'))) console.warn(`! redirect /${from} aponta para página inexistente: ${to}`);
	mkdirSync(join(DIST, from), { recursive: true });
	writeFileSync(join(DIST, from, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Redirecionando…</title><link rel="canonical" href="${SITE.url}${to}"><meta http-equiv="refresh" content="0; url=${to}"><meta name="robots" content="noindex"></head><body><p>Esta página mudou. <a href="${to}">Ir para a nova página</a>.</p></body></html>`);
}
writeFileSync(join(DIST, 'redirects.json'), JSON.stringify(redirects, null, 2));
console.log(`✓ ${Object.keys(redirects).length} redirecionamentos de URLs antigas`);
