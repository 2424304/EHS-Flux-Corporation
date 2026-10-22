# Tests — EHS Flux Corporation

This folder contains automated tests for the EHS Flux Corporation website's backend logic.

## Running tests

```bash
# Run all tests
npm test

# Or directly with node
node tests/run-tests.js
```

## Test files

| File | Description | Network calls? |
|---|---|---|
| `validation.test.js` | Pure-function tests for the form-validation logic (email, phone E.164, name length, message length, allowed requirement values, honeypot). | No |
| `api.test.js` | Tests for the `/api/contact` serverless function with **mocked** Resend responses. Verifies 200/422/429/500/502 status codes, no false-success on Resend failure, honeypot silent rejection, rate limiting, email payload contents. | No — `global.fetch` is mocked. |
| `run-tests.js` | Sequential test runner that invokes the other test files. | No |

## What is tested

### Form validation (validation.test.js)

- [x] Valid payload with all fields → accepted
- [x] Valid payload without optional company → accepted
- [x] Phone missing `+` prefix → rejected
- [x] Phone with duplicate dial code → rejected
- [x] Phone too short → rejected
- [x] Valid phone for India, USA, UK, UAE, Australia, China, Germany, Japan → accepted
- [x] Invalid email formats → rejected (7 cases)
- [x] Name shorter than 2 chars → rejected
- [x] Name longer than 120 chars → rejected
- [x] Subject shorter than 3 chars → rejected
- [x] Message shorter than 10 chars → rejected
- [x] Message longer than 4000 chars → rejected
- [x] Invalid requirement value → rejected
- [x] All 7 allowed requirement values → accepted
- [x] Honeypot field filled → silent rejection
- [x] Empty honeypot → accepted
- [x] Multiple invalid fields → returns multiple errors
- [x] Non-object body → rejected

### API endpoint (api.test.js)

- [x] GET request → 405 Method not allowed
- [x] Invalid POST body (validation fail) → 422 with details array
- [x] Malformed JSON body → 400
- [x] Missing env vars (`RESEND_API_KEY`, `CONTACT_FROM_EMAIL`) → 500
- [x] Valid POST with Resend success → 200, returns messageId
- [x] Resend 4xx → 502 (no false success)
- [x] Resend 5xx → 502 (no false success)
- [x] Fetch throws (network error) → 502 with fallback message
- [x] Honeypot filled → 200 silent success, no fetch call
- [x] Rate limiting → 429 after 3 requests from same IP
- [x] Email payload includes all expected fields (name, email, phone, requirement, subject, message)
- [x] Email `to` is `info@ehsflux.com`
- [x] Email `from` is the `CONTACT_FROM_EMAIL` env var
- [x] Email `reply_to` is the customer's email
- [x] Subject is prefixed with `[EHS Flux Enquiry]`
- [x] HTML body and text body both contain all enquiry data
- [x] Custom headers (`X-Enquiry-Source`, `X-Enquiry-Phone-Country`) are set

## What is NOT tested (requires live credentials)

The following scenarios require a real Resend API key and a verified sending domain:

- Actual email delivery to `info@ehsflux.com`.
- Resend rate limit response (the production rate limit is enforced by Resend, not the API code).
- DNS verification flow (managed in the Resend dashboard, not in code).
- Reply-To header behaviour in real email clients.

To test live delivery:

1. Set the three environment variables (`RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL`).
2. Verify the sending domain in Resend.
3. Run `vercel dev` locally or deploy to Vercel.
4. Submit the form with a real email address you control.
5. Check the `info@ehsflux.com` inbox for the enquiry email.

Do NOT report live delivery as tested unless you have performed the above steps.

## Adding new tests

When adding new validation rules or API behaviours, add corresponding tests:

- For validation: add to `validation.test.js` (mirror the validator in `api/contact.js`).
- For API: add to `api.test.js` and use the `global.fetch` mock pattern.
