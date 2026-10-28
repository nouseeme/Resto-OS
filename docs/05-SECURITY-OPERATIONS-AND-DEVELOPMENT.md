# 05 — Security, operations and development

[Index](INDEX.md) · [Infrastructure](04-INFRASTRUCTURE-AND-ALTERNATIVES.md)

## 1. Security model

The browser communicates with the Express API. Cloud business tables are in the unexposed `resto_private` schema, with RLS enabled and no browser business-data policies. Privileged snapshot/commit/context/view RPC execution is restricted to the server role. A publishable key does not grant customers direct access to business records.

`resto_snapshot`, `resto_commit`, `resto_view` and the public context wrapper use SECURITY INVOKER. The narrowly scoped `resto_private.session_context` helper uses SECURITY DEFINER to join application sessions with current Auth account status. It has an empty search path and server-only execute permission. Granting broad Auth-table or browser access is not an equivalent fix for a context permission failure.

### Guest ownership

The server creates a random 32-byte guest credential in `resto_guest`, using HttpOnly, SameSite=Strict and Secure on Vercel or when explicitly enabled. Its hash is the domain ownership token. The cookie can survive transaction closure; the transaction session cannot. The server follows authorized merge redirects and rejects stale session IDs on submission.

Cookies are device credentials, not proof of a person's civil identity. Lost browser storage/cookies are not covered by an account recovery flow. Browser-side drafts are convenience data, not authoritative order records.

### Staff authentication and workspace authorization

Cloud sign-in uses Supabase Auth email/password. Confirmed, unbanned accounts are admitted as staff. No `resto_staff` metadata flag is required. Display names may come from user metadata, but metadata is not used to decide admission or workspace privileges.

The application issues an opaque 12-hour staff cookie and stores its hash in persistent sessions. Cloud session context joins the current Auth account so deletion/bans are reflected on subsequent authenticated requests. A separate Supabase sign-in client avoids contaminating the server's privileged data client with a user's session.

All staff may choose Kitchen, Waiter or Management. `activeRole` controls permitted commands in that session; it is not a permanent employee permission tier. Staff who have not chosen a workspace receive no operational state/actions. Cloud legacy internal-password sessions are not admitted as a substitute for Auth-backed sessions. Local mode retains username/password authentication with scrypt password hashing.

### Request and operational controls

- Non-GET API requests reject mismatching Origin and explicit cross-site fetch context.
- JSON bodies have a 3 MB limit. Image and spreadsheet payloads have their own validation limits.
- Login attempts are limited to eight per hashed network address in a minute before subsequent attempts are rejected.
- An anonymous fifth order within 60 seconds triggers a temporary ban: 15, 30, then at most 60 minutes on repeated strikes.
- Order prices, availability, workspace, portion state and ownership are validated server-side.
- Browser responses remove passwords, internal session data and ownership tokens. Kitchen projections omit portion payment values.

These controls do not constitute a complete network/WAF defense or a completed independent security audit. The unlisted staff URL and noindex header are navigation/indexing measures, not authorization.

## 2. Local development

Use Node 24 and install dependencies from the lockfile:

```powershell
npm ci
npm run dev
```

The standalone entry loads `.env` when present except when `RESTO_DB=:memory:`. With no cloud credentials it uses `data/resto.sqlite` and binds to `127.0.0.1:3000`. Open `/ruang-staf` on the server computer to create the first local admin, then choose a workspace. New normal databases have no catalog, accounts or transactions.

To force an isolated local database even if cloud settings exist:

```powershell
$env:RESTO_DB = 'data/qa.sqlite'
npm run dev
```

Cloud media credentials may still enable image operations independently of that database override. For strict local isolation, remove cloud credentials from the process and loaded `.env`, or use the dedicated demo mode for a showcase.

For standalone production serving:

```powershell
npm run build
npm start
```

This serves `dist` and the known page routes. Public hosting additionally requires the listener, HTTPS, headers and proxy work described in [infrastructure alternatives](04-INFRASTRUCTURE-AND-ALTERNATIVES.md).

## 3. First cloud setup

