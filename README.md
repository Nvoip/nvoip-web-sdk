# nvoip-web-sdk

[![CI](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![npm downloads](https://img.shields.io/npm/dm/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![Nvoip](https://img.shields.io/badge/Nvoip-site-00A3E0?style=flat-square)](https://www.nvoip.com.br/) [![API v2](https://img.shields.io/badge/API-v2-1F6FEB?style=flat-square)](https://www.nvoip.com.br/api/) [![Docs](https://img.shields.io/badge/docs-Apiary-6A737D?style=flat-square)](https://nvoip.docs.apiary.io/) [![Postman](https://img.shields.io/badge/Postman-workspace-FF6C37?style=flat-square)](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart) [![Stack](https://img.shields.io/badge/stack-JavaScript-F7DF1E?style=flat-square)](https://github.com/Nvoip/nvoip-api-examples) [![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

SDK web oficial da [Nvoip](https://www.nvoip.com.br/) para embutir autenticação por telefone e código usando a API v2.

## Objetivo

Esse repo entrega uma UI pronta para copiar e colar na aplicacao do cliente:

- popup para digitar o telefone
- popup para digitar o codigo recebido
- callbacks para integrar com o backend do cliente

## Instalacao

```bash
npm install nvoip-web-sdk
```

## Importante

Nao exponha `napikey`, `user-token`, `client_secret` ou qualquer credencial da Nvoip no browser.

O fluxo recomendado e:

1. o frontend abre o widget
2. o widget chama um endpoint do seu backend para iniciar o OTP
3. o backend chama a API da Nvoip
4. o widget pede o codigo
5. o widget chama outro endpoint do seu backend para validar o codigo

## Uso rapido

```html
<link rel="stylesheet" href="./dist/nvoip-auth-widget.css" />
<script src="./dist/nvoip-auth-widget.js"></script>

<button id="nvoip-auth-trigger">Validar telefone</button>

<script>
  NvoipAuthWidget.mount(document.getElementById("nvoip-auth-trigger"), {
    startVerification: async ({ phone }) => {
      const response = await fetch("/api/nvoip/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });

      return response.json();
    },
    confirmVerification: async ({ sessionId, code, phone }) => {
      const response = await fetch("/api/nvoip/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code, phone })
      });

      return response.json();
    },
    onSuccess: ({ phone, result }) => {
      console.log("Telefone validado", phone, result);
    }
  });
</script>
```

## Arquivos principais

- `dist/nvoip-auth-widget.js`
- `dist/nvoip-auth-widget.css`
- `examples/mock-demo.html`
- `examples/server-node.mjs`

## Backend de exemplo

O arquivo `examples/server-node.mjs` mostra um backend minimo com dois endpoints:

- `POST /api/nvoip/auth/start`
- `POST /api/nvoip/auth/confirm`

Ele usa OTP da Nvoip por servidor, sem expor credenciais no navegador.

Para rodar o exemplo:

```bash
cp .env.example .env
node examples/server-node.mjs
```

Para rodar a demo mock sem credenciais reais:

```bash
npm run demo:mock
open http://127.0.0.1:4173/examples/mock-demo.html
```

## Links oficiais

- [Site da Nvoip](https://www.nvoip.com.br/)
- [Documentação da API](https://nvoip.docs.apiary.io/)
- [Página da API](https://www.nvoip.com.br/api/)
- [Workspace Postman](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart)
- [Hub de exemplos](https://github.com/Nvoip/nvoip-api-examples)
