# AAROHAN Channel Inbox intake

Apply the campaign channel inbox migration before deploying the Edge Function with JWT verification disabled. The web route validates the configured website Origin and a user-submitted enquiry-consent checkbox. **Origin/CORS is not authentication**: server-to-server clients can supply their own Origin, so keep the existing database-enforced per-email and global submission limits, monitor abuse, and consider independent anti-bot verification before advertising this as hardened public intake. An enquiry checkbox is not independently verified consent for future marketing or outreach. The Edge Function uses the Supabase-provided service key. The browser uses only the project's publishable key.

The Admin dashboard lists website and manual enquiries and can link one to an existing lead or save it as a new lead. The public form captures website chatbot requests and Aarohi follow-up requests. The existing Aarohi call widget keeps its provider. No recordings or transcripts are imported.

## WhatsApp Cloud API

Set these Edge Function secrets in the Supabase project before enrolling the callback:

- `WHATSAPP_APP_SECRET` from the Meta app
- `WHATSAPP_VERIFY_TOKEN`, a new random value shared only with the Meta callback settings
- `WHATSAPP_PHONE_NUMBER_ID`, the existing Cloud API number ID

The callback is `https://zvrdbekyqbwrztckvkpw.supabase.co/functions/v1/campaign-intake/whatsapp`. Subscribe to the Meta messages field only after confirming how the existing provider handles that number. The route only receives signed inbound text messages for the configured number. Provider retries use the message ID for deduplication. The callback does not send replies. Prior conversations and attachment-only messages are not imported.

## Release verification

Verify anonymous database reads and non-Admin inbox access are denied. Submit a disposable website enquiry from the actual domain, confirm it appears in the Admin inbox, save it as a lead, and clean up the test rows. On WhatsApp activation, verify a signed incoming test message, repeat the same provider message ID, and confirm a single inbox entry.

## Checked security behavior (draft tests — not production deployment)

- The Edge Function must accept only the documented root website-enquiry path `/functions/v1/campaign-intake` (optional trailing slash) and `/functions/v1/campaign-intake/whatsapp`. Unknown paths return **404** without writing inbox data; do not route them to public enquiries.
- Run `node --test supabase/functions/campaign-intake/campaign-intake.test.mjs` under Node 22. This loads the **real Deno.serve handler** in an isolated sandbox with synthetic environment secrets and a fake database so it cannot access customer data, real APIs or Meta credentials.
- Its 12 cases check strict routing, Origin/CORS, missing enquiry consent, invalid JSON fields/size, one correct website RPC write, database failure handling, missing Meta configuration, verification-token challenge, signed versus forged HMAC, duplicate Meta message-id deduplication, wrong WhatsApp number and invalid payloads.
- These tests are a prerequisite only. They **do not** prove that deployed Supabase secrets, real rate-limiting, Cloud API subscriptions, customer identity or real browser behaviour work end to end.
- No merge, redeploy or change to the existing production Edge Function should occur without owner approval, a reversible deployment plan, direct staging and authorized acceptance testing.
