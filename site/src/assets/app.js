/* Trackup Docs — interações sem dependências */
(function () {
	'use strict';
	var root = document.documentElement;

	/* Tema */
	function storedTheme() {
		try { return localStorage.getItem('tu-theme'); } catch (e) { return null; }
	}
	function applyTheme(t) {
		root.setAttribute('data-theme', t);
		try { localStorage.setItem('tu-theme', t); } catch (e) {}
	}
	document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
		btn.addEventListener('click', function () {
			applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
		});
	});
	if (!storedTheme() && window.matchMedia) {
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
			if (!storedTheme()) root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
		});
	}

	/* Menu mobile */
	document.querySelectorAll('[data-menu-toggle]').forEach(function (btn) {
		btn.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
	});
	document.addEventListener('click', function (e) {
		if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('[data-menu-toggle]')) {
			document.body.classList.remove('nav-open');
		}
	});
	var activeLink = document.querySelector('.sidebar .nav-link.active');
	if (activeLink) { var sb = activeLink.closest('.sidebar') || activeLink.parentElement; var r = activeLink.offsetTop - sb.clientHeight / 2; if (r > 0) sb.scrollTop = r; }

	/* Copiar código */
	var copyIcon = '<svg class="icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
	var checkIcon = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';
	function copyText(text, btn) {
		var done = function () {
			if (!btn) return;
			btn.classList.add('copied');
			var old = btn.innerHTML;
			btn.innerHTML = btn.dataset.label ? checkIcon + ' Copiado' : checkIcon;
			setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = old; }, 1600);
		};
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
		} else { fallback(text); done(); }
	}
	function fallback(text) {
		var ta = document.createElement('textarea');
		ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
		document.body.appendChild(ta); ta.select();
		try { document.execCommand('copy'); } catch (e) {}
		document.body.removeChild(ta);
	}
	document.querySelectorAll('.code').forEach(function (block) {
		var pre = block.querySelector('pre');
		var btn = document.createElement('button');
		btn.className = 'copy-btn'; btn.type = 'button'; btn.title = 'Copiar'; btn.setAttribute('aria-label', 'Copiar código');
		btn.innerHTML = copyIcon;
		btn.addEventListener('click', function () { copyText(pre.innerText.replace(/\n$/, ''), btn); });
		var head = block.querySelector('.code-head');
		(head || block).appendChild(btn);
	});
	document.querySelectorAll('[data-copy]').forEach(function (btn) {
		btn.addEventListener('click', function () { copyText(btn.getAttribute('data-copy'), btn); });
	});

	/* Copiar página como texto (para colar em uma IA) */
	var copyPage = document.querySelector('[data-copy-page]');
	if (copyPage) {
		copyPage.addEventListener('click', function () {
			var content = document.querySelector('.content');
			var title = document.querySelector('.page-title');
			copyText((title ? '# ' + title.innerText + '\n\n' : '') + content.innerText + '\n\nFonte: ' + location.href, copyPage);
		});
	}

	/* Abas de conteúdo */
	document.querySelectorAll('.ctabs').forEach(function (group, gi) {
		var panels = Array.prototype.slice.call(group.querySelectorAll(':scope > .ctabs-panel'));
		var list = document.createElement('div');
		list.className = 'ctabs-list'; list.setAttribute('role', 'tablist');
		panels.forEach(function (panel, i) {
			var b = document.createElement('button');
			b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = panel.getAttribute('data-title') || ('Aba ' + (i + 1));
			b.id = 'ct-' + gi + '-' + i; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', b.id);
			b.addEventListener('click', function () { select(i); });
			list.appendChild(b);
		});
		group.insertBefore(list, group.firstChild);
		function select(n) {
			panels.forEach(function (p, i) { p.hidden = i !== n; list.children[i].setAttribute('aria-selected', String(i === n)); });
		}
		select(0);
	});

	/* Imagens ampliáveis */
	document.querySelectorAll('figure.shot img').forEach(function (img) {
		img.addEventListener('click', function () {
			var lb = document.createElement('div');
			lb.className = 'lightbox';
			lb.innerHTML = '<img alt="">';
			lb.firstChild.src = img.currentSrc || img.src;
			lb.firstChild.alt = img.alt;
			lb.addEventListener('click', function () { lb.remove(); });
			document.body.appendChild(lb);
		});
	});

	/* Sumário com destaque da seção visível */
	var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
	if (tocLinks.length && 'IntersectionObserver' in window) {
		var map = {};
		tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
		var visible = {};
		var obs = new IntersectionObserver(function (entries) {
			entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
			var headings = document.querySelectorAll('.content h2[id], .content h3[id]');
			var current = null;
			for (var i = 0; i < headings.length; i++) {
				if (visible[headings[i].id]) { current = headings[i].id; break; }
			}
			if (!current) {
				for (var j = headings.length - 1; j >= 0; j--) {
					if (headings[j].getBoundingClientRect().top < 140) { current = headings[j].id; break; }
				}
			}
			tocLinks.forEach(function (a) { a.classList.toggle('active', a === map[current]); });
		}, { rootMargin: '-110px 0px -60% 0px' });
		document.querySelectorAll('.content h2[id], .content h3[id]').forEach(function (h) { obs.observe(h); });
	}

	/* Busca */
	var modal = document.querySelector('.search-modal');
	var input = modal && modal.querySelector('input');
	var results = modal && modal.querySelector('.search-results');
	var index = [];
	var sel = 0;
	function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
	function prepare() {
		index = window.__SEARCH__ || [];
		index.forEach(function (doc) { doc._t = norm(doc.t); doc._h = norm(doc.h.join(' ')); doc._x = norm(doc.x); });
	}
	// O índice de busca é um arquivo compartilhado, carregado só quando a busca abre pela primeira vez
	var loading = false;
	function loadIndex() {
		if (window.__SEARCH__ || loading) return;
		loading = true;
		var s = document.createElement('script');
		s.src = (window.TU && TU.A ? TU.A : '/assets') + '/search.js';
		s.onload = function () { prepare(); if (modal.classList.contains('open')) render(); };
		document.head.appendChild(s);
	}
	if (window.__SEARCH__) prepare();
	function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
	function highlight(text, terms) {
		var out = esc(text);
		terms.forEach(function (t) {
			if (t.length < 2) return;
			var n = norm(out); var res = ''; var i = 0; var k;
			while ((k = n.indexOf(t, i)) !== -1) { res += out.slice(i, k) + '<mark>' + out.slice(k, k + t.length) + '</mark>'; i = k + t.length; n = norm(out); if (res.length > 4000) break; }
			out = res + out.slice(i);
		});
		return out;
	}
	function snippet(doc, terms) {
		var n = doc._x; var pos = -1;
		terms.forEach(function (t) { var p = n.indexOf(t); if (p !== -1 && (pos === -1 || p < pos)) pos = p; });
		if (pos === -1) return doc.x.slice(0, 160);
		var start = Math.max(0, pos - 60);
		return (start > 0 ? '…' : '') + doc.x.slice(start, start + 180) + '…';
	}
	function search(q) {
		var terms = norm(q).split(/\s+/).filter(Boolean);
		if (!terms.length) return [];
		return index.map(function (doc) {
			var score = 0;
			for (var i = 0; i < terms.length; i++) {
				var t = terms[i]; var s = 0;
				if (doc._t.indexOf(t) !== -1) s += 10;
				if (doc._h.indexOf(t) !== -1) s += 4;
				if (doc._x.indexOf(t) !== -1) s += 1;
				if (!s) return null;
				score += s;
			}
			return { doc: doc, score: score };
		}).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12).map(function (r) {
			return { doc: r.doc, terms: terms };
		});
	}
	function render() {
		var q = input.value.trim();
		var list = search(q);
		sel = 0;
		if (!index.length && !window.__SEARCH__) { results.innerHTML = '<div class="search-empty">Carregando…</div>'; return; }
		if (!q) { results.innerHTML = '<div class="search-empty">Digite para buscar em toda a documentação.</div>'; return; }
		if (!list.length) { results.innerHTML = '<div class="search-empty">Nada encontrado para “' + esc(q) + '”.</div>'; return; }
		results.innerHTML = list.map(function (r, i) {
			return '<a href="' + r.doc.u + '"' + (i === 0 ? ' class="sel"' : '') + '><div class="r-path">' + esc(r.doc.p) + '</div><div class="r-title">' + highlight(r.doc.t, r.terms) + '</div><div class="r-text">' + highlight(snippet(r.doc, r.terms), r.terms) + '</div></a>';
		}).join('');
	}
	function openSearch() { loadIndex(); modal.classList.add('open'); input.value = ''; render(); setTimeout(function () { input.focus(); }, 10); }
	function closeSearch() { modal.classList.remove('open'); }
	if (modal) {
		document.querySelectorAll('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
		modal.addEventListener('click', function (e) { if (e.target === modal) closeSearch(); });
		input.addEventListener('input', render);
		input.addEventListener('keydown', function (e) {
			var items = results.querySelectorAll('a');
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				if (!items.length) return;
				items[sel].classList.remove('sel');
				sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
				items[sel].classList.add('sel'); items[sel].scrollIntoView({ block: 'nearest' });
			} else if (e.key === 'Enter' && items[sel]) { location.href = items[sel].getAttribute('href'); }
		});
		document.addEventListener('keydown', function (e) {
			if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName))) {
				e.preventDefault(); openSearch();
			} else if (e.key === 'Escape') { closeSearch(); document.body.classList.remove('nav-open'); }
		});
	}
})();
