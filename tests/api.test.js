/**
 * API endpoint tests with mocked Resend.
 *
 * These tests verify that /api/contact:
 *   1. Accepts valid POST and returns 200 when Resend accepts.
 *   2. Returns 502 when Resend returns an error (no false success).
 *   3. Returns 422 when validation fails.
 *   4. Returns 405 on non-POST.
 *   5. Returns 500 when env vars are missing.
 *   6. Returns 200 (silent) when honeypot is filled.
 *
 * The tests do NOT call the real Resend API. They mock `global.fetch` to a
 * stub that returns a configurable response.
 *
 * Run with: node tests/api.test.js
 */

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function loadApi() {
  delete require.cache[require.resolve('../api/contact.js')];
  return require('../api/contact.js');
}

function createReq(method, body, headers = {}) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body || {});
  return {
    method,
    headers: { 'content-type': 'application/json', 'content-length': String(bodyStr.length), ...headers },
    body: (async function* () { yield Buffer.from(bodyStr); })()
  };
}
function createRes() {
  return {
    statusCode: 200,
    headersSent: false,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e));
  }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((msg || 'Assertion failed') + '\n      Expected: ' + JSON.stringify(expected) + '\n      Actual:   ' + JSON.stringify(actual));
  }
}
function assertTrue(c, msg) { if (!c) throw new Error(msg || 'Expected true'); }
function assertFalse(c, msg) { if (c) throw new Error(msg || 'Expected false'); }

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_FROM_EMAIL;
  delete process.env.CONTACT_TO_EMAIL;
}
function setGoodEnv() {
  process.env.RESEND_API_KEY = 're_test_key_123';
  process.env.CONTACT_FROM_EMAIL = 'enquiries@ehsflux.com';
  process.env.CONTACT_TO_EMAIL = 'info@ehsflux.com';
}

const VALID_PAYLOAD = {
  name: 'Test User',
  company: 'Test Co.',
  email: 'test@example.com',
  phone: '+919876543210',
  phoneCountry: 'IN',
  requirement: 'ZLD System Consulting',
  subject: 'Test subject line',
  message: 'This is a valid test message body of at least ten characters.',
  sourcePage: '/'
};

