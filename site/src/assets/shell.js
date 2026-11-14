/* Trackup Docs — moldura compartilhada (cabeçalho, menu, paginação, rodapé e busca).
   Este arquivo é servido uma vez para todas as páginas. Mudou o menu, o cabeçalho ou o rodapé?
   Basta reenviar este arquivo; as páginas não precisam ser editadas. */
(function () {
	'use strict';
	var T = window.TU, D = T.data;

	function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
	function here() {
		var p = location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
		return p || '/';
	}
	// Insere o HTML no lugar exato do <script> que chamou a função, ainda durante a leitura da página
	function put(html) {
		var s = document.currentScript;
		if (s) s.insertAdjacentHTML('beforebegin', html);
	}

	var path = here();
	var idx = -1;
	for (var i = 0; i < D.order.length; i++) if (D.order[i].u === path) { idx = i; break; }
	var tabIdx = idx >= 0 ? D.order[idx].tab : 0;
	var I = D.icons;

	T.header = function () {
		var tabs = D.tabs.map(function (t, i) {
			return '<a class="tab-link' + (i === tabIdx ? ' active' : '') + '" href="' + esc(t.u) + '">' + t.i + esc(t.n) + '</a>';
		}).join('');
		put('<header class="header"><div class="header-row">'
			+ '<button class="icon-btn menu-btn" type="button" data-menu-toggle aria-label="Abrir menu">' + I.menu + '</button>'
			+ '<a class="logo" href="/" aria-label="Trackup Docs">' + D.logo + '<span class="logo-tag">Docs</span></a>'
			+ '<button class="search-btn" type="button" data-search-open aria-label="Buscar">' + I.search + '<span class="search-label">Buscar na documentação</span><kbd>Ctrl K</kbd></button>'
			+ '<div class="header-actions">'
			+ '<button class="icon-btn" type="button" data-theme-toggle aria-label="Alternar tema claro e escuro">' + I.moon + '</button>'
			+ '<a class="btn-primary" href="' + esc(D.site.app) + '" target="_blank" rel="noopener"><span>Abrir o Trackup</span>' + I.arrow + '</a>'
			+ '</div></div>'
			+ '<nav class="tabs-bar" aria-label="Seções"><div class="tabs-row">' + tabs + '</div></nav></header>');
	};

	T.sidebar = function () {
		var tab = D.tabs[tabIdx];
		put(tab.g.map(function (g) {
			return '<div class="nav-group"><div class="nav-group-title">' + esc(g.n) + '</div><ul class="nav-list">'
				+ g.p.map(function (p) {
					var lead = p.m ? '<span class="method ' + p.m + '">' + (p.m === 'delete' ? 'del' : p.m) + '</span>' : (p.i ? I[p.i] || '' : '');
					var badge = p.b ? '<span class="badge">' + esc(p.b) + '</span>' : '';
					return '<li><a class="nav-link' + (p.u === path ? ' active' : '') + '" href="' + esc(p.u) + '">' + lead + '<span>' + esc(p.t) + '</span>' + badge + '</a></li>';
				}).join('') + '</ul></div>';
		}).join(''));
	};

	T.actions = function () {
		var url = D.site.url + (path === '/' ? '/' : path);
		var q = encodeURIComponent('Leia ' + url + ' e me ajude a entender e aplicar esse conteúdo do Trackup.');
		put('<div class="page-actions">'
			+ '<button class="chip-btn" type="button" data-copy-page data-label="1">' + I.copy + ' Copiar página</button>'
			+ '<a class="chip-btn" href="https://chatgpt.com/?hints=search&q=' + q + '" target="_blank" rel="noopener">' + I.chat + ' Abrir no ChatGPT</a>'
			+ '<a class="chip-btn" href="https://claude.ai/new?q=' + q + '" target="_blank" rel="noopener">' + I.sparkles + ' Abrir no Claude</a>'
			+ '</div>');
	};

	T.pager = function () {
		if (idx < 0) return;
		var prev = D.order[idx - 1], next = D.order[idx + 1], tab = D.order[idx].tab;
		var okPrev = prev && prev.tab === tab, okNext = next && next.tab === tab;
		if (!okPrev && !okNext) return;
		function a(o, cls, lbl) { return '<a class="' + cls + '" href="' + esc(o.u) + '"><span class="lbl">' + lbl + '</span><span class="ttl">' + esc(o.t) + '</span></a>'; }
		put('<nav class="pager">' + (okPrev ? a(prev, 'prev', '← Anterior') : '') + (okNext ? a(next, 'next', 'Próximo →') : '') + '</nav>');
	};

	T.footer = function () {
		put('<footer class="site-footer"><span>© ' + new Date().getFullYear() + ' Trackup</span>'
			+ '<a href="' + esc(D.site.home) + '" target="_blank" rel="noopener">trackup.me</a>'
			+ '<a href="' + esc(D.site.app) + '" target="_blank" rel="noopener">Painel</a>'
			+ '<a href="/llms.txt">llms.txt</a></footer>');
	};

	T.end = function () {
		put('<div class="search-modal" role="dialog" aria-modal="true" aria-label="Buscar"><div class="search-box">'
			+ '<div class="search-input-row">' + I.search + '<input type="search" placeholder="Buscar páginas, recursos, integrações…" autocomplete="off"><kbd>Esc</kbd></div>'
			+ '<div class="search-results"></div></div></div>');
		if (T.init) T.init();
	};
})();
