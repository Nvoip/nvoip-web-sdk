# nvoip-web-sdk

[![CI](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![npm downloads](https://img.shields.io/npm/dm/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![Nvoip](https://img.shields.io/badge/Nvoip-site-00A3E0?style=flat-square)](https://www.nvoip.com.br/) [![API v2](https://img.shields.io/badge/API-v2-1F6FEB?style=flat-square)](https://www.nvoip.com.br/api/) [![Docs](https://img.shields.io/badge/docs-Apiary-6A737D?style=flat-square)](https://nvoip.docs.apiary.io/) [![Postman](https://img.shields.io/badge/Postman-workspace-FF6C37?style=flat-square)](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart) [![Stack](https://img.shields.io/badge/stack-JavaScript-F7DF1E?style=flat-square)](https://github.com/Nvoip/nvoip-api-examples) [![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

SDK web oficial da [Nvoip](https://www.nvoip.com.br/) para embutir validacao OTP e 2FA por SMS, WhatsApp ou ligacao usando a API v2.

## Objetivo

Esse repo entrega uma UI pronta para copiar e colar na aplicacao do cliente:

- tela de selecao de metodo de verificacao
- envio por canais habilitados pelo desenvolvedor
- tela para confirmar o codigo recebido
- callbacks para integrar com o backend do cliente

## Instalacao

```bash
npm install nvoip-web-sdk
```

## Importante

Nao exponha `napikey`, `user-token`, `client_secret` ou qualquer credencial da Nvoip no browser.

O fluxo recomendado e:

1. o frontend abre o widget
2. o widget exibe apenas os canais habilitados pelo desenvolvedor
3. o widget chama um endpoint do seu backend para iniciar OTP ou 2FA
4. o backend chama a API da Nvoip
5. o widget pede o codigo
6. o widget chama outro endpoint do seu backend para validar o codigo

## Uso rapido

```html
<link rel="stylesheet" href="./dist/nvoip-auth-widget.css" />
<script src="./dist/nvoip-auth-widget.js"></script>

<button id="nvoip-auth-trigger">Validar acesso</button>

<script>
  NvoipAuthWidget.mount(document.getElementById("nvoip-auth-trigger"), {
    flow: "otp", // "otp" ou "2fa"
    channels: ["whatsapp", "sms", "voice"],
    accountLabel: "cliente@nvoip.com.br",
    startVerification: async ({ phone, channel, flow }) => {
      const response = await fetch("/api/nvoip/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel, flow })
      });

      return response.json();
    },
    confirmVerification: async ({ sessionId, code, phone, channel, flow }) => {
      const response = await fetch("/api/nvoip/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code, phone, channel, flow })
      });

      return response.json();
    },
    onSuccess: ({ phone, channel, flow, result }) => {
      console.log("Validado", { phone, channel, flow, result });
    }
  });
</script>
```

## Canais

Use `channels` para controlar o que aparece no front:

```js
channels: ["sms", "whatsapp", "voice"]
```

Tambem e possivel customizar texto por canal:

```js
channels: [
  { id: "sms", label: "SMS", description: "Codigo para o celular {maskedPhone}." },
  { id: "whatsapp", label: "WhatsApp", description: "Codigo por WhatsApp para {maskedPhone}." }
]
```

## Demos

Demo mock, sem credenciais reais:

```bash
npm run demo:mock
open http://127.0.0.1:4173/examples/mock-demo.html
```

Demo real com backend local:

```bash
cp .env.example .env
npm run demo:real
open http://127.0.0.1:3333
```

Variaveis principais:

```env
NVOIP_BASE_URL=https://api.nvoip.com.br/v2
NVOIP_NUMBERSIP=
NVOIP_USER_TOKEN=
NVOIP_OAUTH_CLIENT_ID=
NVOIP_OAUTH_CLIENT_SECRET=
NVOIP_NAPIKEY=
NVOIP_VERIFY_FLOW=otp
NVOIP_ALLOWED_CHANNELS=sms,voice
NVOIP_WHATSAPP_TEMPLATE_ID=
NVOIP_WHATSAPP_INSTANCE=
NVOIP_WHATSAPP_LANGUAGE=pt_BR
HOST=127.0.0.1
PORT=3333
```

Notas de integracao:

- `sms` em `otp` usa `/otp` e `/check/otp`.
- `voice` usa `/otp` com campo `voice` e `/check/otp`.
- `sms` em `2fa` usa `/2fa` e `/check/2fa`, portanto precisa de `NVOIP_NAPIKEY`.
- `whatsapp` no exemplo usa `/wa/sendTemplates`; o backend gera o codigo, envia em um template aprovado e valida o codigo localmente.
- O template de WhatsApp precisa estar aprovado e aceitar uma variavel de corpo para o codigo.

## Arquivos principais

- `dist/nvoip-auth-widget.js`
- `dist/nvoip-auth-widget.css`
- `examples/mock-demo.html`
- `examples/live-demo.html`
- `examples/server-node.mjs`

## Links oficiais

- [Site da Nvoip](https://www.nvoip.com.br/)
- [Documentacao da API](https://nvoip.docs.apiary.io/)
- [Pagina da API](https://www.nvoip.com.br/api/)
- [Workspace Postman](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart)
- [Hub de exemplos](https://github.com/Nvoip/nvoip-api-examples)
