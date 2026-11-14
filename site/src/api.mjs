// Gera as páginas da referência da API a partir do OpenAPI (sem dependências).
const BASE = 'https://api.trackup.me';

export function buildApiPages(spec, { esc, slugify }) {
	const resolve = (s, seen = new Set()) => {
		if (!s || typeof s !== 'object') return s;
		if (s.$ref) {
			if (seen.has(s.$ref)) return { type: 'object', description: '(recursivo)' };
			const path = s.$ref.replace(/^#\//, '').split('/');
			let t = spec;
			for (const k of path) t = t?.[k];
			return resolve(t, new Set([...seen, s.$ref]));
		}
		return s;
	};
	const typeOf = s => {
		s = resolve(s);
		if (!s) return '';
		if (s.anyOf || s.oneOf) return (s.anyOf || s.oneOf).map(typeOf).filter(Boolean).join(' | ');
		if (s.type === 'array') return `${typeOf(s.items) || 'any'}[]`;
		let t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type || (s.properties ? 'object' : ''));
		if (s.format) t += ` (${s.format})`;
		return t;
	};
	const md = text => esc(text || '').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, ' ');

	function paramRow(name, s, required, desc) {
		s = resolve(s) || {};
		const extras = [];
		if (s.enum) extras.push(`Valores: ${s.enum.map(v => `<code>${esc(v)}</code>`).join(', ')}`);
		if (s.default !== undefined) extras.push(`Padrão: <code>${esc(JSON.stringify(s.default))}</code>`);
		const nested = schemaRows(s.type === 'array' ? resolve(s.items) : s, 1);
		const d = desc || s.description;
		return `<div class="param"><div class="param-head"><span class="param-name">${esc(name)}</span><span class="param-type">${esc(typeOf(s))}</span>${required ? '<span class="param-req">obrigatório</span>' : ''}</div>${d || extras.length ? `<div class="param-desc">${d ? `<p>${md(d)}</p>` : ''}${extras.length ? `<p>${extras.join(' · ')}</p>` : ''}</div>` : ''}${nested}</div>`;
	}
	function schemaRows(s, depth = 0) {
		s = resolve(s);
		if (!s || !s.properties || depth > 3) return '';
		const req = new Set(s.required || []);
		return `<div class="params">${Object.entries(s.properties).map(([k, v]) => paramRow(k, v, req.has(k), resolve(v)?.description)).join('')}</div>`;
	}
	function example(s, depth = 0) {
		s = resolve(s);
		if (!s || depth > 4) return null;
		if (s.example !== undefined) return s.example;
		if (s.default !== undefined) return s.default;
		if (s.enum) return s.enum[0];
		if (s.anyOf || s.oneOf) return example((s.anyOf || s.oneOf)[0], depth + 1);
		if (s.type === 'array') return [example(s.items, depth + 1)].filter(v => v !== null);
		if (s.properties) {
			const o = {};
			const req = new Set(s.required || []);
			for (const [k, v] of Object.entries(s.properties)) if (req.has(k) || depth === 0) { const e = example(v, depth + 1); if (e !== null) o[k] = e; }
			return o;
		}
		if (s.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
		if (s.format === 'date') return '2026-01-31';
		if (s.format === 'date-time') return '2026-01-31T12:00:00Z';
		return { string: 'string', integer: 0, number: 0, boolean: true }[Array.isArray(s.type) ? s.type[0] : s.type] ?? null;
	}

	const TAGS_PT = { 'Projects': 'Projetos', 'Pages': 'Páginas', 'Links': 'Testes A/B e links', 'URLs': 'URLs', 'Domains': 'Domínios', 'Pixels': 'Pixels', 'Triggers': 'Acionadores', 'Trigger logs': 'Logs de acionadores', 'Firewall rules': 'Filtro', 'Traffic sources': 'Fontes de tráfego', 'Sales platforms': 'Plataformas de venda', 'Dashboards': 'Dashboards', 'Analytics': 'Analytics', 'Ads manager': 'Gerenciador de anúncios', 'Conversions': 'Conversões', 'Refunds': 'Reembolsos', 'Chargebacks': 'Chargebacks', 'Visitors': 'Visitantes', 'Requests': 'Requisições', 'Products': 'Produtos', 'Assets': 'Arquivos', 'Ingest': 'Ingestão' };
	const groups = new Map();
	for (const [path, item] of Object.entries(spec.paths || {})) {
		for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
			const op = item[method];
			if (!op) continue;
			const tagEn = op.tags?.[0] || 'Outros';
			const tag = TAGS_PT[tagEn] || tagEn;
			const id = slugify(op.operationId || `${method}-${path}`);
			const params = [...(item.parameters || []), ...(op.parameters || [])].map(resolve);
			const pathParams = params.filter(p => p.in === 'path');
			const queryParams = params.filter(p => p.in === 'query');
			const bodySchema = resolve(op.requestBody?.content?.['application/json']?.schema);
			const multipart = resolve(op.requestBody?.content?.['multipart/form-data']?.schema);
			let curl = `curl -X ${method.toUpperCase()} "${BASE}${path}${queryParams.some(p => p.required) ? '?' + queryParams.filter(p => p.required).map(p => `${p.name}=…`).join('&') : ''}" \\\n  -H "X-Api-Key: $TRACKUP_API_KEY"`;
			if (bodySchema) curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(example(bodySchema), null, 2).replace(/'/g, "'\\''")}'`;
			const responses = Object.entries(op.responses || {}).map(([code, r]) => {
				r = resolve(r);
				const sch = resolve(r?.content?.['application/json']?.schema);
				return `<div class="param"><div class="param-head"><span class="param-name">${esc(code)}</span><span class="param-type">${esc(typeOf(sch))}</span></div>${r?.description ? `<div class="param-desc"><p>${md(r.description)}</p></div>` : ''}${code.startsWith('2') ? schemaRows(sch?.type === 'array' ? sch.items : sch) : ''}</div>`;
			}).join('');
			const title = op.summary || op.operationId || path;
			let body = `<h2 id="${id}">${esc(title)}</h2><div class="endpoint"><span class="method ${method}">${method}</span><span>${esc(path)}</span></div>`;
			if (op.description) body += `<p>${md(op.description)}</p>`;
			if (pathParams.length) body += `<h4>Parâmetros de caminho</h4><div class="params">${pathParams.map(p => paramRow(p.name, p.schema, p.required, p.description)).join('')}</div>`;
			if (queryParams.length) body += `<h4>Parâmetros de consulta</h4><div class="params">${queryParams.map(p => paramRow(p.name, p.schema, p.required, p.description)).join('')}</div>`;
			if (bodySchema) body += `<h4>Corpo da requisição</h4>${schemaRows(bodySchema) || `<p><code>${esc(typeOf(bodySchema))}</code></p>`}`;
			if (multipart) body += `<h4>Corpo da requisição (multipart/form-data)</h4>${schemaRows(multipart)}`;
			body += `<code-block title="Exemplo" lang="bash">\n${curl}\n</code-block>`;
			if (responses) body += `<accordion title="Respostas"><div class="params">${responses}</div></accordion>`;
			if (!groups.has(tag)) groups.set(tag, []);
			groups.get(tag).push({ id, method, title, path, body });
		}
	}
	const pages = [];
	let total = 0;
	for (const [tag, ops] of groups) {
		total += ops.length;
		const slug = 'api/' + slugify(tag);
		const list = `<ul class="op-list">${ops.map(o => `<li><span class="method ${o.method}">${o.method}</span><a href="#${o.id}">${esc(o.title)}</a></li>`).join('')}</ul>`;
		const auth = `<p>Todos os endpoints usam a chave no cabeçalho <code>X-Api-Key</code>. Veja <a href="/api-autenticacao">Autenticação</a>.</p>`;
		pages.push({ slug, meta: { title: tag, description: `${ops.length} ${ops.length === 1 ? 'endpoint' : 'endpoints'} da API REST v1.`, icon: 'code', eyebrow: 'Referência da API' }, body: auth + list + ops.map(o => o.body).join('<hr>') });
		for (const o of ops) o.slug = slug;
	}
	const index = [...groups.entries()].map(([tag, ops]) => `<h2>${esc(tag)}</h2><ul class="op-list">${ops.map(o => `<li><span class="method ${o.method}">${o.method}</span><a href="/${o.slug}#${o.id}">${esc(o.title)}</a></li>`).join('')}</ul>`).join('');
	pages.push({ slug: 'api/endpoints', meta: { title: 'Todos os endpoints', description: `${total} operações da API REST v1, agrupadas por área.`, icon: 'list' }, body: index });
	const navGroups = [{ name: 'Referência', pages: ['api/endpoints', ...[...groups.keys()].map(t => 'api/' + slugify(t))] }];
	return { groups: navGroups, pages };
}
