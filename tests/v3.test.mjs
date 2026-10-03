import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccessToken } from '../examples/oauth-client.mjs';

const env = { NVOIP_OAUTH_CLIENT_ID: 'qa:id &+á', NVOIP_OAUTH_CLIENT_SECRET: 'qa:secret &+é' };

test('OAuth uses the central endpoint and form encodes confidential client credentials', async () => {
  await createAccessToken({ env, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.nvoip.com.br/auth/oauth2/token');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('grant_type'), 'client_credentials');
    assert.equal(form.get('client_id'), env.NVOIP_OAUTH_CLIENT_ID);
    assert.equal(form.get('client_secret'), env.NVOIP_OAUTH_CLIENT_SECRET);
    assert.equal(form.has('password'), false);
    return new Response(JSON.stringify({
      access_token: 'dummy',
      token_type: 'Bearer',
    }));
  }});
});

test('OAuth rejects missing credentials and errors without returning secret-bearing upstream bodies', async () => {
  await assert.rejects(createAccessToken({ env: {}, fetchImpl: () => assert.fail('must not request') }), /Configure/);
  await assert.rejects(createAccessToken({ env, fetchImpl: async () => new Response('secret upstream', { status: 401 }) }), /^Error: OAuth failed \(HTTP 401\)\.$/);
  await assert.rejects(createAccessToken({ env, fetchImpl: async () => new Response('{}') }), /Bearer/);
});

test('OTP and 2FA send and confirm use v3 Bearer with the real request contract', async () => {
  Object.assign(process.env, env);
  process.env.NVOIP_ALLOWED_CHANNELS = 'sms,voice';
  const { startVerification, confirmVerification } = await import('../examples/server-node.mjs');
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/auth/oauth2/token')) return new Response(JSON.stringify({
      token_type: 'Bearer',
      access_token: 'dummy',
    }));
    assert.equal(options.headers.Authorization, 'Bearer dummy');
    assert.equal(String(url).includes('/v3/'), true);
    assert.equal(String(url).includes('napikey'), false);
    if (String(url).endsWith('/otp')) {
      assert.deepEqual(JSON.parse(options.body), { phoneNumber: '11999990000', methods: { sms: true } });
      return new Response(JSON.stringify({ key: 'synthetic-key' }));
    }
    if (String(url).endsWith('/2fa')) {
      assert.deepEqual(JSON.parse(options.body), { cellPhone: '11999990000', methods: { sms: true } });
      return new Response(JSON.stringify({ token2fa: 'synthetic-2fa' }));
    }
    return new Response(JSON.stringify({ status: 'Code successfully validated.' }));
  };
  try {
    assert.equal((await startVerification({ phone: '11999990000', channel: 'sms', flow: 'otp' })).sessionId, 'synthetic-key');
    await confirmVerification({ sessionId: 'key&á', code: '001122', channel: 'sms', flow: 'otp' });
    assert.equal((await startVerification({ phone: '11999990000', channel: 'sms', flow: '2fa' })).sessionId, 'synthetic-2fa');
    await confirmVerification({ sessionId: 'token&é', code: '001122', channel: 'sms', flow: '2fa' });
    const checks = calls.filter(c => c.url.includes('/check/'));
    assert.equal(new URL(checks[0].url).searchParams.get('key'), 'key&á');
    assert.equal(new URL(checks[1].url).searchParams.get('token2fa'), 'token&é');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