const TESTS = [
  ['returns 405 on GET', async () => {
    resetEnv();
    setGoodEnv();
    global.fetch = originalFetch;
    const api = loadApi();
    const req = createReq('GET');
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 405);
    assertTrue(res.body.error.includes('Method'));
  }],

  ['returns 422 on invalid POST (missing required fields)', async () => {
    resetEnv();
    setGoodEnv();
    const api = loadApi();
    const req = createReq('POST', { name: 'X', email: 'bad', phone: '123', requirement: 'Invalid', subject: '', message: 'short' });
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 422);
    assertTrue(res.body.success === false);
    assertTrue(Array.isArray(res.body.details));
  }],

  ['returns 400 on invalid JSON body', async () => {
    resetEnv();
    setGoodEnv();
    const api = loadApi();
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '8' },
      body: (async function* () { yield Buffer.from('not-json'); })()
    };
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 400);
  }],

  ['returns 500 when RESEND_API_KEY is missing', async () => {
    resetEnv();
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 500);
    assertTrue(res.body.error.includes('configured') || res.body.error.includes('administrator'));
  }],

  ['returns 200 when Resend accepts the email', async () => {
    resetEnv();
    setGoodEnv();
    let fetchCalled = false;
    let capturedPayload = null;
    global.fetch = async (url, options) => {
      fetchCalled = true;
      capturedPayload = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_id_abc123', from: 'enquiries@ehsflux.com', to: 'info@ehsflux.com' })
      };
    };
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 200);
    assertTrue(res.body.success);
    assertEqual(res.body.messageId, 'email_id_abc123');
    assertTrue(fetchCalled, 'fetch should have been called');
    assertEqual(capturedPayload.to, 'info@ehsflux.com', 'Recipient should be info@ehsflux.com');
    assertEqual(capturedPayload.from, 'enquiries@ehsflux.com', 'Sender should be the FROM email');
    assertEqual(capturedPayload.reply_to, 'test@example.com', 'Reply-To should be the customer email');
    assertTrue(capturedPayload.subject.startsWith('[EHS Flux Enquiry]'), 'Subject should be prefixed');
    assertTrue(capturedPayload.html.includes('Test User'), 'HTML should contain name');
    assertTrue(capturedPayload.html.includes('+919876543210'), 'HTML should contain phone');
    assertTrue(capturedPayload.html.includes('ZLD System Consulting'), 'HTML should contain requirement');
    assertTrue(capturedPayload.html.includes('Test subject line'), 'HTML should contain subject');
    assertTrue(capturedPayload.html.includes('This is a valid test message'), 'HTML should contain message');
    assertTrue(capturedPayload.text.includes('Test User'), 'Text version should contain name');
    assertTrue(capturedPayload.text.includes('info@ehsflux.com') === false, 'Text should NOT contain recipient email');
    assertTrue(capturedPayload.text.includes('Reply-To: test@example.com'), 'Text should have Reply-To line');
  }],

  ['returns 502 when Resend returns 4xx (no false success)', async () => {
    resetEnv();
    setGoodEnv();
    global.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: 'from field does not match a verified domain' })
    });
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 502);
    assertFalse(res.body.success, 'Should NOT return success when Resend fails');
    assertTrue(res.body.error.includes('Email delivery provider'));
  }],

  ['returns 502 when Resend returns 5xx (no false success)', async () => {
    resetEnv();
    setGoodEnv();
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal error' })
    });
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 502);
    assertFalse(res.body.success);
  }],

  ['returns 502 when fetch throws (network failure)', async () => {
    resetEnv();
    setGoodEnv();
    global.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 502);
    assertFalse(res.body.success);
    assertTrue(res.body.error.includes('info@ehsflux.com'));
  }],

  ['honeypot field returns 200 with success (silent rejection)', async () => {
    resetEnv();
    setGoodEnv();
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };
    const api = loadApi();
    const req = createReq('POST', { ...VALID_PAYLOAD, website: 'http://spam.com' });
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 200);
    assertTrue(res.body.success, 'Should return success (silent rejection)');
    assertFalse(fetchCalled, 'fetch should NOT be called when honeypot triggers');
  }],

  ['rate limit returns 429 after 3 submissions from same IP', async () => {
    resetEnv();
    setGoodEnv();
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'x' }) });
    const api = loadApi();
    const ip = '1.2.3.4';
    for (let i = 0; i < 3; i++) {
      const res = createRes();
      await api(createReq('POST', VALID_PAYLOAD, { 'x-forwarded-for': ip }), res);
      assertEqual(res.statusCode, 200, 'Submission ' + (i + 1) + ' should succeed');
    }
    const res = createRes();
    await api(createReq('POST', VALID_PAYLOAD, { 'x-forwarded-for': ip }), res);
    assertEqual(res.statusCode, 429, '4th submission should be rate-limited');
    assertTrue(res.body.error.toLowerCase().includes('many') || res.body.error.toLowerCase().includes('rate'));
  }],

  ['email headers include enquiry source and phone country', async () => {
    resetEnv();
    setGoodEnv();
    let capturedPayload = null;
    global.fetch = async (url, options) => {
      capturedPayload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ id: 'x' }) };
    };
    const api = loadApi();
    const req = createReq('POST', VALID_PAYLOAD);
    const res = createRes();
    await api(req, res);
    assertEqual(res.statusCode, 200);
    assertTrue(capturedPayload.headers['X-Enquiry-Source'] === 'EHS Flux Website');
    assertEqual(capturedPayload.headers['X-Enquiry-Phone-Country'], 'IN');
  }]
];

async function runAll() {
  console.log('\n=== API Endpoint Tests (with mocked Resend) ===\n');
  for (const [name, fn] of TESTS) {
    await test(name, fn);
  }

  global.fetch = originalFetch;
  process.env = originalEnv;

  console.log('\n=== API Tests Summary ===');
  console.log('  Passed: ' + passed);
  console.log('  Failed: ' + failed);

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
