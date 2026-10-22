# Deployment Guide — EHS Flux Corporation

This is a condensed step-by-step deployment guide. For full details, see the [README.md](../README.md).

## Prerequisites

- A GitHub account (free): <https://github.com>
- A Vercel account (free): <https://vercel.com>
- A Resend account (free tier supports 100 emails/day): <https://resend.com>
- The verified sending domain (`ehsflux.com` or a subdomain) added to Resend
- DNS access to your domain registrar (Cloudflare, GoDaddy, Namecheap, etc.)

## Step 1 — Push to GitHub

```bash
cd ehs-flux
git init
git add .
git commit -m "feat: EHS Flux Corporation website"
git branch -M main
git remote add origin git@github.com:your-username/ehs-flux.git
git push -u origin main
```

Confirm `.env` was NOT pushed (it is in `.gitignore`):

```bash
git ls-files | grep .env
# Should output: .env.example only
```

## Step 2 — Import into Vercel

1. Go to <https://vercel.com/new>.
2. Find your GitHub repository and click **Import**.
3. Vercel auto-detects:
   - **Framework Preset:** Other (static site)
   - **Output Directory:** `public` (from `vercel.json`)
   - **Build Command:** none
   - **Install Command:** `npm install`
4. Click **Environment Variables** and add:

   | Name | Value | Environments |
   |---|---|---|
   | `RESEND_API_KEY` | `re_xxxxxxxx…` | Production, Preview, Development |
   | `CONTACT_FROM_EMAIL` | `enquiries@ehsflux.com` | Production, Preview, Development |
   | `CONTACT_TO_EMAIL` | `info@ehsflux.com` | Production, Preview, Development |

5. Click **Deploy**.
6. Wait 1–2 minutes for the first deployment.

## Step 3 — Verify Resend Domain

1. Sign in to <https://resend.com>.
2. Go to **Domains** → **Add Domain**.
3. Enter `ehsflux.com` (or `mail.ehsflux.com` subdomain).
4. Resend shows DNS records to add (TXT for SPF, MX, TXT for DKIM).
5. Add these records at your DNS provider.
6. Wait 5–60 minutes for DNS propagation.
7. Click **Verify** in Resend. The domain should show a green "Verified" badge.
8. Once verified, you can send from any `@ehsflux.com` address.

## Step 4 — Test the Live Enquiry Flow

1. Visit your deployed site (e.g., `https://ehs-flux.vercel.app`).
2. Click **Send an Enquiry** in the nav.
3. Fill in the form:
   - Use your own email (so you can verify Reply-To works).
   - Select a country (try India +91, USA +1, UK +44, UAE +971, Australia +61).
   - Enter a valid phone number for the selected country.
   - Write a detailed message describing a sample project.
4. Click **Send Enquiry**.
5. Check the `info@ehsflux.com` inbox — the enquiry should arrive within 30 seconds.
6. Reply to the email — the reply should go to the email address you entered.

## Step 5 — Add a Custom Domain (optional)

1. In Vercel: **Project Settings → Domains → Add**.
2. Enter `ehsflux.com` and/or `www.ehsflux.com`.
3. At your DNS provider, add the records Vercel shows:
   - For apex (`ehsflux.com`): **A record** pointing to `76.76.21.21`
   - For `www`: **CNAME** pointing to `cname.vercel-dns.com`
4. Wait for DNS to propagate (5–60 minutes).
5. Vercel provisions an SSL certificate automatically.

## Step 6 — Confirm Headers and Security

After deployment, verify the security headers:

```bash
curl -sI https://ehsflux.com/ | grep -iE "(strict-transport|x-content-type|x-frame|referrer|permissions)"
```

Expected:

```
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
permissions-policy: geolocation=(), microphone=(), camera=()
```

## Troubleshooting

| Issue | Likely cause | Fix |
|---|---|---|
| Form returns 500 with "Email delivery is not yet configured" | `RESEND_API_KEY` or `CONTACT_FROM_EMAIL` not set in Vercel | Add them in Vercel → Settings → Environment Variables, then redeploy |
| Form returns 502 "Email delivery provider returned an error" | `CONTACT_FROM_EMAIL` is on a non-verified domain | Verify the domain in Resend, or use an address on an already-verified domain |
| Form returns 429 "Too many submissions" | Rate limit (3/min per IP) exceeded | Wait 60 seconds and retry |
| Form returns 502 "Email delivery failed" | Network error or Resend outage | Check Resend status page, retry in a few minutes |
| Phone validation fails for valid number | Wrong country selected | Re-select the country from the dropdown |
| Email arrives but Reply-To doesn't work | Email client not displaying Reply-To header | Check "Show original" in Gmail/Outlook to verify the header is set |
| Static assets 404 in production | `vercel.json` missing or `outputDirectory` not set | Verify `vercel.json` contains `"outputDirectory": "public"` |

## Local vs Production

- **Local (no API):** `npm start` serves only the static site. The form will show an error when submitted because there is no `/api/contact` runtime. Use this for visual preview only.
- **Local (with API):** `vercel dev` runs both the static site and the serverless function locally. Required to test the enquiry flow without deploying.
- **Production:** Vercel serves the static site from `public/` and runs `api/contact.js` as a serverless function at `/api/contact`. This is the only environment where real emails can be delivered.

## Live Test (Requires Real Credentials)

This test verifies the actual end-to-end email delivery. **Do not mark it as passed without performing it.**

1. Set the three environment variables in Vercel Production.
2. Verify the sending domain in Resend.
3. Visit the live deployed site.
4. Submit the form with a real, monitored email address.
5. Check `info@ehsflux.com` inbox within 60 seconds.
6. Verify the email subject is `[EHS Flux Enquiry] …`.
7. Verify the email contains: name, company, email, phone, requirement, subject, message, timestamp, source page.
8. Reply to the email in your inbox — confirm the reply goes to the customer's email (Reply-To).
9. Try an invalid phone number — verify the form rejects it.
10. Try an empty required field — verify the form rejects it.

If all 10 steps succeed, live email delivery is verified. Update the deployment notes accordingly.
