# Supabase usage optimization verification — 25 October 2026

Implemented instant acceptance, workspace/page-specific reads, revision-only Realtime messages, version reconciliation, and an ordering-only public portal. Database changes were applied through the Supabase plugin. The exact production build was staged before switching the live domains.

## Data preservation

Private backup: data/backups/2026-10-25T10-32-01-644Z. Before/after hashes of every existing order, portion, customer transaction, payment and expense match. Existing amounts, dates, ownership redirects, partial payments and financial records were not rewritten. The intentional settings changes are instant acceptance and replacing the embedded logo with a Storage URL.

## Verified behavior

- 32 automated tests pass, covering immediate acceptance, duplicate submissions, active/closed visit identities, merged portal ownership, stale requests, partial payment, ready/delivery transitions, report workbooks, session/role version changes, old debts and receipt-date semantics.
- Live Supabase projections exactly match the tested local model for portal, kitchen, waiter, overview, finance, archive and settings. The management financial summary matches the full original dataset for the same period.
- A rolled-back database test verifies optimistic version checks and transactional database broadcasts. No test order/payment was committed to production.
- Real notification delivery succeeds on the public catalog channel. Anonymous subscription to the staff channel is denied. Public execution of all four server RPCs and public Storage writes is denied.
- Auth account state is checked by a fixed-purpose helper in the private schema. The application role still cannot read Auth user tables directly.
- Staged deployment verification passes: database health, public/staff routes, exact frontend asset hash, public ordering payload, disabled cloud setup, version-based unchanged response, and public-only notification credentials.

## Measured data reduction

Before: one full JSON snapshot was 301,051 bytes, and a management refresh invoked it three times even with no pending image cleanup. Those cleanup reads are removed from ordinary refreshes.

After moving branding to Storage: Supabase JSON responses measure 6,765 bytes for the public portal, 6,702 bytes for kitchen, 28,101 bytes for waiter, 56,896 bytes for finance, approximately 114 KB for archive including its payment receipts, and approximately 47,607 bytes for settings. The current-day management HTTP model is approximately 24,855 bytes. An unchanged database response is 54 bytes before the HTTP identity/time wrapper.

These are raw payload measurements, not billed bandwidth or a guaranteed monthly saving. HTTP compression, user activity and retention affect billing.

## Operating and recovery behavior

New orders are accepted in their database write. The one-second auto-accept job is removed; only hourly maintenance remains. Menu changes notify public portals, while all operational revisions notify staff. Events contain version numbers only; sensitive data is fetched through the authorized application API.

Connected visible screens reconcile with a small version check every 60 seconds. If Realtime is unavailable, the check is every 15 seconds. Hidden/offline screens stop fetching. Initial load, reconnect and returning to the page reconcile current data. Events arriving during a fetch queue another read. Notification delivery failure cannot roll back an order/payment.

Staff sessions created before this rollout remain valid with the lightweight fallback. One logout/login enables private Realtime credentials for that session. New sessions handle credential renewal on the server.

Full snapshots remain on writes, explicit exports and backups to preserve the established atomic domain-operation/retry behavior. Finance/archive history is loaded when those pages are opened; the audit view is bounded to 200 entries. This work does not claim every future scalability issue is eliminated.
