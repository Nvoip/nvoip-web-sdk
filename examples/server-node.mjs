import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv(path.join(rootDir, ".env"));

const baseUrl = process.env.NVOIP_BASE_URL || "https://api.nvoip.com.br/v2";
const defaultFlow = normalizeFlow(process.env.NVOIP_VERIFY_FLOW || "otp");
const allowedChannels = parseChannels(process.env.NVOIP_ALLOWED_CHANNELS || "sms");
const localCodeSessions = new Map();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseChannels(value) {
  const channels = String(value || "sms")
    .split(",")
    .map((item) => normalizeChannel(item.trim()))
    .filter(Boolean);
  return channels.length ? channels : ["sms"];
}

function normalizeChannel(channel) {
  const value = String(channel || "").toLowerCase();
  if (value === "call" || value === "phone") {
    return "voice";
  }

  return ["sms", "voice", "whatsapp"].includes(value) ? value : "";
}

function normalizeFlow(flow) {
  return String(flow || "otp").toLowerCase() === "2fa" ? "2fa" : "otp";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function encodeBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function createAccessToken() {
  const clientId = process.env.NVOIP_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.NVOIP_OAUTH_CLIENT_SECRET || "";
  const numbersip = process.env.NVOIP_NUMBERSIP || "";
  const userToken = process.env.NVOIP_USER_TOKEN || "";

  if (!clientId || !clientSecret || !numbersip || !userToken) {
    throw new Error(
      "Configure NVOIP_OAUTH_CLIENT_ID, NVOIP_OAUTH_CLIENT_SECRET, NVOIP_NUMBERSIP and NVOIP_USER_TOKEN.",
    );
  }

  const body = new URLSearchParams({
    username: numbersip,
    password: userToken,
    grant_type: "password",
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload.access_token;
}

async function sendOtp(phone, channel) {
  const accessToken = await createAccessToken();
  const body = channel === "voice" ? { voice: phone } : { sms: phone };
  const response = await fetch(`${baseUrl}/otp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  const sessionId = payload.key;
  if (!sessionId) {
    throw new Error("A API /otp nao retornou a chave de validacao.");
  }

  return {
    sessionId,
    message: channel === "voice" ? "Ligacao enviada com o codigo." : "SMS enviado com o codigo.",
    provider: payload,
  };
}

async function checkOtp(code, key) {
  const response = await fetch(
    `${baseUrl}/check/otp?code=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`,
    { method: "GET" },
  );

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

async function send2faSms(phone) {
  const accessToken = await createAccessToken();
  const response = await fetch(`${baseUrl}/2fa`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cellPhone: phone }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  const sessionId = payload.token2fa || payload["2fa-token"] || payload.key;
  if (!sessionId) {
    throw new Error("A API /2fa nao retornou token2fa.");
  }

  return {
    sessionId,
    message: "Codigo 2FA enviado por SMS.",
    provider: payload,
  };
}

async function check2fa(code, token2fa) {
  const napikey = process.env.NVOIP_NAPIKEY || "";
  if (!napikey) {
    throw new Error("Configure NVOIP_NAPIKEY to validate the /check/2fa endpoint.");
  }

  const response = await fetch(
    `${baseUrl}/check/2fa?token2fa=${encodeURIComponent(token2fa)}&pin=${encodeURIComponent(
      code,
    )}&napikey=${encodeURIComponent(napikey)}`,
    { method: "GET" },
  );

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

async function sendWhatsappCode(phone, flow) {
  const templateId = process.env.NVOIP_WHATSAPP_TEMPLATE_ID || "";
  const instance = process.env.NVOIP_WHATSAPP_INSTANCE || "";
  const language = process.env.NVOIP_WHATSAPP_LANGUAGE || "pt_BR";

  if (!templateId || !instance) {
    throw new Error("Configure NVOIP_WHATSAPP_TEMPLATE_ID and NVOIP_WHATSAPP_INSTANCE.");
  }

  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  const accessToken = await createAccessToken();
  const response = await fetch(`${baseUrl}/wa/sendTemplates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idTemplate: templateId,
      destination: phone,
      instance,
      language,
      bodyVariables: [code],
      functions: { to_flow: false },
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  const sessionId = crypto.randomUUID();
  localCodeSessions.set(sessionId, {
    code,
    phone,
    flow,
    channel: "whatsapp",
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return {
    sessionId,
    message: "Codigo enviado por WhatsApp.",
    provider: payload,
  };
}

function checkLocalCode(code, sessionId) {
  const session = localCodeSessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    localCodeSessions.delete(sessionId);
    throw new Error("Codigo expirado ou sessao invalida.");
  }

  if (session.code !== code) {
    throw new Error("Codigo invalido.");
  }

  localCodeSessions.delete(sessionId);
  return { status: "ok" };
}

async function startVerification({ phone, channel, flow }) {
  const selectedChannel = normalizeChannel(channel) || allowedChannels[0];
  const selectedFlow = normalizeFlow(flow || defaultFlow);

  if (!phone) {
    throw new Error("Informe o telefone.");
  }

  if (!allowedChannels.includes(selectedChannel)) {
    throw new Error(`Canal nao habilitado neste backend: ${selectedChannel}.`);
  }

  if (selectedChannel === "whatsapp") {
    return sendWhatsappCode(phone, selectedFlow);
  }

  if (selectedFlow === "2fa" && selectedChannel === "sms") {
    return send2faSms(phone);
  }

  return sendOtp(phone, selectedChannel);
}

async function confirmVerification({ sessionId, code, channel, flow }) {
  const selectedChannel = normalizeChannel(channel) || allowedChannels[0];
  const selectedFlow = normalizeFlow(flow || defaultFlow);

  if (!sessionId || !code) {
    throw new Error("Informe sessionId e codigo.");
  }

  if (selectedChannel === "whatsapp" || localCodeSessions.has(sessionId)) {
    return checkLocalCode(code, sessionId);
  }

  if (selectedFlow === "2fa" && selectedChannel === "sms") {
    return check2fa(code, sessionId);
  }

  return checkOtp(code, sessionId);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(res, pathname) {
  const route = pathname === "/" ? "/examples/live-demo.html" : pathname;
  let filePath = "";

  if (route.startsWith("/dist/") || route.startsWith("/examples/")) {
    filePath = path.resolve(rootDir, `.${route}`);
  }

  if (!filePath || !filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  };

  res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain; charset=utf-8" });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/api/nvoip/config") {
      sendJson(res, 200, {
        flow: defaultFlow,
        channels: allowedChannels,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/nvoip/auth/start") {
      const payload = await startVerification(await readJson(req));
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/nvoip/auth/confirm") {
      const payload = await confirmVerification(await readJson(req));
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === "GET") {
      serveStatic(res, url.pathname);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: String(error.message || error) });
  }
});

const port = Number(process.env.PORT || 3333);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`Nvoip web SDK sample server listening on http://${host}:${port}`);
  console.log(`Enabled flow: ${defaultFlow}. Enabled channels: ${allowedChannels.join(", ")}`);
});
