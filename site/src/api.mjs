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

	const groups = new Map();
	const pages = [];
	const used = new Set();
	for (const [path, item] of Object.entries(spec.paths || {})) {
		for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
			const op = item[method];
			if (!op) continue;
			const tag = op.tags?.[0] || 'Outros';
			let slug = 'api/' + slugify(op.operationId || `${method}-${path}`);
			while (used.has(slug)) slug += '-2';
			used.add(slug);
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
			let body = `<div class="endpoint"><span class="method ${method}">${method}</span><span>${esc(path)}</span></div>`;
			if (op.description) body += `<p>${md(op.description)}</p>`;
			body += `<h2>Autenticação</h2><p>Envie sua chave no cabeçalho <code>X-Api-Key</code>. Crie a chave em <strong>Configurações › Chaves de API</strong>.</p>`;
			if (pathParams.length) body += `<h2>Parâmetros de caminho</h2><div class="params">${pathParams.map(p => paramRow(p.name, p.schema, p.required, p.description)).join('')}</div>`;
			if (queryParams.length) body += `<h2>Parâmetros de consulta</h2><div class="params">${queryParams.map(p => paramRow(p.name, p.schema, p.required, p.description)).join('')}</div>`;
			if (bodySchema) body += `<h2>Corpo da requisição</h2>${schemaRows(bodySchema) || `<p><code>${esc(typeOf(bodySchema))}</code></p>`}`;
			if (multipart) body += `<h2>Corpo da requisição (multipart/form-data)</h2>${schemaRows(multipart)}`;
			body += `<h2>Exemplo</h2><code-block title="cURL" lang="bash">\n${curl}\n</code-block>`;
			if (responses) body += `<h2>Respostas</h2><div class="params">${responses}</div>`;
			pages.push({ slug, meta: { title: op.summary || op.operationId || path, description: '', method, toc: 'false', eyebrow: tag }, body });
			if (!groups.has(tag)) groups.set(tag, []);
			groups.get(tag).push({ slug, method, title: op.summary || op.operationId, path });
		}
	}

	// Índice com todos os endpoints
	const index = [...groups.entries()].map(([tag, ops]) => `<h2>${esc(tag)}</h2><ul class="op-list">${ops.map(o => `<li><span class="method ${o.method}">${o.method}</span><a href="/${o.slug}">${esc(o.title)}</a></li>`).join('')}</ul>`).join('');
	pages.push({ slug: 'api/endpoints', meta: { title: 'Todos os endpoints', description: `${pages.length} operações da API REST v1, agrupadas por área.`, icon: 'list' }, body: index });

	const navGroups = [{ name: 'Visão geral', pages: ['api/endpoints'] }, ...[...groups.entries()].map(([tag, ops]) => ({ name: tag, pages: ops.map(o => o.slug) }))];
	return { groups: navGroups, pages };
}
