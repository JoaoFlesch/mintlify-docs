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

## Hospedar no Trackup

O build gera um `index.html` por página em `dist/<slug>/`, com CSS e JS embutidos. Para hospedar em um projeto do Trackup:

1. Cada página vira uma página **Upload HTML** com o caminho igual ao slug (`dist/pages.json` lista slug, caminho e arquivo). A home usa o caminho `/`.
2. As imagens vão no zip de cada página, junto do `index.html`, para o Trackup reescrever os caminhos para a CDN.
3. Cada entrada de `dist/redirects.json` vira uma página **Redirect** com status 301.
4. Por último, o domínio `docs.trackup.me` aponta para o projeto.
