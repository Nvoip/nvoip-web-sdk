# nvoip-web-sdk

[![CI](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Nvoip/nvoip-web-sdk/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![npm downloads](https://img.shields.io/npm/dm/nvoip-web-sdk?style=flat-square)](https://www.npmjs.com/package/nvoip-web-sdk) [![Nvoip](https://img.shields.io/badge/Nvoip-site-00A3E0?style=flat-square)](https://www.nvoip.com.br/) [![API v2](https://img.shields.io/badge/API-v2-1F6FEB?style=flat-square)](https://www.nvoip.com.br/api/) [![Docs](https://img.shields.io/badge/docs-Apiary-6A737D?style=flat-square)](https://nvoip.docs.apiary.io/) [![Postman](https://img.shields.io/badge/Postman-workspace-FF6C37?style=flat-square)](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart) [![Stack](https://img.shields.io/badge/stack-JavaScript-F7DF1E?style=flat-square)](https://github.com/Nvoip/nvoip-api-examples) [![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

SDK web oficial da [Nvoip](https://www.nvoip.com.br/) para embutir validação OTP e 2FA por SMS, WhatsApp ou ligação usando a API v2.

## Objetivo

Esse repo entrega uma UI pronta para copiar e colar na aplicação do cliente:

- fluxo `start2FA()` para rodar depois do login primário e retornar para a URL anterior
- fluxo `startOTP()` para validar telefone antes de cadastro, checkout ou recuperação de conta
- tela de seleção de método de verificação
- envio por canais habilitados pelo desenvolvedor
- tela para confirmar o código recebido
- callbacks para integrar com o backend do cliente

## Instalação

```bash
npm install nvoip-web-sdk
```

## Importante

Não exponha `napikey`, `user-token`, `client_secret` ou qualquer credencial da Nvoip no browser.

O fluxo recomendado é:

1. o frontend abre o widget
2. o widget exibe apenas os canais habilitados pelo desenvolvedor
3. o widget chama um endpoint do seu backend para iniciar OTP ou 2FA
4. o backend chama a API da Nvoip
5. o widget pede o código
6. o widget chama outro endpoint do seu backend para validar o código

## Uso rápido

### 2FA depois do login

Use quando o backend já validou e-mail/senha e precisa confirmar uma segunda etapa antes de concluir a sessão.

```html
<link rel="stylesheet" href="./dist/nvoip-auth-widget.css" />
<script src="./dist/nvoip-auth-widget.js"></script>

<script>
  async function startVerification(payload) {
    const response = await fetch("/api/nvoip/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  async function confirmVerification(payload) {
    const response = await fetch("/api/nvoip/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  function afterPasswordLogin(user) {
    NvoipAuthWidget.start2FA({
      channels: ["sms", "voice", "whatsapp"],
      phone: user.phone,
      maskedPhone: user.maskedPhone,
      accountLabel: user.email,
      returnTo: "/app",
      startVerification,
      confirmVerification
    });
  }
</script>
```

### OTP direto

Use quando o usuário precisa validar um telefone antes de continuar em cadastro, checkout ou recuperação de conta.

```html
<button id="validate-phone">Validar telefone</button>

<script>
  document.getElementById("validate-phone").addEventListener("click", () => {
    NvoipAuthWidget.startOTP({
      channels: ["whatsapp", "sms", "voice"],
      phone: document.querySelector("#phone").value,
      returnTo: "/cadastro/concluido",
      startVerification,
      confirmVerification
    });
  });
</script>
```

### Modo avançado

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

Também é possível customizar texto por canal:

```js
channels: [
  { id: "sms", label: "SMS", description: "Código para o celular {maskedPhone}." },
  { id: "whatsapp", label: "WhatsApp", description: "Código por WhatsApp para {maskedPhone}." }
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

Teste isolado do OAuth:

```bash
npm run oauth:test
```

O script confirma o OAuth e mascara `access_token` e `refresh_token` por padrão. Use `PRINT_ACCESS_TOKEN=1 npm run oauth:test` apenas em ambiente local se precisar ver o token bruto.

Variáveis principais:

```env
NVOIP_BASE_URL=https://api.nvoip.com.br/v2
NVOIP_NUMBERSIP=
NVOIP_USER_TOKEN=
NVOIP_OAUTH_CLIENT_ID=
NVOIP_OAUTH_CLIENT_SECRET=
NVOIP_NAPIKEY=
NVOIP_VERIFY_FLOW=otp
NVOIP_ALLOWED_CHANNELS=sms,voice
NVOIP_DEMO_PHONE=
NVOIP_EXPOSE_DEMO_PHONE=false
NVOIP_WHATSAPP_TEMPLATE_ID=
NVOIP_WHATSAPP_INSTANCE=
NVOIP_WHATSAPP_LANGUAGE=pt_BR
HOST=127.0.0.1
PORT=3333
```

Notas de integração:

- `sms` em `otp` usa `/otp` com `phoneNumber`, `methods.sms=true` e `/check/otp`.
- `voice` usa `/otp` com `phoneNumber`, `methods.torpedo=true` e `/check/otp`.
- `sms` em `2fa` usa `/2fa` e `/check/2fa`, portanto precisa de `NVOIP_NAPIKEY`.
- `whatsapp` no exemplo usa `/wa/sendTemplates`; o backend gera o código, envia em um template aprovado e valida o código localmente.
- O template de WhatsApp precisa estar aprovado e aceitar uma variável de corpo para o código.

## Arquivos principais

- `dist/nvoip-auth-widget.js`
- `dist/nvoip-auth-widget.css`
- `examples/mock-demo.html`
- `examples/live-demo.html`
- `examples/server-node.mjs`

## Links oficiais

- [Site da Nvoip](https://www.nvoip.com.br/)
- [Documentação da API](https://nvoip.docs.apiary.io/)
- [Página da API](https://www.nvoip.com.br/api/)
- [Workspace Postman](https://nvoip-api.postman.co/workspace/e671d01f-168a-4c38-8d0e-c217229dd61a/team-quickstart)
- [Hub de exemplos](https://github.com/Nvoip/nvoip-api-examples)
