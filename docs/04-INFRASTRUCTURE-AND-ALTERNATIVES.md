# 04 — Infrastructure and alternatives

[Index](INDEX.md) · [Operating runbook](05-SECURITY-OPERATIONS-AND-DEVELOPMENT.md)

## 1. Configured deployment architecture

The repository targets **Vercel + Supabase** for normal cloud operation and **standalone Node + SQLite** for local use/QA. This describes source configuration, not a live-account audit.

| Layer | Current implementation | Role |
| --- | --- | --- |
| Frontend | React 19, Vite 7 | Browser SPA, static production build in `dist` |
| API | Express 5, Node 24 target | Authentication, domain commands and selected reads |
| Hosting | Vercel static assets + `api/index.js` function | Same-origin UI/API routing |
| Cloud data | Supabase PostgreSQL via server RPC | Persistent state and atomic multi-entity writes |
| Staff identity | Supabase Auth | Email/password verification and account status |
| Media | Supabase Storage, public `menu-images` bucket | Menu photos and branding |
| Synchronization | Supabase Realtime Broadcast | Revision notifications; HTTP remains the data path |
| Scheduled maintenance | PostgreSQL cron from migrations | Session/login-attempt cleanup and cron-log retention |
| Local persistence | Built-in `node:sqlite` | Single-file database; local username/password login |
| Spreadsheet/image work | ExcelJS, JSZip, sharp | XLSX import/export and image processing |

The repository declares Node `>=24`; deployment should deliberately select and test Node 24 rather than treating every future major as automatically verified. Dependency declarations and exact lockfile resolutions can differ: use `npm ci` for reproducibility. Supabase JS and sharp have exact manifest versions; several other dependencies use ranges.

### Vercel routing and limits configured by this project

`vercel.json` builds with `npm run build`, serves `dist`, places API functions in `fra1` (Frankfurt), and sets `api/index.js` to 30 seconds maximum duration. This is the project's configuration, not a statement about every provider plan's maximum.

`/api/*` rewrites to the API handler; `/portal` and `/ruang-staf` serve the SPA entry. `/` and `/index.html` redirect to the portal. Headers include content-type protection, referrer policy, frame denial and staff-page robot exclusion. Region proximity to the database matters; the database's actual region was not checked here.

Vercel mode refuses normal operation without the cloud database configuration. A function filesystem is not the application's persistent SQLite strategy. Demo mode is the explicit exception because it uses visitor-held state.

