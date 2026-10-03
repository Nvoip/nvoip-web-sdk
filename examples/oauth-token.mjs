import { createAccessToken } from "./oauth-client.mjs";

try {
  await createAccessToken();
  console.log("OAuth OK: Bearer token received. Credentials and tokens are not printed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
