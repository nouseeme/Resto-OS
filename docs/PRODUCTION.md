# Deployment and operations

This guide describes the application independently of any owner's account, project identifier, hostname, or local machine.

## Runtime

Vercel serves the Vite build and routes `/api/*` to the Node.js handler. Use Node.js 24 and place Functions near the Supabase database. The repository's default region is Frankfurt; review `vercel.json` for your deployment.

Application pages are `/portal` and `/ruang-staf`; `/` redirects to the portal. `/api/health` checks the application database. Staff routes remain authenticated even if the customer portal is public. Configure platform protection separately for previews and production.

## Supabase configuration

Apply the versioned SQL files in `supabase/migrations` to a dedicated project. Configure server environment variables `SUPABASE_URL` (project endpoint) and `SUPABASE_SECRET_KEY` (server-only credential).

Never prefix secrets with `VITE_` or put them in client code. Production and preview should use separate data and credentials. Keep `.env` files, databases, backups, provider metadata, and local tooling outside source control.

Migrations create storage and scheduled work, not restaurant data or staff accounts. Public `/api/setup` is disabled for cloud databases. Cloud accounts use Supabase Auth as described below.

Local SQLite initialization is separate: without cloud credentials, first-run admin creation is restricted to the server computer. An explicit `RESTO_DB` keeps development or QA on a separate SQLite database even if `.env` has Supabase settings.

## First staff account with Supabase Auth

1. In Supabase Authentication > Users > Add user > Create new user, enter the initial admin email/password and enable Auto Confirm. No SQL or metadata flag is required.
2. Open `/ruang-staf`, sign in with that email/password, then choose Manajemen.
3. In Manajemen > Pengaturan > Akses staf, add the next staff member with their name, email, and password (at least 10 characters). The server creates a confirmed Supabase Auth account and its application profile. The new staff member can sign in immediately.

This Supabase project is dedicated to staff identities; every confirmed, unbanned Auth account can sign in and select Manajemen, Dapur, or Garson. Disable public signups in Supabase Auth settings; customers use the public portal without accounts. No public signup endpoint is provided by the application.

Cloud sessions last 12 hours and use opaque HttpOnly cookies. Every authenticated request checks the current Supabase user: deletion or bans revoke access on the next request. Old internal-password sessions are rejected in cloud mode. Existing local accounts must be recreated in Supabase Auth; password hashes are not migrated. SQLite keeps its username/password flow.

Ban or delete accounts through Supabase to revoke access. Accounts created directly in Supabase appear in the app after first login; accounts created in Management appear immediately.

## Database boundaries

Application data lives in the unexposed `resto_private` schema. Menu, customer transactions, orders, portions, payments, staff, sessions, audit, bans, retry records, and login attempts use separate tables. Entity payloads retain the domain model; relationships, money values, and active-name uniqueness have constraints and indexes.

`resto_snapshot` and `resto_commit` use SECURITY INVOKER. Only the server's service role can execute them. Private tables have RLS enabled without browser policies. No-policy notices represent intentional default denial, not a reason to grant browser access.

Writes commit changed rows against the revision they read. Conflicts retry against fresh state. Cron shares the revision lock, and session/workspace checks repeat during retries. Reads reconstruct the complete backend snapshot; profile capacity before increasing traffic or retaining large histories.

## Scheduled work and Storage

- Auto-accept checks due orders every second in PostgreSQL. Browser refresh adds display latency after the 15-second eligibility deadline.
- Cron logs older than one hour are removed every ten minutes.
- Expired sessions and stale login attempts are cleaned hourly.
- Staff tabs poll after each response plus five seconds; customer tabs use fifteen seconds. Hidden tabs stop polling.
- `menu-images` contains public menu photographs, with writes restricted to the server. Never upload private documents there.

Photo uploads are validated and converted to WebP, capped at 1280px. Saving a menu commits its image reference. Replacing/removing images cleans app-managed objects; database-only backups do not include Storage files.

Free hosting plans have usage limits and may pause or interrupt service. Keep an operational fallback. This project does not provide a paid availability guarantee.

## Deployment

```powershell
npm ci
npm test
npm run build
vercel project inspect --non-interactive
vercel deploy --prod
```

Confirm the linked owner, project, and environment before publishing. A local upload does not enable Git auto-deployment; configure that integration explicitly if wanted.

`scripts/configure-vercel-env.js` reads `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` from private environment configuration. It sends secrets through standard input rather than command arguments. This optional Windows helper can be replaced with provider dashboard configuration.

## Optional integration checks

`npm run test:security` uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to confirm anonymous RPC access and Storage writes are denied. Use a dedicated test project.

`scripts/deployment-check.js` takes an explicit target address. It checks routes, database health, the frontend build, and anonymous setup denial. Add `--protected` and configure `VERCEL_TEAM_ID` for protected deployments.

`scripts/live-smoke.js` takes an explicit target address. It creates a temporary staff identity, catalog item, images, orders, and payments, then cleans its own data. Run it only against an isolated, authorized test environment, not as a passive production health check. The protected-request helper requires Windows and the Vercel CLI. Cloud staff fixtures must use Supabase Auth.

## Backup and recovery

`npm run backup` exports application state and referenced menu images to `data/backups`, including image checksums. Backups contain private information such as local password hashes and sessions. Secure them and keep an off-device copy. The helper is manual, not a scheduler or managed backup service. Supabase Auth identities are managed separately and are not recreated by restoring the application snapshot.

Recover into a separately prepared empty environment. Verify snapshot format and image checksums, restore images, update URLs if necessary, and omit old sessions. Verify financial totals and access boundaries before switching configuration. Destructive production recovery is not automated.

## Reset

`scripts/reset-cloud.js --confirm-total-reset` deletes restaurant data, catalog images, application profiles, and sessions, restoring empty settings. It requires explicit owner authorization and matching private target configuration. Supabase Auth accounts must be managed separately; authorized accounts can sign in again after a reset.
