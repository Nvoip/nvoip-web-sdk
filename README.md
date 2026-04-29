# nvoip-web-sdk

SDK web oficial da [Nvoip](https://www.nvoip.com.br/) para embutir autenticação por telefone e código usando a API v2.

## Objetivo

Esse repo entrega uma UI pronta para copiar e colar na aplicacao do cliente:

- popup para digitar o telefone
- popup para digitar o codigo recebido
- callbacks para integrar com o backend do cliente

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

## Documentacao oficial

- https://nvoip.docs.apiary.io/
- https://www.nvoip.com.br/api
