#!/usr/bin/env python3
"""Gera as páginas de plataformas de venda (site/src/content/<slug>.html) a partir dos dados abaixo.
Uso: python3 site/tools/gerar-plataformas.py  (rode de novo depois de editar os dados)."""
import json, os, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
IMG_OUT = SITE / 'src' / 'img' / 'plataformas'
LOGOS = SITE / 'src' / 'img' / 'logos'  # logos do app (apps/dashboard/public/img/platforms), um arquivo por slug

def logo(slug):
	for ext in ('svg', 'png'):
		if (LOGOS / f'{slug}.{ext}').exists():
			return f'img/logos/{slug}.{ext}'
	return None
FLOWS = json.loads((SITE / 'tools' / 'fluxos-plataformas.json').read_text())

# slug, nome, tipo no painel, parâmetro que leva o ID do clique, eventos a ativar, observação
P = [
	('actionpay', 'ActionPay', 'ActionPay', 'subid1', None, 'Cole a URL de postback no painel da ActionPay em <strong>Nova postagem</strong>. No link da oferta, adicione <code>subid1={request.id}</code> para o clique ser atribuído.'),
	('amplopay', 'AmploPay', 'AmploPay', 'utm_id', None, None),
	('appmax', 'Appmax', 'Appmax', 'src', None, None),
	('atomo-pay', 'Átomo Pay', 'Átomo Pay', 'src', None, None),
	('braip', 'Braip', 'Braip', 'src', None, None),
	('buygoods', 'BuyGoods', 'BuyGoods', 'subid', None, None),
	('cart-panda', 'CartPanda', 'CartPanda', 'sck', None, None),
	('digipag', 'DigiPag', 'DigiPag', 'src', None, None),
	('digistore24', 'Digistore24', 'DigiStore24', 'cid', None, None),
	('eduzz', 'Eduzz', 'Eduzz', 'tracker_trk', None, None),
	('goat-pay', 'GoatPay', 'GoatPay', 'src', None, None),
	('hotmart', 'Hotmart', 'Hotmart 1.0 ou Hotmart 2.0', 'xcod (1.0) ou sck (2.0)', None, 'Há dois tipos no Trackup. Use <strong>Hotmart 2.0</strong> em integrações novas: ele envia o clique no parâmetro <code>sck</code>. O tipo <strong>Hotmart 1.0</strong> usa <code>xcod</code> e continua disponível para integrações antigas.'),
	('inova-pag', 'InovaPag', 'InovaPag', 'src', None, None),
	('kirvano', 'Kirvano', 'Kirvano', 'src', None, None),
	('kiwify', 'Kiwify', 'Kiwify', 'sck', None, None),
	('lastlink', 'LastLink', 'LastLink', 'sck', 'Compra completa, Pagamento de renovação, Pagamento reembolsado e Pagamento estornado', 'Não ative <strong>Fatura criada</strong> nem <strong>Assinatura pendente de renovação</strong>: esses eventos não são vendas.'),
	('luna-checkout', 'Luna Checkout', 'Luna Checkout', 'src', None, None),
	('monetizze', 'Monetizze', 'Monetizze', 'src', None, None),
	('mundpay', 'Mundpay', 'Mundpay', 'sck', '<code>order.paid</code>, <code>order.awaiting_payment</code>, <code>order.refunded</code> e <code>order.chargeback</code>', 'Em <strong>Integrações › Webhooks</strong>, cadastre a URL como <strong>Postback URL</strong>. No link do checkout, use <code>sck={request.id}</code>.'),
	('nuvemshop', 'Nuvemshop', 'Nuvemshop', None, None, None),
	('pagueio', 'Pague.io', 'Pague.io', 'click_id', None, None),
	('paradise', 'Paradise', 'Paradise', 'src', None, None),
	('payt', 'Payt', 'Payt', 'src', None, None),
	('perfect-pay', 'PerfectPay', 'PerfectPay', 'click_id', None, None),
	('proofpay', 'ProofPay', 'ProofPay', 'src', None, None),
	('shopify', 'Shopify', 'Shopify', 'sid', None, None),
	('stripe', 'Stripe', 'Stripe', 'client_reference_id', '<code>checkout.session.completed</code> e <code>payment_intent.succeeded</code>', 'O Trackup envia o ID do clique em <code>client_reference_id</code>, o campo que o Stripe Checkout e os Payment Links devolvem no webhook. Hoje a integração registra vendas aprovadas; reembolsos e disputas do Stripe ainda não são lidos.'),
	('ticto', 'Ticto', 'Ticto 2.0', 'sck', None, None),
	('tribopay', 'TriboPay', 'TriboPay', 'src', None, None),
	('upag', 'Upag', 'Upag', 'clickId', '<code>invoice.paid</code>', 'Selecione <strong>apenas</strong> <code>invoice.paid</code>. Eventos como <code>payment.approved</code> não trazem os itens da fatura, e a conversão pode ficar com valor zero.'),
	('vega-checkout', 'Vega Checkout', 'Vega Checkout', 'src', None, None),
	('yampi', 'Yampi', 'Yampi', 'metadata[sck]', None, None),
	('zedy', 'Zedy', 'Zedy', 'src', None, None),
]


