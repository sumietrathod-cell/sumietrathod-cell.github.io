# AAROHAN AI WORLD CRM

## Staging setup

1. Confirm the intended Supabase project. Use a staging project with synthetic records for verification. Apply both SQL migrations in order.
2. Disable public registration for this dedicated CRM project. Provision confirmed email/password users in Supabase Authentication through the project administrator. In SQL Editor, create their matching `public.profiles` rows using the Auth user UUID, the role `admin` or `partner`, and `active = true`. Deactivate access by setting `active = false`. Keep profile management privileged.
3. On the isolated preview host, serve `crm/config.json` alongside this page with the following shape. Use the identified project's HTTPS URL and its browser publishable key. Never enter a secret or service-role key here.

```json
{
  "url": "https://PROJECTREF.supabase.co",
  "publishableKey": "sb_publishable_REPLACE"
}
```

## Staging acceptance checks

Use one active Admin, two active Sales Partners, and one inactive account. Assign a separate lead and linked deal to each partner and create a commission with each corresponding partner ID. Use synthetic data only.

- Verify Admin sign-in and visibility across both partners. The database policies permit Admin insert and update on the three business tables. The dashboard is read-only.
- Verify both Sales Partner logins. Each partner should see their assigned leads and linked deals, and commissions attributed to their own account.
- Verify that selecting Admin with partner credentials and signing in with an inactive account both fail to open the dashboard. Verify sign-out clears the tables.
- Using ordinary staging Auth sessions through the Data API, assert that anonymous requests cannot read CRM tables, Partner A gets zero rows for Partner B's record IDs, a partner cannot insert or update business rows, and neither role can change profiles through the Data API. Confirm Admin insert and update succeed on disposable test records.
- Verify inactive accounts cannot read any business rows through the Data API. Verify no browser role can read or write integration receipts.

## Integration boundary

The integration receipts table is a server-side deduplication foundation. A future handler must verify provider authenticity before using a delivery ID and record the receipt and corresponding CRM changes in one transaction. Provider-specific credentials, consent mapping, handlers, and live verification are pending for website intake, Gmail, WhatsApp and voice.