1. Prepare a dedicated Supabase project; apply every SQL migration in filename order. Keep the original RPC contracts required by later patches.
2. Disable public Auth signups. Customers do not need Auth accounts, and every admitted account can select Management.
3. In Supabase Authentication, create the first email/password user with confirmation enabled. No metadata grant or SQL staff marker is required.
4. Configure server URL/secret and the publishable key for Realtime. Keep secrets outside source control and browser-prefixed build variables.
5. Open `/ruang-staf`, sign in, choose Management, then initialize identity, currency and catalog.
6. Add subsequent staff through Management → Settings → Staff access. The app creates a confirmed Auth identity and local application profile. Accounts created directly in Auth appear after first sign-in.

Public `/api/setup` is disabled in cloud mode. Database migrations do not create staff Auth identities or seed live restaurant data. Local password hashes are not migrated into Supabase Auth.

Ban/delete staff through Supabase when revocation is required. Restoring business data or resetting app profiles does not itself restore/delete external Auth identities.

## 4. Deployment procedure

For a correctly linked Vercel project with its environment already prepared:

```powershell
npm ci
npm test
npm run build
vercel project inspect --non-interactive
vercel deploy --prod
```

Verify the linked owner/project and selected environment before publishing. The command is an operational example, not evidence that a deployment happened during documentation work. A manual upload does not establish Git auto-deployment; configure the repository integration separately if required.

`scripts/configure-vercel-env.js` is an optional Windows helper using private project/team configuration and standard input for secrets. Provider dashboards or another controlled deployment process can replace it.

Preview environments should have separate database credentials/data. Platform deployment protection and application staff authentication are separate layers: a public portal can coexist with authenticated staff endpoints.

After deployment, verify routes, exact frontend assets, database health, account admission, selected reads, media and service lifecycle. Keep a compatible application revision and migration rollback strategy; destructive schema rollback is not automated.

## 5. Scheduled maintenance and notifications

Current migrations accept new orders atomically and remove the former one-second acceptance cron. Hourly jobs clean expired sessions/stale login-attempt records and remove cron history older than one day. Maintenance that changes state shares the revision lock.

The current schedule does not establish comprehensive retention for order history, audit, bans or idempotency results. These can grow and affect full-snapshot writes. Define a deliberate retention/archive policy before deleting records with ownership or financial dependencies.

Realtime events contain revision numbers, with separate catalog/staff subscription policies and denied client publishing. Connected visible screens reconcile every 60 seconds, or every 15 seconds when notification delivery is unavailable. Hidden/offline screens do not poll. Local mode uses process-local SSE instead.

## 6. Media operations

The public `menu-images` bucket holds menu photos and branding; it must not contain private documents. Server-only writes validate image bytes, reject unsupported/animated content, enforce the 2 MB upload limit, rotate/resize within 1280×1280 and encode WebP. Management alone edits image references through supported application actions.

Image cleanup checks references and processes a bounded queue. Failures leave durable cleanup entries for later catalog/identity changes. Inspect provider errors and references before manual deletion; an RPC response can fail after a database commit has succeeded.

Excel imports do not supply photos. Missing/broken images have a text fallback. Demo uses fictional external image URLs and disables upload.

## 7. Backup and recovery

### Cloud application backup

`npm run backup` runs `scripts/backup-cloud.js`, loads `.env`, reads a cloud application snapshot and downloads referenced Supabase menu/branding images into a timestamped directory under `data/backups`. The manifest records image SHA-256 checksums.

The helper is manual, not a scheduler, managed database backup or complete Supabase project export. It does not recreate Auth identities, infrastructure, policies or migration history. It captures application state and referenced images; it is not a transactional snapshot across database and object storage. Secure the directory because state can include sessions, tokens and private records. Store an encrypted/off-device copy and define retention.

### Recovery approach

Restore into a separately prepared empty target, not directly over a running restaurant. Apply compatible schema, validate snapshot format/checksums, restore image objects and update URLs where necessary. Recreate or migrate Auth identities deliberately, remap profiles if IDs differ, and discard old sessions. Compare transaction/order/portion counts and payment/expense/debt totals. Verify access boundaries and a representative service flow before switching traffic.