# Passos revisados (17/11) no painel de cada plataforma. Substituem o texto bruto de fluxos-plataformas.json.
B = lambda s: f'<strong>{s}</strong>'
STEPS = {
	'atomo-pay': ['No painel da Átomo Pay, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'braip': ['No painel da Braip, abra ' + B('Ferramentas › Postback') + ' e clique em ' + B('Nova configuração') + '.', 'Dê um nome à integração, como <em>Trackup</em>.', 'Cole a URL do Trackup.', 'Selecione os produtos.', 'Marque os eventos de pagamento ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'cart-panda': ['No admin da CartPanda, abra ' + B('Notificações › Webhooks') + ' e clique em ' + B('Configurar Webhooks') + '.', 'Clique em ' + B('Criar Webhook') + ' e dê um nome à integração.', 'Selecione os eventos ' + B('Pedido Pago') + ', ' + B('Pedido Reembolsado') + ' e ' + B('Pedido Chargeback') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos.', 'Clique em ' + B('Salvar Webhook') + '.'],
	'digipag': ['No painel da DigiPag, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'eduzz': ['No ' + B('Developer Hub') + ' da Eduzz, abra ' + B('Integrações') + '.', 'Em ' + B('Configurações') + ', clique em ' + B('Nova Configuração') + ' e dê um nome à integração.', 'Cole a URL do Trackup.', 'Marque os eventos <code>myeduzz.invoice_paid</code>, <code>myeduzz.invoice_refunded</code> e <code>myeduzz.invoice_chargeback</code>.', 'Clique em ' + B('Criar Configuração') + '.'],
	'goat-pay': ['No painel da GoatPay, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'hotmart': ['Na Hotmart, abra ' + B('Ferramentas') + ', clique em ' + B('Ver todas') + ' e escolha ' + B('Webhook (API e notificações)') + '.', 'Clique em ' + B('Cadastrar Webhook') + ' e dê um nome à configuração, como <em>Trackup</em>.', 'Selecione os produtos que devem enviar vendas.', 'Cole a URL do Trackup.', 'Selecione a versão ' + B('2.0.0') + '.', 'Marque os eventos ' + B('Compra aprovada') + ', ' + B('Compra reembolsada') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'inova-pag': ['No painel da InovaPag, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'kirvano': ['Na Kirvano, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar Integração') + '.', 'Dê um nome à integração.', 'Cole a URL do Trackup.', 'Selecione os produtos.', 'Marque os eventos ' + B('Compra aprovada') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Clique em ' + B('Criar') + '.'],
	'kiwify': ['Na Kiwify, abra ' + B('Apps › Webhooks') + ' e clique em ' + B('Criar Webhook') + '.', 'Dê um nome ao webhook.', 'Cole a URL do Trackup.', 'Selecione os produtos.', 'Marque os eventos ' + B('Compra aprovada') + ', ' + B('Reembolso') + ' e ' + B('Chargeback') + '.', 'Clique em ' + B('Criar') + '.'],
	'luna-checkout': ['No Luna Checkout, abra ' + B('Desenvolvedores › Webhooks') + ' e clique em ' + B('Nova integração') + '.', 'Dê um nome à integração.', 'Cole a URL do Trackup.', 'Marque os eventos ' + B('Venda Aprovada') + ', ' + B('Venda Estornada') + ' e ' + B('Venda Chargeback') + '.', 'Se quiser, restrinja a integração a alguns produtos.', 'Salve.'],
	'monetizze': ['Na Monetizze, abra ' + B('Ferramentas › Postback - Webhook') + '.', 'Selecione os produtos e as vendas que devem ser enviadas.', 'Em ' + B('Tipo') + ', escolha ' + B('Webhook (server to server)') + ' e o formato ' + B('JSON') + '.', 'Cole a URL do Trackup.', 'Marque as vendas ' + B('Completa') + ', ' + B('Cancelada') + ' e ' + B('Devolvida') + ' (reembolso).', 'Salve.'],
	'paradise': ['Na Paradise, abra ' + B('Integrações › Webhooks (Postbacks)') + ' e clique em ' + B('Adicionar/Gerenciar Webhooks') + '.', 'Cole a URL do Trackup.', 'Marque ' + B('Venda Aprovada') + ' e ' + B('Venda Reembolsada') + '.', 'Clique em ' + B('Salvar Alterações') + '.'],
	'payt': ['Na Payt, abra ' + B('Ferramentas › Postback') + ' e clique em ' + B('Cadastrar') + '.', 'Dê um nome à integração.', 'Cole a URL do Trackup.', 'Selecione os produtos.', 'Marque os eventos ' + B('Finalizada/Aprovada') + ', ' + B('Cancelada - Reembolso') + ' e ' + B('Cancelada - Chargeback') + '. Se vende com pagamento após o recebimento, marque também ' + B('Pedido Confirmado') + '.', 'Salve.'],
	'perfect-pay': ['Na PerfectPay, abra ' + B('Ferramentas › Webhooks - Vendas') + ' e clique em ' + B('Adicionar') + '.', 'Selecione os produtos.', 'Cole a URL do Trackup.', 'Escolha as variáveis que quiser enviar.', 'Marque os eventos ' + B('Aprovado') + ', ' + B('Devolvido') + ' e ' + B('Charge back') + '.', 'Salve.'],
	'proofpay': ['No painel da ProofPay, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'tribopay': ['No painel da TriboPay, abra ' + B('Integrações › Webhooks') + ' e clique em ' + B('Adicionar') + '.', 'Cole a URL do Trackup.', 'Selecione os produtos que devem enviar vendas.', 'Marque todos os métodos de pagamento.', 'Marque os status ' + B('Pago') + ', ' + B('Reembolsado') + ' e ' + B('Chargeback') + '.', 'Salve.'],
	'upag': ['Na Upag, abra ' + B('Desenvolvedor › Webhooks') + ' e clique em ' + B('Criar Webhook') + '.', 'Dê um nome à integração, como <em>Trackup</em>.', 'Cole a URL do Trackup.', 'Selecione ' + B('apenas') + ' o evento <code>invoice.paid</code>.', 'Clique em ' + B('Criar Webhook') + '.'],
	'vega-checkout': ['No Vega Checkout, abra ' + B('Desenvolvedores › Webhooks') + ' e clique em ' + B('Nova integração') + '.', 'Dê um nome à integração.', 'Cole a URL do Trackup.', 'Marque os eventos ' + B('Venda Aprovada') + ', ' + B('Venda Estornada') + ' e ' + B('Venda Chargeback') + '.', 'Se quiser, restrinja a integração a alguns produtos.', 'Salve.'],
	'yampi': ['Na Yampi, abra ' + B('Desenvolvedor › Webhooks') + ' e clique em ' + B('Criar Webhook') + '.', 'Dê um nome à integração.', 'Cole a URL do Trackup.', 'Selecione todos os eventos.', 'Clique em ' + B('Criar Webhook') + '.'],
}

TRACKUP_SIDE = re.compile(r'copy|copiar|integra|intregra|PLATAFORMA|Screenshot', re.I)

def compress(src_rel):
	from PIL import Image
	src = ROOT / src_rel.lstrip('/')
	if not src.exists():
		return None
	name = src.stem.lower().replace(' ', '-') + '.webp'
	out = IMG_OUT / name
	if not out.exists():
		IMG_OUT.mkdir(parents=True, exist_ok=True)
		im = Image.open(src).convert('RGB')
		im.thumbnail((1600, 1600))
		im.save(out, 'WEBP', quality=78, method=6)
	return f'img/plataformas/{name}'

def page(slug, name, kind, key, events, note):
	flow = FLOWS.get(slug)
	esc = html.escape
	lg = logo(slug)
	out = ['---', f'title: {name}', 'icon: cart', 'eyebrow: Plataformas de venda', *([f'logo: {lg}'] if lg else []),
		f'description: Receba vendas, reembolsos e chargebacks da {name} no Trackup, atribuídos ao anúncio de origem.', '---']
	if slug != 'nuvemshop':
		out.append(f'<callout type="tip"><p><strong>Configure pela sua IA.</strong> Conecte seu assistente pelo <a href="/conectar-mcp">MCP</a> e peça: <em>"Crie a plataforma de venda {esc(name)} no projeto Online Store e me dê a URL do webhook."</em> O cadastro da URL dentro da {esc(name)} continua com você.</p></callout>')
	if slug == 'nuvemshop':
		out.append('<p>A Nuvemshop conecta por autorização (OAuth): o Trackup instala sozinho os webhooks de pedidos e o script de rastreamento na loja.</p>')
	else:
		out.append(f'<p>A integração tem duas partes: o Trackup envia o ID do clique para o checkout da {name}, e a {name} devolve esse ID no webhook de cada venda.</p>')
	if slug == 'nuvemshop':
		out.append('<flow><fstep n="1" icon="cart" title="Pedido na loja">O cliente compra na Nuvemshop</fstep><fstep n="2" icon="plug" title="Webhook">Instalado pelo Trackup</fstep><fstep n="3" icon="dollar" title="Conversão" tone="ok">Ligada ao clique e à campanha</fstep></flow>')
	else:
		out.append(f'<flow><fstep n="1" icon="cart" title="Checkout">O Trackup envia o ID do clique para a {name}</fstep><fstep n="2" icon="plug" title="Webhook">A {name} devolve o ID a cada venda</fstep><fstep n="3" icon="dollar" title="Conversão" tone="ok">Ligada ao clique e à campanha</fstep></flow>')
	out.append('<h2>Antes de começar</h2><ul><li>Um projeto com <a href="/dominios">domínio primário</a> configurado. A URL do webhook usa esse domínio.</li>'
		f'<li>Acesso de administrador à sua conta na {name}.</li></ul>')
	out.append('<h2>1. Crie a plataforma no Trackup</h2><steps>')
	kind_html = '<strong>Hotmart 2.0</strong> (ou <strong>Hotmart 1.0</strong>, em integrações antigas)' if slug == 'hotmart' else f'<strong>{esc(kind)}</strong>'
	out.append(f'<step title="Adicione a plataforma"><p>Vá em <strong>Integração › Plataformas de vendas</strong>, clique em <strong>Adicionar plataforma</strong> e escolha {kind_html}.</p></step>')
	if key:
		key_html = '<code>sck</code> (Hotmart 2.0) ou <code>xcod</code> (Hotmart 1.0)' if slug == 'hotmart' else f'<code>{esc(key)}</code>'
		out.append(f'<step title="Confira os parâmetros"><p>O Trackup preenche os parâmetros do checkout sozinho: o ID do clique vai em {key_html} e as UTMs vão junto. Só altere se a {name} usar outro nome de parâmetro.</p></step>')
	if slug == 'nuvemshop':
		out.append('<step title="Conecte a loja"><p>Salve e clique em <strong>Conectar loja</strong>. Na Nuvemshop, aprove os acessos <strong>Ler pedidos</strong>, <strong>Modificar pedidos</strong> (usado só para gravar a atribuição no pedido) e <strong>Scripts</strong>.</p></step>')
		out.append('<step title="Libere os domínios da loja"><p>Em <strong>Ajustes › Geral › Segurança</strong>, adicione o domínio da loja e o do checkout em <strong>Domínios permitidos</strong>.</p></step>')
	else:
		out.append(f'<step title="Copie a URL do webhook"><p>Salve. Na lista de plataformas, copie a <strong>URL</strong> da {name}.</p>'
			f'<shot src="img/plataforma-url-copiar.png" caption="URL do webhook na lista de plataformas" todo="Integração › Plataformas de vendas com a plataforma {esc(name)} cadastrada e o botão Copiar URL em destaque. Parte do código da URL borrada."></shot></step>')
	out.append('</steps>')
	if slug != 'nuvemshop':
		out.append(f'<h2>2. Cadastre o webhook na {name}</h2>')
		if note:
			out.append(f'<callout type="warning"><p>{note}</p></callout>' if slug in ('upag', 'lastlink') else f'<callout type="note"><p>{note}</p></callout>')
		if flow:
			out.append('<ol>')
			for s in STEPS[slug]:
				out.append(f'<li>{s}</li>')
			out.append('</ol>')
			# Os prints vindos da documentação antiga foram removidos (decisão do João, 16/11); só os prints próprios entram.
		else:
			out.append(f'<ol><li>No painel da {name}, abra a área de <strong>webhooks</strong> ou <strong>postback</strong>.</li>'
				f'<li>Crie uma integração e cole a URL do Trackup.</li>'
				f'<li>Ative os eventos de {events or "compra aprovada, reembolso e chargeback"}.</li>'
				'<li>Selecione os produtos que devem enviar vendas, se a plataforma pedir, e salve.</li></ol>')
		if events and flow:
			out.append(f'<p>Eventos a ativar: {events}.</p>')
	out.append(f'<h2>{"3" if slug != "nuvemshop" else "2"}. Teste</h2>')
	out.append(f'<p>Abra sua landing page pelo link do Trackup, com os parâmetros da fonte de tráfego, clique no botão de compra e faça uma compra de teste de valor baixo. A venda deve aparecer em <strong>Logs › Conversões</strong> com a campanha preenchida.</p>')
	out.append('<callout type="warning"><p>Se a venda aparecer como <strong>Click ID ausente</strong>, o botão da página não está apontando para o link da <a href="/ofertas">oferta</a> no Trackup, ou o checkout não está devolvendo o parâmetro do clique.</p></callout>')
	out.append('<p>Não achou sua plataforma? Use o <a href="/webhook-generico">webhook genérico</a>.</p>')
	return '\n'.join(out) + '\n'

for slug, name, kind, key, events, note in P:
	(SITE / 'src' / 'content' / f'{slug}.html').write_text(page(slug, name, kind, key, events, note))

json.dump([{'slug': s, 'name': n} for s, n, *_ in P], open(SITE / 'src' / 'plataformas.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(P)} páginas de plataforma geradas')

# Página índice de integrações
cards = '\n'.join(f'\t<card title="{html.escape(n)}" href="/{s}"{" logo=" + chr(34) + logo(s) + chr(34) if logo(s) else ""}>{html.escape(k)}</card>' for s, n, k, *_ in P)
(SITE / 'src' / 'content' / 'integracoes.html').write_text(f'''---
title: Integrações
icon: plug
eyebrow: Plataformas de venda
description: Passo a passo para conectar cada plataforma de venda ao Trackup.
toc: false
---
<callout type="tip"><p><strong>Configure pela sua IA.</strong> Conecte seu assistente pelo <a href="/conectar-mcp">MCP</a> e peça: <em>"Conecte a Hotmart ao projeto Online Store e me dê a URL do webhook."</em> O cadastro da URL dentro da plataforma de venda é feito por você.</p></callout>
<p>O Trackup recebe vendas de {len(P)} plataformas por webhook. Escolha a sua abaixo. Se ela não estiver na lista, use o <a href="/webhook-generico">webhook genérico</a>.</p>
<callout type="tip"><p>Primeira vez integrando? Leia antes <a href="/plataformas-de-venda">como a atribuição de vendas funciona</a>.</p></callout>
<div class="plat-search"><input type="search" id="plat-q" placeholder="Buscar plataforma pelo nome" aria-label="Buscar plataforma pelo nome" autocomplete="off"></div>
<cards cols="3">
{cards}
	<card title="Webhook genérico" href="/webhook-generico">Qualquer checkout ou sistema próprio</card>
</cards>
<div class="plat-empty" id="plat-empty" hidden><strong>Não encontramos essa plataforma</strong><p>A integração pode ser solicitada pelo chat do suporte. Vamos realizá-la rapidamente. Enquanto isso, você já pode receber as vendas pelo <a href="/webhook-generico">webhook genérico</a>.</p></div>
<script>
(function () {{
	var q = document.getElementById('plat-q'), empty = document.getElementById('plat-empty');
	if (!q) return;
	var cards = [].slice.call(document.querySelectorAll('.cards .card'));
	var norm = function (s) {{ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }};
	q.addEventListener('input', function () {{
		var v = norm(q.value), n = 0;
		cards.forEach(function (c) {{
			var t = c.querySelector('.card-title'), ok = !v || norm(t ? t.textContent : '').indexOf(v) !== -1;
			c.style.display = ok ? '' : 'none'; if (ok) n++;
		}});
		empty.hidden = n > 0;
	}});
}})();
</script>
''')

# Logos na página plataformas-de-venda (entre os marcadores)
pv = SITE / 'src' / 'content' / 'plataformas-de-venda.html'
chips = '\n'.join(f'\t<chip href="/{s}" logo="{logo(s)}">{html.escape(n)}</chip>' for s, n, *_ in P if logo(s))
block = f'<!--plataformas:start-->\n<h2>Plataformas compatíveis</h2>\n<chips>\n{chips}\n</chips>\n<!--plataformas:end-->'
txt = pv.read_text()
if '<!--plataformas:start-->' in txt:
	txt = re.sub(r'<!--plataformas:start-->.*?<!--plataformas:end-->', lambda m: block, txt, flags=re.S)
else:
	txt = txt.replace('<h2>Como a atribuição funciona</h2>', block + '\n\n<h2>Como a atribuição funciona</h2>', 1)
pv.write_text(txt)

# Atualiza o grupo de plataformas no nav.json
nav_path = SITE / 'src' / 'nav.json'
nav = json.loads(nav_path.read_text())
for tab in nav['tabs']:
	if tab['name'] == 'Integrações':
		tab['groups'] = [
			{'name': 'Visão geral', 'pages': ['integracoes', 'webhook-generico']},
			{'name': 'Plataformas de venda', 'pages': [s for s, *_ in P]},
		]
nav_path.write_text(json.dumps(nav, ensure_ascii=False, indent='\t') + '\n')
