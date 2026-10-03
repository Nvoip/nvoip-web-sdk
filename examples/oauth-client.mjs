// OAuth stays on the application backend. Never import this module in a browser.
export async function createAccessToken({ env = process.env, fetchImpl = fetch } = {}) {
  const clientId = env.NVOIP_OAUTH_CLIENT_ID;
  const clientSecret = env.NVOIP_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Configure NVOIP_OAUTH_CLIENT_ID and NVOIP_OAUTH_CLIENT_SECRET.");
  }
  const response = await fetchImpl(env.NVOIP_OAUTH_TOKEN_URL || "https://api.nvoip.com.br/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret,
      ...(env.NVOIP_OAUTH_SCOPE ? { scope: env.NVOIP_OAUTH_SCOPE } : {}) }),
  });
  if (!response.ok) throw new Error(`OAuth failed (HTTP ${response.status}).`);
  const data = await response.json();
  const bearer = data.access_token;
  const kind = String(data.token_type).toLowerCase();
  if (!bearer || kind !== "bearer") {
    throw new Error("OAuth did not return a Bearer access token.");
  }
  return bearer;
}