There is no automated production restore command. The domain state is not itself a ready-to-import SQL dump. Recovery tooling must preserve IDs, constraints and ownership redirects. A successful backup command is not proof of successful recovery; perform restore drills.

### SQLite backup

The cloud helper is not a SQLite backup tool. Use a consistent SQLite backup method or stop the process cleanly before copying the database. Account for WAL state; copying only a live main file can miss committed work. Keep the Node version/schema behavior and app revision needed for restoration, and validate totals before resuming service.

## 8. Reset and legacy import tools

`scripts/reset-cloud.js --confirm-total-reset` is destructive. It clears application restaurant/catalog/profile/session state and app-managed imagery, returning empty settings. Supabase Auth accounts are separate and can regain access after reset if still allowed. Use only with explicit authorization and verified target configuration, never as a health check.

`scripts/plan-legacy-import.js` and `server/legacy-import.js` support specialized historical-import planning/application. They are maintenance tools rather than a public generic transaction import UI. Review their input/target contract before use; catalog XLSX import is a different feature. `scripts/migrate-branding.js` handles legacy embedded branding references and should only be used when that condition exists.

## 9. Verification tools and their effects

| Check | What it establishes | Operational effects / limits |
| --- | --- | --- |
| `npm test` | Domain/API rules, ownership/session boundaries, finance, imports, read selection, adapter conflicts and demo isolation | Local fixtures/mocks; does not prove deployed SQL/provider behavior |
| `npm run build` | Frontend production compilation | Does not test browser usability or cloud integration |
| `npm run test:security` | Anonymous privileged RPC/Storage denial and hidden-table API boundary | Targets configured cloud project; attempts a forbidden upload; use a dedicated test environment |
| `node scripts/verify-realtime.mjs` | Catalog subscription/probe delivery and anonymous staff-channel denial | Sends a random notification probe; does not create orders or finances |
| `node scripts/deployment-check.js <exact-url>` | Cloud health/routes, deployed frontend match, public projection and setup denial | Requires matching local `dist`; sends a setup request expected to be denied; normal cloud target only |
| `node scripts/live-smoke.js <exact-url>` | A wider provider-integrated service flow | Creates temporary staff/data/images/payments and cleans them; only an isolated authorized test target |

Protected-deployment checks support `--protected` and require the configured team/protection helper; the helper depends on Windows and the Vercel CLI. Do not interpret a cloud integration check as a passive local test.

Documentation changes do not require creating production test records. Browser/device checks remain necessary for kitchen audio, keyboard/focus behavior, touch targets, responsive layout and motion feel.

## 10. Operational risks and growth limits

- Cloud availability depends on both host and Supabase services/network. Browser storage is not a reliable offline ordering queue.
- Free/limited plans can interrupt service; choose operational guarantees deliberately and keep a restaurant fallback process.
- Full-snapshot writes, global revision contention and unbounded history are the main known scaling pressures.
- XLSX generation and image work run in requests, including the configured Vercel 30-second function budget.
- Finance/history collections are not universally paginated at the database boundary.
- Local synchronous SQLite and process-local notifications favor one instance, not horizontal replicas.
- There is no implemented refund, expense correction, unmerge, inventory or multi-restaurant boundary.

Useful future measurements include request latency/errors, snapshot/payload sizes, commit conflict/retry rates, notification reconnect/fallback frequency, Storage cleanup backlog and backup restore age. These are proposed operating signals, not claims of an already-installed monitoring system.

## Implementation references

[API and authorization](../server/app.js), [staff Auth](../server/staff-auth.js), [private session context](../supabase/migrations/20261025105555_private_context_authorization.sql), [backup](../scripts/backup-cloud.js), [cleanup](../server/image-cleanup.js), [deployment check](../scripts/deployment-check.js), [security checks](../scripts/security-smoke.js), [Realtime verification](../scripts/verify-realtime.mjs), [live smoke](../scripts/live-smoke.js).
