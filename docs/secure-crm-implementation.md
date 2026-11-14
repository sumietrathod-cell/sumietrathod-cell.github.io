# AAROHAN AI WORLD — Secure CRM implementation plan

Status: architecture proposal, NOT a live CRM.

## Roles
- Admin: all permitted leads, customers, partner assignments, commission approvals, reports.
- Sales partner: only assigned leads, own activity and own commissions.
- No public signup for admin; partner invitations must be approved.

## Security
GitHub Pages hosts only public frontend files. Never put API secrets, customer records, password lists or service-role keys in this repository.
Use a managed backend (e.g. Supabase) with authentication, server-side row-level security, audit logs, encrypted transport and database backups. Test access boundaries before launch.

## Tables
profiles(id, role, display_name, status)
partners(id, user_id, agreement_status, commission_rule)
leads(id, source, owner_partner_id, company, contact_name, consent_status, status, created_at)
lead_events(id, lead_id, channel, event_type, external_id, occurred_at)
followups(id, lead_id, due_at, assigned_user_id, status)
deals(id, lead_id, value, currency, stage, closed_at)
commissions(id, deal_id, partner_id, rule_snapshot, amount, status)

## Integrations
- Website forms -> authenticated backend endpoint, spam controls, consent and deduplication.
- Gmail -> scoped OAuth, only approved mailbox, tracked thread IDs.
- WhatsApp -> official Business Platform webhook and opt-in requirements.
- Voice agent -> authenticated event webhook; no recording storage without permission.
- Reminders -> scheduled server-side jobs with delivery and failure logs.
- Commission -> approved deals only; no automatic payouts without explicit authorization.

## Rollout
1. Confirm backend provider and administrator ownership.
2. Configure auth and role-based access policies.
3. Build Admin and Partner dashboard UI against protected API.
4. Connect one source at a time and test with synthetic data.
5. Verify privacy, exports, backups and partner isolation.
6. Deploy after explicit review and acceptance.

**No production deployment, account provisioning, live integrations or commission payment is represented by this document.**
