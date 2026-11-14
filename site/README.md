# Documentação do Trackup (HTML puro)

Site estático da documentação, sem dependências. Substitui a versão em Mintlify da raiz do repositório.

## Rodar

```bash
node site/build.mjs           # gera site/dist
node site/build.mjs --serve   # gera e serve em http://localhost:4321
```

Precisa só de Node 18+.

## Estrutura

| Caminho | O quê |
| :- | :- |
| `src/content/*.html` | Páginas. Front matter (`title`, `description`, `icon`, `sidebarTitle`, `eyebrow`) + HTML com componentes. |
| `src/nav.json` | Abas, grupos e ordem das páginas. |
| `src/openapi.json` | Especificação da API. A aba API é gerada dela (`src/api.mjs`). |
| `src/redirects.json` | URLs da documentação antiga que redirecionam para as novas. |
| `src/img/` | Imagens. Prints novos entram em `src/img/<nome>.png`. |
| `src/layout.html`, `src/assets/` | Layout, CSS e JS (busca, tema, abas, cópia, lightbox). |
| `tools/gerar-plataformas.py` | Gera as 33 páginas de plataformas de venda e a aba Integrações. |
| `PRINTS.md` | Lista de prints pendentes, gerada pelo build. |

## Componentes

```html
<steps><step title="...">...</step></steps>
<callout type="note|tip|warning|danger">...</callout>
<cards cols="2"><card title="..." icon="..." href="/...">...</card></cards>
<tabs><tab title="...">...</tab></tabs>
<accordion title="...">...</accordion>
<code-block title="..." lang="bash">...</code-block>
<shot src="img/x.png" caption="..." todo="o que o print deve mostrar"></shot>
```

Um `<shot>` sem a imagem em `src/img` aparece como "Print pendente" e entra em `PRINTS.md`. Ao adicionar o arquivo, o print aparece sozinho.

## Atualizar a referência da API

Baixe `https://api.trackup.me/openapi.json` para `src/openapi.json` (ou leia o recurso `trackup://openapi.json` do MCP) e rode o build.

## Como o site é montado

Cada página tem só o próprio conteúdo e os metadados de SEO. Tudo que se repete fica em arquivos compartilhados:

| Arquivo | O quê |
| :- | :- |
| `assets/style.css` | Todo o visual. |
| `assets/shell.js` | Cabeçalho, abas, menu lateral, paginação, rodapé, busca, tema e interações. Leva o `nav.json` embutido. |
| `assets/search.js` | Índice de busca. Só é baixado quando alguém abre a busca. |
| `assets/favicon.svg`, `assets/og.jpg` | Favicon e imagem de compartilhamento. |

Mudou o menu, o cabeçalho, o rodapé ou o estilo? Reenvie só esses arquivos. As páginas não mudam.

A base dos arquivos compartilhados é `/assets` (raiz do domínio). Para outro endereço, use `node site/build.mjs --assets=https://...`. Mudar a base exige reenviar todas as páginas uma vez.

## SEO e GEO

- `title`, `description`, canonical, Open Graph, Twitter Card e `article:modified_time` em toda página.
- Dados estruturados (JSON-LD): `TechArticle` e `BreadcrumbList` em cada página, `WebSite` na home.
- Breadcrumb visível com link para a aba.
- `sitemap.xml` com a data da última alteração de cada página (do git).
- `robots.txt` liberando buscadores e assistentes de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended e outros).
- `llms.txt` (índice) e `llms-full.txt` (a documentação inteira em texto) para assistentes de IA.
- O conteúdo de cada página está no HTML, sem depender de JavaScript para ser lido.

## Publicar só o que mudou

```bash
node site/build.mjs
node site/changed.mjs          # lista arquivos compartilhados, páginas alteradas, novas e removidas
node site/changed.mjs --mark   # depois de publicar, registra o estado em site/published.json
```

## Hospedar no Trackup

1. Os arquivos compartilhados ficam em um só lugar, servidos em `/assets/...` no domínio da documentação.
2. Cada página vira uma página **Upload HTML** com o caminho igual ao slug (`dist/pages.json` lista slug, caminho e arquivo). A home usa o caminho `/`. As imagens vão junto do `index.html` da página que as usa.
3. `llms.txt`, `llms-full.txt`, `robots.txt` e `sitemap.xml` ficam na raiz do domínio.
4. Cada entrada de `dist/redirects.json` vira uma página **Redirect** com status 301.
5. Por último, o domínio `docs.trackup.me` aponta para o projeto.
