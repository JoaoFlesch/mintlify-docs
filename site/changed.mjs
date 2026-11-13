#!/usr/bin/env node
// Lista o que mudou desde a última publicação no Trackup, para subir só isso.
// Uso: node site/build.mjs && node site/changed.mjs
//      node site/changed.mjs --mark   → registra a publicação atual (site/published.json)
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const cur = JSON.parse(readFileSync(join(ROOT, 'dist', 'manifest.json'), 'utf8'));
const pubPath = join(ROOT, 'published.json');

if (process.argv.includes('--mark')) {
	copyFileSync(join(ROOT, 'dist', 'manifest.json'), pubPath);
	console.log('✓ published.json atualizado: a próxima comparação parte daqui.');
	process.exit(0);
}

const prev = existsSync(pubPath) ? JSON.parse(readFileSync(pubPath, 'utf8')) : { files: {} };
const redirects = existsSync(join(ROOT, 'dist', 'redirects.json')) ? Object.keys(JSON.parse(readFileSync(join(ROOT, 'dist', 'redirects.json'), 'utf8'))) : [];
const isRedirect = f => redirects.includes(f.replace(/\/index\.html$/, ''));
const out = { shared: [], root: [], images: [], pages: [], added: [], removed: [] };
for (const [f, h] of Object.entries(cur.files)) {
	if (prev.files[f] === h) continue;
	if (isRedirect(f) || ['manifest.json', 'pages.json', 'redirects.json'].includes(f)) continue;
	const bucket = f.startsWith('assets/') ? 'shared' : f.startsWith('img/') ? 'images' : !f.endsWith('index.html') ? 'root' : prev.files[f] ? 'pages' : 'added';
	out[bucket].push(f);
}
for (const f of Object.keys(prev.files)) if (!(f in cur.files)) out.removed.push(f);

const page = f => '/' + f.replace(/\/?index\.html$/, '');
const print = (title, list, fmt = x => x) => { if (list.length) console.log(`\n${title} (${list.length})\n` + list.map(x => '  ' + fmt(x)).join('\n')); };
if (prev.assets && prev.assets !== cur.assets) console.log(`! A base dos arquivos compartilhados mudou (${prev.assets} → ${cur.assets}): todas as páginas precisam ser reenviadas.`);
print('Arquivos compartilhados (subir na página de assets)', out.shared);
print('Arquivos da raiz: llms.txt, sitemap.xml, robots.txt (uma página por arquivo)', out.root);
print('Imagens (enviar junto da página que usa)', out.images);
print('Páginas alteradas (reenviar e publicar)', out.pages, page);
print('Páginas novas (criar e publicar)', out.added, page);
print('Removidos (apagar no Trackup)', out.removed);
if (!Object.values(out).some(l => l.length)) console.log('Nada mudou desde a última publicação.');
