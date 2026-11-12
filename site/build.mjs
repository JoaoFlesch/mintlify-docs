#!/usr/bin/env node
// Gera a documentação do Trackup em HTML estático, sem dependências.
// Uso: node site/build.mjs            → site/dist/<caminho>/index.html
//      node site/build.mjs --serve    → gera e abre um servidor local em http://localhost:4321
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
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
		.replace(/<tab([^>]*)>/g, (_, a) => `<div class="ctabs-panel" data-title="${esc(attrs(a).title)}">`).replace(/<\/tab>/g, '</div>')
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
const layout = read(join(SRC, 'layout.html'));
const css = read(join(SRC, 'assets', 'style.css'));
const js = read(join(SRC, 'assets', 'app.js'));
const logoLight = read(join(SRC, 'assets', 'logo-light.svg'));
const logoDark = read(join(SRC, 'assets', 'logo-dark.svg'));

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
const searchJs = `window.__SEARCH__=${JSON.stringify(searchIndex)};`;

function pager(i) {
	const prev = order[i - 1], next = order[i + 1];
	const same = o => o && o.tab === order[i].tab;
	const a = (o, cls, lbl) => `<a class="${cls}" href="${urlOf(o.slug)}"><span class="lbl">${lbl}</span><span class="ttl">${esc(titleOf(o.slug))}</span></a>`;
	if (!same(prev) && !same(next)) return '';
	return `<nav class="pager">${same(prev) ? a(prev, 'prev', '← Anterior') : ''}${same(next) ? a(next, 'next', 'Próximo →') : ''}</nav>`;
}

function aiLinks(slug) {
	const pageUrl = SITE.url + urlOf(slug);
	const q = encodeURIComponent(`Leia ${pageUrl} e me ajude a entender e aplicar esse conteúdo do Trackup.`);
	return `<button class="chip-btn" type="button" data-copy-page data-label="1">${icon('copy')} Copiar página</button>`
		+ `<a class="chip-btn" href="https://chatgpt.com/?hints=search&q=${q}" target="_blank" rel="noopener">${icon('chat')} Abrir no ChatGPT</a>`
		+ `<a class="chip-btn" href="https://claude.ai/new?q=${q}" target="_blank" rel="noopener">${icon('sparkles')} Abrir no Claude</a>`;
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const sitemap = [];
for (const { entry, page, i } of rendered) {
	const { meta, toc, html } = page;
	const showToc = meta.toc !== 'false' && toc.length > 1;
	const tocHtml = showToc ? `<aside class="toc"><div class="toc-title">${icon('list')} Nesta página</div><ul>${toc.map(h => `<li class="lvl-${h.lvl}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ul></aside>` : '';
	const out = layout
		.replaceAll('{{title}}', esc(meta.title === 'Trackup Docs' ? meta.title : `${meta.title} | ${SITE.name}`))
		.replaceAll('{{description}}', esc(meta.description || ''))
		.replaceAll('{{canonical}}', SITE.url + urlOf(entry.slug))
		.replace('{{css}}', () => css)
		.replace('{{js}}', () => searchJs + '\n' + js)
		.replace('{{logoLight}}', () => logoLight)
		.replace('{{logoDark}}', () => logoDark)
		.replace('{{tabs}}', () => tabsBar(entry.tab))
		.replace('{{sidebar}}', () => sidebar(entry.tab, entry.slug))
		.replace('{{layoutClass}}', showToc ? 'layout' : 'layout no-toc')
		.replace('{{eyebrow}}', esc(meta.eyebrow || entry.group.name))
		.replace('{{pageTitle}}', esc(meta.title))
		.replace('{{pageDesc}}', meta.description ? `<p class="page-desc">${esc(meta.description)}</p>` : '')
		.replace('{{pageActions}}', () => (meta.actions === 'false' ? '' : `<div class="page-actions">${aiLinks(entry.slug)}</div>`))
		.replace('{{content}}', () => html)
		.replace('{{toc}}', () => tocHtml)
		.replace('{{pager}}', () => pager(i))
		.replace('{{year}}', String(new Date().getFullYear()))
		.replace('{{appUrl}}', SITE.app).replace('{{homeUrl}}', SITE.home)
		.replace(/\{\{icon:([a-z-]+)\}\}/g, (_, n) => icon(n));
	const dir = entry.slug === 'index' ? DIST : join(DIST, entry.slug);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'index.html'), out);
	sitemap.push(SITE.url + urlOf(entry.slug));
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
const llms = [`# ${SITE.name}`, '', '> Documentação oficial do Trackup: rastreamento, páginas, testes A/B, filtro, integrações e API.', ''];
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
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
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
	const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json' };
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
