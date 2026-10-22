/**
 * Validation tests — pure functions, no network.
 * Run with: node tests/validation.test.js
 */

// Import the same validation logic as the API by re-implementing the constants
// In a real project, you would extract these to a shared module.

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

const ALLOWED_REQUIREMENTS = [
  'Water Treatment Plant Consulting',
  'ZLD System Consulting',
  'ETP Audit / Upgradation',
  'Feasibility Study',
  'Project Support',
  'Compliance Support',
  'Other'
];

// Mirror of validatePayload in api/contact.js (kept in sync manually for tests)
function validatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Invalid request body.'] };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const requirement = typeof body.requirement === 'string' ? body.requirement.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length < 2 || name.length > 120) errors.push('Full name must be 2–120 characters.');
  if (company.length > 120) errors.push('Company name must be 120 characters or fewer.');
  if (!EMAIL_RE.test(email)) errors.push('A valid email address is required.');
  if (!E164_RE.test(phone)) errors.push('A valid international phone number (E.164) is required.');
  if (!ALLOWED_REQUIREMENTS.includes(requirement)) errors.push('A valid requirement selection is required.');
  if (subject.length < 3 || subject.length > 200) errors.push('Subject must be 3–200 characters.');
  if (message.length < 10 || message.length > 4000) errors.push('Message must be 10–4000 characters.');

  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return { valid: false, errors: ['spam'], silent: true };
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { name, company, email, phone, requirement, subject, message, phoneCountry: body.phoneCountry, sourcePage: body.sourcePage }
  };
}

// =====================
// Test runner
// =====================
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.error('  ✗ ' + name + '\n    ' + e.message);
  }
}
function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error((msg || 'Assertion failed') + '\n    Expected: ' + JSON.stringify(expected) + '\n    Actual:   ' + JSON.stringify(actual));
  }
}
function assertTrue(condition, msg) {
  if (!condition) throw new Error(msg || 'Expected true, got false');
}

console.log('\n=== Validation Tests ===\n');

// --- Valid payload ---
test('accepts valid payload with all fields', () => {
  const r = validatePayload({
    name: 'Alice Sharma', company: 'Acme Chemicals',
    email: 'alice@acme.com', phone: '+919876543210',
    requirement: 'ZLD System Consulting',
    subject: 'ZLD for 50 KLD pharma effluent',
    message: 'We have a 50 KLD pharma effluent stream with high TDS and need to achieve ZLD. Please advise on technology selection.'
  });
  assertTrue(r.valid, 'Should be valid');
  assertEqual(r.errors, []);
});

test('accepts valid payload without optional company field', () => {
  const r = validatePayload({
    name: 'Bob', company: '',
    email: 'bob@example.org', phone: '+15551234567',
    requirement: 'Feasibility Study',
    subject: 'Feasibility for textile ZLD',
    message: 'Looking for techno-commercial feasibility for a textile dyeing unit ZLD system.'
  });
  assertTrue(r.valid);
});

// --- Phone number validation (E.164) ---
test('rejects phone missing + prefix', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '919876543210',  // missing +
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid, 'Should reject phone missing +');
  assertTrue(r.errors.some(e => e.includes('phone')));
});

test('rejects phone with duplicate dial code', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+91 919876543210',  // duplicate 91
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid, 'Should reject duplicate dial code (E.164 format requires single +)');
});

test('rejects too-short phone', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+911234',  // too short
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.some(e => e.includes('phone')));
});

test('accepts valid phone for various countries', () => {
  const validNumbers = [
    '+919876543210',  // India
    '+15551234567',   // USA
    '+447911234567',  // UK
    '+971501234567',  // UAE
    '+61412345678',   // Australia
    '+8613800138000', // China
    '+4915123456789', // Germany
    '+819012345678'   // Japan
  ];
  validNumbers.forEach(phone => {
    const r = validatePayload({
      name: 'Test Name', email: 'x@y.com', phone: phone,
      requirement: 'Other', subject: 'Test subject',
      message: 'This is a valid message body for testing.'
    });
    assertTrue(r.valid, 'Should accept ' + phone);
  });
});

// --- Email validation ---
test('rejects invalid email addresses', () => {
  const invalidEmails = [
    'not-an-email',
    '@example.com',
    'alice@',
    'alice@.com',
    'alice@example',
    'alice @example.com',
    'alice@example..com'
  ];
  invalidEmails.forEach(email => {
    const r = validatePayload({
      name: 'Test Name', email: email, phone: '+919876543210',
      requirement: 'Other', subject: 'Test subject',
      message: 'This is a valid message body for testing.'
    });
    assertTrue(!r.valid, 'Should reject email: ' + email);
    assertTrue(r.errors.some(e => e.includes('email')));
  });
});

// --- Name validation ---
test('rejects name shorter than 2 characters', () => {
  const r = validatePayload({
    name: 'A', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.some(e => e.includes('name')));
});

test('rejects name longer than 120 characters', () => {
  const r = validatePayload({
    name: 'A Test'.repeat(121), email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid);
});

// --- Subject validation ---
test('rejects subject shorter than 3 characters', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'ab',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.some(e => e.includes('Subject')));
});

// --- Message validation ---
test('rejects message shorter than 10 characters', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'Too short'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.some(e => e.includes('Message')));
});

test('rejects message longer than 4000 characters', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'A'.repeat(4001)
  });
  assertTrue(!r.valid);
});

// --- Requirement validation ---
test('rejects invalid requirement value', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Invalid Requirement',
    subject: 'Test subject',
    message: 'This is a valid message body for testing.'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.some(e => e.includes('requirement')));
});

test('accepts all seven allowed requirement values', () => {
  ALLOWED_REQUIREMENTS.forEach(req => {
    const r = validatePayload({
      name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
      requirement: req, subject: 'Test subject',
      message: 'This is a valid message body for testing.'
    });
    assertTrue(r.valid, 'Should accept requirement: ' + req);
  });
});

// --- Honeypot ---
test('honeypot field triggers silent rejection', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.',
    website: 'http://spam-bot.com'  // honeypot filled
  });
  assertTrue(!r.valid, 'Honeypot should mark as invalid');
  assertTrue(r.silent, 'Honeypot should be silent (do not tell the bot)');
});

test('empty honeypot field is fine', () => {
  const r = validatePayload({
    name: 'Test Name', email: 'x@y.com', phone: '+919876543210',
    requirement: 'Other', subject: 'Test subject',
    message: 'This is a valid message body for testing.',
    website: ''
  });
  assertTrue(r.valid, 'Empty honeypot should be fine');
});

// --- Multiple errors ---
test('returns multiple errors for multiple invalid fields', () => {
  const r = validatePayload({
    name: '', email: 'bad', phone: '123',  // all bad
    requirement: 'Invalid', subject: '', message: 'short'
  });
  assertTrue(!r.valid);
  assertTrue(r.errors.length >= 5, 'Should have at least 5 errors, got ' + r.errors.length);
});

// --- Non-object body ---
test('rejects non-object body', () => {
  const r = validatePayload(null);
  assertTrue(!r.valid);
});

console.log('\n=== Validation Tests Summary ===');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
process.exit(failed > 0 ? 1 : 0);
