import http from "node:http";

const baseUrl = process.env.NVOIP_BASE_URL || "https://api.nvoip.com.br/v2";

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

function encodeBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function createAccessToken() {
  const clientId = process.env.NVOIP_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.NVOIP_OAUTH_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing OAuth client credentials. Configure NVOIP_OAUTH_CLIENT_ID and NVOIP_OAUTH_CLIENT_SECRET.");
  }

  const basicAuth = encodeBasicAuth(clientId, clientSecret);

  const body = new URLSearchParams({
    username: process.env.NVOIP_NUMBERSIP || "",
    password: process.env.NVOIP_USER_TOKEN || "",
    grant_type: "password",
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload.access_token;
}

async function sendOtp(phone) {
  const accessToken = await createAccessToken();
  const response = await fetch(`${baseUrl}/otp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sms: phone }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

async function checkOtp(code, key) {
  const response = await fetch(
    `${baseUrl}/check/otp?code=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`,
    { method: "GET" },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method === "POST" && req.url === "/api/nvoip/auth/start") {
      const { phone } = await readJson(req);
      const payload = await sendOtp(phone);
      res.writeHead(200);
      res.end(JSON.stringify({ sessionId: payload.key, provider: payload }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/nvoip/auth/confirm") {
      const { sessionId, code } = await readJson(req);
      const payload = await checkOtp(code, sessionId);
      res.writeHead(200);
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: String(error.message || error) }));
  }
});

server.listen(3333, () => {
  console.log("Nvoip web SDK sample server listening on http://localhost:3333");
});
