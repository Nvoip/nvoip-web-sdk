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
  ...options
} = {}) {
  const document = {
    body: createNode(),
    createElement: createNode,
  };
  const window = {
    document,
    location: { origin, search },
    setTimeout,
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
