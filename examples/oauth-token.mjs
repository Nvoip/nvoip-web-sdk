import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

loadEnv(path.join(rootDir, ".env"));

const baseUrl = process.env.NVOIP_BASE_URL || "https://api.nvoip.com.br/v2";

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

function requiredEnv(name) {
  const value = process.env[name] || "";
  if (!value) {
    throw new Error(`Missing ${name}. Configure it in .env or as an environment variable.`);
  }

  return value;
}

function encodeBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function requestAccessToken() {
  const clientId = requiredEnv("NVOIP_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("NVOIP_OAUTH_CLIENT_SECRET");
  const numbersip = requiredEnv("NVOIP_NUMBERSIP");
  const userToken = requiredEnv("NVOIP_USER_TOKEN");

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: numbersip,
      password: userToken,
      grant_type: "password",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload;
}

function maskToken(token) {
  const value = String(token || "");
  if (value.length <= 14) {
    return "***";
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

try {
  const payload = await requestAccessToken();
  console.log("OAuth OK");
  console.log(`token_type=${payload.token_type}`);
  console.log(`expires_in=${payload.expires_in}`);
  console.log(`scope=${payload.scope}`);
  console.log(`access_token=${maskToken(payload.access_token)}`);
  console.log(`refresh_token=${maskToken(payload.refresh_token)}`);

  if (process.env.PRINT_ACCESS_TOKEN === "1") {
    console.log(`raw_access_token=${payload.access_token}`);
  }
} catch (error) {
  console.error(`OAuth failed: ${error.message}`);
  process.exitCode = 1;
}