Provider context: [Vercel runtimes](https://vercel.com/docs/functions/runtimes). Project-specific facts above come from [vercel.json](../vercel.json), not provider defaults.

## 2. Configuration contract

| Variable | Use and setup implications |
| --- | --- |
| `SUPABASE_URL` | API endpoint for the selected Supabase project |
| `SUPABASE_SECRET_KEY` | Server-only privileged key; never put in browser variables or documentation |
| `SUPABASE_PUBLISHABLE_KEY` | Browser Realtime configuration and anonymous security checks; without it cloud live-config falls back to version checks |
| `RESTO_DB` | Explicit SQLite override, even with cloud credentials; use an isolated absolute path for hosted disks |
| `APP_DEMO_MODE` | Exact string `true` selects isolated demo; unset/false uses normal selection |
| `HOST`, `PORT` | Standalone listener; defaults `127.0.0.1:3000` |
| `RESTO_SECURE_COOKIE` | `1` enables Secure cookies outside automatic Vercel handling |
| `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Optional deployment/protection helpers; not business-domain configuration |

Selection order is demo → cloud when URL/secret exist and `RESTO_DB` is absent → SQLite. Media enablement independently checks URL/secret, so an explicit SQLite override with cloud credentials can still enable Supabase image operations. For fully isolated local QA, use a clean environment as well as a separate database.

The standalone entry loads `.env` when present, except for `RESTO_DB=:memory:`. It does not explicitly load `.env.local`; that file must not be assumed to configure the backend. Set provider runtime variables through the hosting environment. Never prefix secrets with `VITE_`.

## 3. Keeping the current cloud stack

Required setup:

1. Create a dedicated Supabase project and apply all repository migrations in order. Confirm required cron/Realtime/Storage facilities and grants, not only table creation.
2. Disable public Auth signups. Create the first confirmed staff user in Supabase; every allowed account can select management.
3. Configure URL, server key and publishable key on the correct Vercel project/environment. Keep preview and production databases separate.
4. Configure Node 24, deployment routing and function region; compare region with the database location.
5. Initialize restaurant settings, currency and catalog. Migrations do not supply live staff accounts or restaurant menu data.
6. Verify Auth, private RPC denial, catalog/staff notification boundaries, menu media, order-to-payment lifecycle and backup recovery in an isolated environment.

This option has the least integration work because the code uses Supabase Auth, Storage, RPC and Realtime together. Tradeoffs include provider quotas, usage-sensitive costs, external-network dependency and integration coupling. Exact charges/SLA depend on the chosen accounts and plans; no pricing estimate is implied.

## 4. Hosting alternatives at a glance

These are compatibility assessments of this code, not benchmark results or an endorsement of a particular provider plan.

| Alternative | Reuse level | Additional work |
| --- | --- | --- |
| Always-on Node service + existing Supabase | High | Listener, TLS/proxy behavior, routing/headers, secrets, health and process restart setup |
| VPS/on-prem Node + SQLite | High for core local mode | Persistent disk, single process, local setup/auth, backup and network management; photo limitations |
| Container host + existing Supabase | High | Author a Dockerfile, package native dependencies, configure runtime/health/TLS |
| Self-hosted Supabase + Node host | Moderate integration, high operations | Run/configure full provider stack, extensions, security, backups, upgrades and compatibility validation |
| Another PostgreSQL provider | Significant code migration | Replace RPC transport/Auth/Storage/Realtime dependencies or keep selected Supabase services |
| Worker/edge runtime | Significant runtime migration | Audit Node API/native-addon compatibility and replace incompatible persistence/image paths |

No Dockerfile, container orchestration manifest, alternative database adapter or turnkey migration utility is currently provided.

## 5. Alternative A: move only the application host

Run the existing standalone entry on an always-on Node platform or VPS while retaining Supabase. Build with `npm ci` and `npm run build`; start with `npm start`. A platform that needs a public listener requires `HOST=0.0.0.0` and its assigned `PORT`.

Additional setup:

- Put the service behind HTTPS and configure `RESTO_SECURE_COOKIE=1`.
- Review proxy trust. The app currently sets `trust proxy` automatically only on Vercel. Another reverse proxy may need an explicit, bounded Express trust configuration so protocol/origin checks and IP-based limits use the real request context. Setting Secure cookies alone does not fix proxy-derived `req.protocol`.
- Recreate platform headers from `vercel.json`, redirects, SPA routes and API routing. `server/index.js --production` already serves the two known page routes and static assets; Vercel header rules do not automatically migrate.
- Configure restart policy, logs, health checks, secrets and deployment rollback.
- Keep browser API requests same-origin. Splitting UI and API onto unrelated origins requires deliberate cookie/CORS/CSRF changes; it is not currently a configuration-only move.

No app database disk is needed in this topology because PostgreSQL remains external. Full request processing still needs enough memory/time for snapshot writes, sharp and XLSX work. Changing hosts does not remove those bottlenecks.

## 6. Alternative B: local/on-prem or hosted SQLite

This uses the existing SQLite adapter and local authentication, without requiring Supabase for core operations. Suitable contexts include controlled local usage and QA. It is not the product's offline mode: clients still need a reachable application server, and WAN absence does not create offline browser queuing/synchronization.

Example standalone settings:

```text
HOST=0.0.0.0
PORT=3000
RESTO_DB=/persistent-data/resto.sqlite
RESTO_SECURE_COOKIE=1
```

The path is illustrative and must match an actual mounted disk. Set Secure cookies only when clients use HTTPS. Keep the server bound to loopback during initial admin setup, which accepts only server-local connections; establish network exposure afterwards and verify proxy security.

Required additions include a persistent disk, a single application process, a service manager, TLS/reverse proxy where appropriate, firewall/LAN configuration, off-device backup, restore drills and power/network planning. Do not point several replicas at one file and assume their in-memory revision/SSE channels synchronize.

For a managed host, persistence must be explicitly provisioned. For example, [Render documents persistent disks](https://render.com/docs/disks) and states that ordinary service filesystems are ephemeral; only the mounted path persists. Check current service eligibility and deployment constraints before choosing a plan.

Without cloud media credentials, menu-photo upload is unavailable. Implement a local media adapter, URL validation, file serving and cleanup if full media support is required. Existing external photo URLs may still need internet. `npm run backup` is a cloud helper, so SQLite needs a separate consistent backup procedure; copying only a live main file while ignoring WAL is not a recovery plan.

## 7. Alternative C: containers

A container can package the standalone Node service with the same Supabase backend. It still needs a host and operational configuration; it is not a database or backup solution.

Create a Dockerfile with a tested Node 24 base, lockfile install, Vite build and production entry. Validate sharp binaries/system compatibility and availability of built-in SQLite even when cloud is selected, because the domain module imports it. Run with an appropriate non-root user, inject secrets at runtime and expose the selected port. Add health checks, resource limits, log collection, graceful shutdown handling if needed, and a restart/deployment policy.

For SQLite, mount persistent storage and retain the single-process restrictions. For cloud, keep the container stateless. Containerization has not been implemented or tested in this repository.

## 8. Alternative D: self-host Supabase

Self-hosting can preserve more API concepts than replacing Supabase with a raw SQL service, but operational responsibility increases substantially. The official [Docker self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker) assumes Docker/Compose, Linux administration and networking knowledge.

Prepare a secured host, persistent database/object volumes, DNS/TLS, generated keys, Auth configuration and signup restrictions. Configure PostgreSQL, API/RPC access, Auth, Storage, Realtime and the cron capabilities used by these migrations. Verify compatibility of `auth.users`, private session context, `realtime.send`, Realtime authorization policies, bucket setup and scheduled jobs against the selected self-hosted versions.

Migrate application data, media and Auth identities as separate concerns. Update public object URLs, credentials and browser Realtime configuration; expire old app sessions. Add monitoring, backups, restore tests, upgrades and incident response. Existing Supabase URLs/keys and a database dump alone do not constitute a complete cutover.

## 9. Alternative E: another PostgreSQL provider

A PostgreSQL service such as Neon can store relational/JSONB data, but this code calls Supabase HTTP RPCs instead of a generic `DATABASE_URL`. The provider's own features should be assessed separately; no service is assumed to implement Supabase's exact API contracts. See [Neon's documentation](https://neon.com/docs/introduction) for its current capabilities.

Required application changes:

1. Implement a database adapter using a suitable SQL driver/connection strategy, or deploy a compatible RPC layer. Reproduce atomic revision compare-and-commit and targeted read semantics.
2. Adapt SQL that depends on Supabase roles, `auth.users`, Storage, `realtime.messages`, `realtime.send`, `auth.uid()` and cron. Applying the migrations unchanged to plain PostgreSQL is insufficient.
3. Select and integrate staff Auth. Preserve confirmation/ban checks, application sessions, workspace behavior, revocation and staff creation.
4. Replace media APIs and URL allowlists, or explicitly retain Supabase Storage.
5. Replace change delivery with a supported service, shared pub/sub/SSE, or intentional version polling. Preserve private/public topic boundaries and reconnect reconciliation.
6. Migrate data/media/identities, validate reports and test concurrency before cutover.

A hybrid can keep Auth/Storage/Realtime on Supabase, but private session validation currently joins its Auth table from the business database. Moving only business tables still requires redesigning that boundary.

## 10. Replacing individual services

### Object storage

An S3-compatible store or another media service requires upload/delete/public-URL adapters, secret management, content-type/cache settings, allowed URL validation, old-image cleanup and backup changes. Current code recognizes Supabase-specific prefixes in settings, media deletion and backups. Migrating only `server/media.js` would leave incomplete behavior.

### Authentication

Another Auth provider requires sign-in/account-management integration, server-side account status validation, local profile mapping and session-context changes. A new provider's token cannot simply replace a Supabase token used for private Realtime subscription. Preserve the product decision that all admitted staff may choose all workspaces unless requirements change explicitly.

### Realtime

Polling can preserve correctness through the version endpoint if explicitly configured and tested. Low-latency multi-instance notification needs a shared delivery mechanism; the local process subscriber is insufficient across replicas. The current cloud implementation is based on [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast), not raw table-change payloads delivered to browsers.

## 11. Edge/runtime alternatives

Do not treat a Node compatibility flag as proof that this application runs unchanged in a worker environment. Audit `node:sqlite`, synchronous crypto, filesystem assumptions, Express entry behavior, sharp and workbook processing. Split or replace unsupported work and test the complete import/export/image flows. [Cloudflare's compatibility documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) describes its runtime surface; project compatibility remains unverified.

## 12. Cutover checklist for any alternative

Keep the old system recoverable, stop or control writes during final migration, export and verify data/media, recreate identities appropriately, and discard old sessions. Compare order/portion/payment counts and financial totals, exercise merges and stale-session rejection, validate private access and notification recovery, then switch traffic. Define rollback before switching; reverse migration becomes harder once the new target accepts writes.

These steps describe future work. No infrastructure, accounts, environments or production data were changed by writing this guide.
