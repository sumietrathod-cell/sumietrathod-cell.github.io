# AAROHAN Channel Inbox intake

Apply the campaign channel inbox migration before deploying the Edge Function with JWT verification disabled. The web route validates the allowed website origin and explicit consent. The database enforces per-email and global submission limits. The Edge Function uses the Supabase-provided service key. The browser uses only the project's publishable key.

The Admin dashboard lists website and manual enquiries and can link one to an existing lead or save it as a new lead. The public form captures website chatbot requests and Aarohi follow-up requests. The existing Aarohi call widget keeps its provider. No recordings or transcripts are imported.

## WhatsApp Cloud API

Set these Edge Function secrets in the Supabase project before enrolling the callback:

- `WHATSAPP_APP_SECRET` from the Meta app
- `WHATSAPP_VERIFY_TOKEN`, a new random value shared only with the Meta callback settings
- `WHATSAPP_PHONE_NUMBER_ID`, the existing Cloud API number ID

The callback is `https://zvrdbekyqbwrztckvkpw.supabase.co/functions/v1/campaign-intake/whatsapp`. Subscribe to the Meta messages field only after confirming how the existing provider handles that number. The route only receives signed inbound text messages for the configured number. Provider retries use the message ID for deduplication. The callback does not send replies. Prior conversations and attachment-only messages are not imported.

## Release verification

Verify anonymous database reads and non-Admin inbox access are denied. Submit a disposable website enquiry from the actual domain, confirm it appears in the Admin inbox, save it as a lead, and clean up the test rows. On WhatsApp activation, verify a signed incoming test message, repeat the same provider message ID, and confirm a single inbox entry.
