# Fé Conectada — Web TV (PWA + GitHub Pages + Google Apps Script)

Site estático (player HLS com Video.js) publicável no **GitHub Pages**. O “backend” é um projeto **Google Apps Script** ligado a uma **planilha**: leitura pública da programação/stream e gravação protegida por token a partir do painel admin.

## Estrutura

| Caminho | Descrição |
|--------|-----------|
| Raiz (`index.html`, `script.js`, …) | Front-end PWA |
| `api-config.js` | URL do Web App Apps Script (`scriptUrl`). Pode ficar vazio para modo só local |
| `api-config.example.js` | Modelo para copiar |
| `google-apps-script/Code.gs` | Código para colar no editor do Apps Script |
| `.github/workflows/github-pages.yml` | Publicação automática no Pages ao dar push em `main` ou `master` |

## 1. Repositório no GitHub

1. Crie um repositório e envie estes ficheiros.
2. **Settings → Pages → Build and deployment**: origem **GitHub Actions**.
3. Faça push na branch `main` (ou `master`). O workflow **Deploy GitHub Pages** gera o site.

A URL final será algo como `https://SEU_USUARIO.github.io/SEU_REPO/`.

## 2. Google Sheets + Apps Script

**Opção A — Script ligado à planilha (recomendado)**

1. Crie uma planilha e abra **Extensões → Apps Script**.
2. Cole o código de `google-apps-script/Code.gs`.
3. Em **⚙ → Propriedades do script**, defina só `ADMIN_TOKEN` (frase secreta longa).
4. Execute **`setupSheet`** uma vez (▶ no editor) e autorize.
5. **Implantar → Novo implantamento → App da Web** — Executar como: **Eu**; acesso: **Qualquer pessoa**. Copie a URL `/exec`.

**Opção B — Projeto independente em script.google.com**

1. Crie projeto em [script.google.com](https://script.google.com), cole `Code.gs`.
2. Propriedades: `SPREADSHEET_ID` (ID da planilha na URL entre `/d/` e `/edit`) e `ADMIN_TOKEN`.
3. Execute **`setupSheet`**, depois implante o Web App como acima.

## 3. Ligar o site à API

1. Edite `api-config.js` no repositório:

   ```js
   window.FEC_API = {
     scriptUrl: 'https://script.google.com/macros/s/...../exec',
   };
   ```

2. Faça commit e push. Após o deploy do Pages, o player e o texto “Programa atual” passam a usar a planilha.

**JSONP:** se o `fetch` falhar por CORS, o `script.js` tenta automaticamente `?callback=...`.

## 4. Painel admin

- Ícone de **cadeado** no cabeçalho → fluxo de login (senha em `auth-config.js`, ofuscada).
- Com API ativa, aparece o campo **Token da API** (mesmo valor que `ADMIN_TOKEN`). O token fica em `sessionStorage` após preencher.
- **Sair** remove sessão e token da sessão.

Segurança: o token e a senha do painel **não substituem um servidor com HTTPS e autenticação forte**; são adequados para equipes pequenas. Quem abre as DevTools do navegador ainda pode inspecionar pedidos.

## 5. Opcional: clasp (linha de comando Google)

Na pasta `google-apps-script` pode usar a [clasp](https://github.com/google/clasp) para sincronizar `Code.gs` com o projeto, se preferir.

## Modo sem Google

Deixe `scriptUrl: ''` em `api-config.js`. O stream e o nome do programa passam a depender do **localStorage** após salvar no painel (sem planilha).
