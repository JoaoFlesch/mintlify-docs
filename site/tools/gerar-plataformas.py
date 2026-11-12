#!/usr/bin/env python3
"""Gera as páginas de plataformas de venda (site/src/content/<slug>.html) a partir dos dados abaixo.
Uso: python3 site/tools/gerar-plataformas.py  (rode de novo depois de editar os dados)."""
import json, os, re, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
IMG_OUT = SITE / 'src' / 'img' / 'plataformas'
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
	out = ['---', f'title: {name}', 'icon: cart', 'eyebrow: Plataformas de venda',
		f'description: Receba vendas, reembolsos e chargebacks da {name} no Trackup, atribuídos ao anúncio de origem.', '---']
	if slug == 'nuvemshop':
		out.append('<p>A Nuvemshop conecta por autorização (OAuth): o Trackup instala sozinho os webhooks de pedidos e o script de rastreamento na loja.</p>')
	else:
		out.append(f'<p>A integração tem duas partes: o Trackup envia o ID do clique para o checkout da {name}, e a {name} devolve esse ID no webhook de cada venda.</p>')
	out.append('<h2>Antes de começar</h2><ul><li>Um projeto com <a href="/dominios">domínio primário</a> configurado. A URL do webhook usa esse domínio.</li>'
		f'<li>Acesso de administrador à sua conta na {name}.</li></ul>')
	out.append('<h2>1. Crie a plataforma no Trackup</h2><steps>')
	out.append(f'<step title="Adicione a plataforma"><p>Vá em <strong>Integração › Plataformas de vendas</strong>, clique em <strong>Adicionar plataforma</strong> e escolha <strong>{esc(kind)}</strong>.</p></step>')
	if key:
		out.append(f'<step title="Confira os parâmetros"><p>O Trackup preenche os parâmetros do checkout sozinho: o ID do clique vai em <code>{esc(key)}</code> e as UTMs vão junto. Só mude se a {name} pedir outro nome de parâmetro.</p></step>')
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
			steps = [s for s in flow['flow'][1:]]
			out.append('<ol>')
			for s in steps:
				s = esc(s).replace('Colar URL do Trackup', 'Cole a URL do Trackup').replace('Cole a Url do Trackup', 'Cole a URL do Trackup').replace('Url', 'URL')
				out.append(f'<li>{s}</li>')
			out.append('</ol>')
			imgs = [compress(i) for i in flow['imgs'] if not TRACKUP_SIDE.search(i)]
			for i in [x for x in imgs if x]:
				out.append(f'<shot src="{i}" caption="Configuração no painel da {name}"></shot>')
		else:
			out.append(f'<ol><li>No painel da {name}, abra a área de <strong>webhooks</strong> ou <strong>postback</strong>.</li>'
				f'<li>Crie uma integração nova e cole a URL do Trackup.</li>'
				f'<li>Ative os eventos de {events or "compra aprovada, reembolso e chargeback"}.</li>'
				'<li>Selecione os produtos que devem enviar vendas, se a plataforma pedir, e salve.</li></ol>')
			out.append(f'<shot src="img/plataformas/{slug}-webhook.webp" caption="Configuração do webhook na {name}" todo="Painel da {esc(name)} na tela de criação de webhook/postback, com a URL do Trackup colada e os eventos de compra aprovada, reembolso e chargeback marcados. Dados da conta borrados."></shot>')
		if events and flow:
			out.append(f'<p>Eventos a ativar: {events}.</p>')
	out.append(f'<h2>{"3" if slug != "nuvemshop" else "2"}. Teste</h2>')
	out.append(f'<p>Acesse sua landing page por um link do Trackup, clique no botão de compra e faça uma compra de teste. A venda deve aparecer em <strong>Logs › Conversões</strong> com a campanha preenchida.</p>')
	out.append('<callout type="warning"><p>Se a venda aparecer como <strong>Click ID ausente</strong>, o botão da página não está apontando para o link da <a href="/ofertas">oferta</a> no Trackup, ou o checkout não está devolvendo o parâmetro do clique.</p></callout>')
	out.append('<p>Não achou sua plataforma? Use o <a href="/webhook-generico">webhook genérico</a>.</p>')
	return '\n'.join(out) + '\n'

for slug, name, kind, key, events, note in P:
	(SITE / 'src' / 'content' / f'{slug}.html').write_text(page(slug, name, kind, key, events, note))

json.dump([{'slug': s, 'name': n} for s, n, *_ in P], open(SITE / 'src' / 'plataformas.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(P)} páginas de plataforma geradas')

# Página índice de integrações
cards = '\n'.join(f'\t<card title="{html.escape(n)}" href="/{s}">{html.escape(k)}</card>' for s, n, k, *_ in P)
(SITE / 'src' / 'content' / 'integracoes.html').write_text(f'''---
title: Integrações
icon: plug
eyebrow: Plataformas de venda
description: Passo a passo para conectar cada plataforma de venda ao Trackup.
toc: false
---
<p>O Trackup recebe vendas de {len(P)} plataformas por webhook. Escolha a sua abaixo. Se ela não estiver na lista, use o <a href="/webhook-generico">webhook genérico</a>.</p>
<callout type="tip"><p>Primeira vez integrando? Leia antes <a href="/plataformas-de-venda">como a atribuição de vendas funciona</a>.</p></callout>
<cards cols="3">
{cards}
	<card title="Webhook genérico" href="/webhook-generico">Qualquer checkout ou sistema próprio</card>
</cards>
''')

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
