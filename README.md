# restoOS

A restaurant operations app connecting customer orders, kitchen preparation, delivery, and manual payment in one shared workflow.

## Workspaces

| Page | Purpose |
| --- | --- |
| `/portal` | Customer menu, cart, order submission, and outstanding balance |
| `/ruang-staf` | Staff sign-in and workspace selection |
| `/api/health` | Application and database health |

`/` redirects to `/portal`. The public portal does not link to staff access.

After signing in, staff choose **Dapur**, **Garson**, or **Manajemen**. Each has its own layout and tools. The workspace belongs to the login session and can be changed beside logout. Every staff account can choose all three workspaces; these are working contexts rather than account permission tiers.

## Requirements and local development

Use **Node.js 24 or newer**.

```powershell
npm ci
npm run dev
```

Open `/portal` or `/ruang-staf` on the address reported by the development server. For a production build:

```powershell
npm run build
npm start
```

Without Supabase credentials, the app uses SQLite at `data/resto.sqlite`. A new database has an empty catalog, no accounts, and no transaction history. Initial admin creation is available from `/ruang-staf` only on the server computer. Add menu items and configure the restaurant after signing in.

Copy `.env.example` to `.env` to configure Supabase. An explicit `RESTO_DB` selects SQLite even when Supabase credentials are present. Use a separate database for tests and experiments. Never expose test data or credentials publicly.

| Setting | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project API endpoint |
| `SUPABASE_SECRET_KEY` | Server-only database and Storage credential |
| `SUPABASE_PUBLISHABLE_KEY` | Optional anonymous-access security checks |
| `RESTO_DB` | Explicit SQLite database file |
| `PORT` | Application port |
| `HOST` | Bind address; defaults to loopback |
| `RESTO_SECURE_COOKIE` | Set to `1` when serving local Node through HTTPS |

## Behavior

- One restaurant and one kitchen; dine-in customers do not need accounts.
- **Transaksi** groups a customer's active orders. **Pesanan** is one timestamped submission.
- Each portion has separate preparation, delivery, and payment states. A transaction closes only when every portion is cancelled or both paid and delivered.
- Stable request IDs prevent duplicate order retries. Concurrent payment or delivery of an already processed portion is rejected.
- Orders auto-accept after 15 seconds, including while new ordering is paused. Kitchen sound requires an open browser and audio activation.
- Customer ownership uses an opaque HttpOnly cookie. Staff authentication and workspace checks run on the server.
- Cloud staff use Supabase Auth email/password; see [first-account setup](docs/PRODUCTION.md#first-staff-account-with-supabase-auth). Staff sessions expire after 12 hours. Names are unique while transactions are active.
- The base currency defaults to IDR and can be configured before recording activity. Changing it does not convert stored amounts. Prices are whole-number final amounts without added tax/service charges.
- Server timestamps use UTC; the interface uses the device's local timezone.
- Cancelling paid or delivered portions is blocked; refund and correction workflows are not implemented.

## Catalog and photos

Manage the catalog in **Manajemen → Katalog menu**. Menu photos accept PNG, JPG, or WebP up to 2 MB when Supabase Storage is configured. The server validates image bytes, removes metadata, and saves resized WebP images. Only Manajemen can upload, replace, or remove photos.

The Excel import template at `/templates/template-menu-restoOS.xlsx` is intentionally blank. Its `Menu` sheet uses **Nama menu, Kategori, Harga, Deskripsi, Tersedia**, with instructions on `Panduan`. Imports support up to 1,000 rows and 500 KB, validate the entire file, and require a preview before saving. Matching names update existing items; historic order prices and existing photos remain unchanged.

No demonstration photographs, sample restaurant catalog, or preconfigured staff credentials are bundled with the application. Synthetic catalog data lives only in test fixtures. Missing photos use a text fallback.

## Verification

```powershell
npm test
npm run build
```

Tests exercise domain rules, HTTP ownership and workspace boundaries, payments and closure, imports, cloud conflict retries, currency behavior, image validation, and production rendering of the menu editor. Test fixtures are isolated from the application database.

See [deployment and operations](docs/PRODUCTION.md) for Supabase, Vercel, backups, and optional integration checks; [PRODUCT.md](PRODUCT.md) for product behavior; and [DESIGN.md](DESIGN.md) for interface conventions. Font licenses are listed in [asset credits](public/ASSET-CREDITS.md).

## Current limits

There is no offline mode, payment gateway, inventory, refund workflow, or background push notification service. Abuse limits are an initial configuration, not a full network defense. Cloud reads currently reconstruct a complete backend snapshot; larger histories need scoped queries and pagination. Verify kitchen audio and touch behavior on real devices before relying on them in service.

Menu descriptions support optional Excel columns such as `Deskripsi [en]`, `Deskripsi [tr]`, and `Deskripsi [ar]` after the five base columns. `Deskripsi` is the Indonesian default. Only descriptions are localized; names, categories and prices stay the same. There is no application language-count limit within the 500 KB/1,000-row import limits. Empty or omitted translations preserve existing values. The portal lists every matching menu regardless of language and falls back per item to its default description. Download the multilingual template from the import dialog.

## Mode demo

Set `APP_DEMO_MODE=true` in the deployment environment and redeploy. On Vercel, apply it only to the intended demo environment/project. Keep production database credentials out of that demo project. `false` or unset preserves normal database behavior (Supabase is required on Vercel).

Demo is selected by the server at runtime. All API operations run against visitor-supplied demo state, stored in browser localStorage and serialized across browser tabs. No demo state enters SQLite, Supabase Auth, Database, or Storage, even when cloud credentials are present. Use “Masuk ruang staf” from the menu to enter `/ruang-staf` without login, then choose Dapur, Garson, or Manajemen. Production still requires login. Use the banner to reset the dataset. Separate browsers have independent datasets; realtime collaboration between devices is not provided. Clearing browser storage resets progress. Demo data is public, editable, and unsuitable for real customer information. Image upload is disabled; bundled image URLs remain available. Spreadsheet import and report export use demo data.

The initial dataset contains 8 menu items / 3 categories, 3 cooking orders, 4 ready for delivery, 5 old receivables (3 partly paid), 6 completed transactions, receipt-backed income, and 6 operating expenses. Dates are relative to first initialization. “Being delivered” uses the app's existing ready/awaiting delivery status until a waiter confirms delivery.

Menu photographs use free Unsplash images under the [Unsplash License](https://unsplash.com/license). Source URLs are recorded in `server/demo-seed.js`; photographs illustrate the fictional dishes and load from images.unsplash.com.
