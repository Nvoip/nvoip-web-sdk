import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const widgetSource = await readFile(
  new URL("../dist/nvoip-auth-widget.js", import.meta.url),
  "utf8",
);

function createNode() {
  return {
    addEventListener() {},
    appendChild() {},
    className: "",
    innerHTML: "",
    parentNode: null,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    removeChild() {},
    setAttribute() {},
  };
}

function openWidget({
  search = "",
  origin = "https://integrador.example",
  assign = () => {},
  schedule = setTimeout,
  ...options
} = {}) {
  const document = {
    body: createNode(),
    createElement: createNode,
  };
  const window = {
    document,
    location: { origin, search, assign },
    setTimeout: schedule,
  };
  window.window = window;
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console,
    document,
    setTimeout,
    window,
  });
  vm.runInContext(widgetSource, context);
  return window.NvoipAuthWidget.start2FA({
    phone: "11999990000",
    startVerification: async () => ({ sessionId: "synthetic" }),
    confirmVerification: async () => ({ ok: true }),
    ...options,
  });
}

test("NN-6921: explicit returnTo accepts only a same-origin HTTP/HTTPS destination", () => {
  assert.equal(
    openWidget({ returnTo: "/app?tab=1#done" }).resolveReturnTo(),
    "/app?tab=1#done",
  );
  assert.equal(
    openWidget({
      returnTo: "https://integrador.example/checkout",
    }).resolveReturnTo(),
    "/checkout",
  );
  assert.equal(
    openWidget({ returnTo: "javascript:alert(1)" }).resolveReturnTo(),
    "",
  );
  assert.equal(
    openWidget({
      returnTo: "data:text/html,<script>alert(1)</script>",
    }).resolveReturnTo(),
    "",
  );
  assert.equal(
    openWidget({
      returnTo: "https://attacker.example/phish",
    }).resolveReturnTo(),
    "",
  );
  assert.equal(
    openWidget({ returnTo: "//attacker.example/phish" }).resolveReturnTo(),
    "",
  );
  assert.equal(
    openWidget({
      returnTo: "https://user:secret@integrador.example/private",
    }).resolveReturnTo(),
    "",
  );
});

test("NN-6921: query destinations require opt-in and remain same-origin", () => {
  const search = "?returnTo=%2Fconta%3Fok%3D1";
  assert.equal(openWidget({ search }).resolveReturnTo(), "");
  assert.equal(
    openWidget({ search, allowReturnToFromQuery: true }).resolveReturnTo(),
    "/conta?ok=1",
  );
  assert.equal(
    openWidget({
      search: "?redirect=https%3A%2F%2Fattacker.example%2Fphish",
      allowReturnToFromQuery: true,
    }).resolveReturnTo(),
    "",
  );
  assert.equal(
    openWidget({
      search: "?return_to=javascript%3Adocument.body.dataset.xss%3D1",
      allowReturnToFromQuery: true,
    }).resolveReturnTo(),
    "",
  );
});

test("NN-6921: function returnTo is validated with the same policy", () => {
  assert.equal(
    openWidget({ returnTo: () => "/dashboard" }).resolveReturnTo(),
    "/dashboard",
  );
  assert.equal(
    openWidget({
      returnTo: () => "https://attacker.example",
    }).resolveReturnTo(),
    "",
  );
});

test("NN-6741: noncanonical navigation destinations are rejected", () => {
  const allowedReturnToOrigins = ["https://parceiro.example"];
  for (const returnTo of [
    "//integrador.example/app",
    "//parceiro.example/app",
    "https://integrador.example//app",
    "https://integrador.example:8443/app",
    "http://integrador.example/app",
    "/%2Fapp",
    "/%255Capp",
    "/%25%32%46app",
    "javascript%3Avoid(0)",
    "data%3Atext/plain,example",
  ]) {
    assert.equal(openWidget({ returnTo, allowedReturnToOrigins }).resolveReturnTo(), "", returnTo);
  }
});

test("NN-6741: an external URL requires an exact configured origin", () => {
  const allowedReturnToOrigins = ["https://parceiro.example:8443"];
  const returnTo = "https://parceiro.example:8443/app?tab=1#done";
  assert.equal(openWidget({ returnTo }).resolveReturnTo(), "");
  assert.equal(openWidget({ returnTo, allowedReturnToOrigins }).resolveReturnTo(), returnTo);

  for (const destination of [
    "https://parceiro.example/app",
    "https://parceiro.example.outro.example:8443/app",
    "http://parceiro.example:8443/app",
    "https://user@parceiro.example:8443/app",
  ]) {
    assert.equal(
      openWidget({ returnTo: destination, allowedReturnToOrigins }).resolveReturnTo(),
      "",
      destination,
    );
  }

  const search = new URLSearchParams({ redirect: returnTo }).toString();
  assert.equal(openWidget({ search, allowedReturnToOrigins }).resolveReturnTo(), "");
  assert.equal(
    openWidget({ search, allowedReturnToOrigins, allowReturnToFromQuery: true }).resolveReturnTo(),
    returnTo,
  );
});

test("NN-6741: callbacks and navigation share the validated redirect policy", async () => {
  for (const [destination, expected] of [
    ["https://integrador.example/app%20local?name=a%2Fb#done", "/app%20local?name=a%2Fb#done"],
    ["https://parceiro.example/app", "https://parceiro.example/app"],
    ["https://externo.example/app", ""],
    ["//integrador.example/app", ""],
    ["/%2Fapp", ""],
    ["/%25%32%46app", ""],
  ]) {
    const redirects = [];
    const callbacks = [];
    const search = new URLSearchParams({ return_to: destination }).toString();
    const widget = openWidget({
      search,
      allowReturnToFromQuery: true,
      allowedReturnToOrigins: ["https://parceiro.example"],
      assign: (url) => redirects.push(url),
      schedule: (callback) => callback(),
      startVerification: async ({ returnTo }) => {
        callbacks.push(returnTo);
        return { sessionId: "synthetic" };
      },
      onSuccess: ({ returnTo }) => {
        callbacks.push(returnTo);
      },
    });
    let confirm;
    const control = { addEventListener() {} };
    const elements = {
      '[data-role="back"]': control,
      '[data-role="resend"]': control,
      '[data-role="code"]': { value: "123456", focus() {} },
      '[data-role="confirm"]': {
        addEventListener(event, handler) {
          if (event === "click") confirm = handler;
        },
      },
    };
    widget.modal.querySelector = (selector) => elements[selector] || null;

    await widget.startSelectedMethod(widget.methods[0]);
    await confirm();

    assert.deepEqual(callbacks, [expected, expected]);
    const expectedRedirect = expected && new URL(expected, "https://integrador.example").href;
    assert.deepEqual(redirects, expectedRedirect ? [expectedRedirect] : []);
  }
});
