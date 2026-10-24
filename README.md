# restoOS

A local restaurant operations application built from the supplied Indonesian PRD. Includes a public ordering portal, active customer transactions and timestamped orders, waiter payments and delivery, kitchen display, menu availability, branding, staff roles, and management summaries.

## Run

Requires **Node.js 24 or newer** (uses built-in SQLite).

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000` to go directly to the public menu at `/portal`. Public navigation does not expose login or staff links. Staff access is at the unlisted `/ruang-staf` route, marked `noindex, nofollow, noarchive`. On first staff access, create your password; the username is `admin`. Each login then opens a choice of **Dapur**, **Garson**, or **Manajemen**. Add staff identities under **Manajemen → Pengaturan → Akses staf**. Every authenticated staff member can select any of these working contexts, as requested; roles are session workspace choices, not permanent account types. Server authentication and action checks remain in place.

### Three workspaces

- **Dapur:** full-width KDS with production-focused typography, station header, cooking/readiness actions, audio activation, ordering pause and compact menu availability. No financial dashboard or customer-payment controls.
- **Garson:** service header, horizontal navigation, active-transaction counters, customer search and orders, delivery, per-unit/order payments and compact availability. No management settings or business reporting modules.
- **Manajemen:** report sidebar, business summary, read-only transaction history, catalog and restaurant/staff settings. No create-order/payment/delivery controls; switch workspaces to perform service work.

The small **Pindah role** button sits beside **Keluar** in each workspace. It returns to the chooser without another credential prompt. Refresh keeps the selected workspace for the current login session; logging in again always starts at the chooser. Old sessions without a selection also enter the chooser. Existing account `role` fields are retained for compatibility but no longer determine the active workspace. No order, payment or account data is removed by this change.

```powershell
npm run build
npm start
```

For a different port: `$env:PORT='3001'`. Server code changes require restarting the server; frontend changes refresh through Vite. Staff sessions expire after 12 hours.

## Data and behavior

- SQLite persistence at `data/resto.sqlite`, excluded from version control. Stop the server before copying the database for a simple backup. Do not delete it to update the application.
- `RESTO_DB` selects a separate database. `HOST` defaults to loopback. Set `RESTO_SECURE_COOKIE=1` when serving through HTTPS. Remote deployment, reverse proxy configuration, backups and load testing are not included in this local build.
- All timestamps are UTC ISO strings. The UI formats them with the device's local timezone, including the boundaries of the management period filter.
- IDR integer amounts and final menu prices, without tax/service additions.
- Auto-accept at **15 seconds**, on the server; it continues while ordering is paused. KDS **Aktifkan suara** enables two short tones when an order is accepted. Browser gesture/audio permissions and an open KDS are required; no push or background notification service is implemented.
- Each ordered portion has independent cooking, delivery and payment state. Paying does not mark food delivered. A transaction closes automatically only when every portion is cancelled or both delivered and paid.
- **Transaksi** is the canonical customer grouping; **Pesanan** is one submission with its own timestamp. There are no order sessions or time-gap splits. Completed transactions never reopen. Staff authentication sessions remain separate.
- The waiter has one top **Buat order** entry: search active customer transactions or explicitly add a new customer when no name matches. Transaction details show total and per-order balances, add-order actions, and an edit-name button beside the name.
- Kitchen demand totals waiting, accepted and cooking portions per menu, excluding ready, delivered and cancelled portions. It stays beside the queue on desktop/tablet and opens as a collapsible summary above it on phones.
- Management shows **Transaksi belum selesai**, including paid transactions still awaiting delivery. **Pilihan pelanggan** counts ordered portions minus cancellations, regardless of payment.
- Anonymous ownership is checked using an opaque, persistent HttpOnly cookie. Names and slugs cannot grant access. Staff sessions and roles are checked on the server. The public portal explicitly narrows access even when the browser also has a staff session.
- SQLite transactions protect order creation, normalized active-name uniqueness, payment allocation, delivery transitions, and transaction closure. Stable request IDs prevent duplicate order retries; duplicate unit payment/delivery is rejected with fresh-state guidance.
- Progressive limiter is **tentative pilot configuration**: the fifth unique order attempt in 60 seconds triggers 15, then 30, then 60 minutes. Waiter unban preserves strikes but resets the current counting window. No global 20/min limiter is enabled. This is not a complete network/DDoS defense.
- Paid portions and delivered portions cannot be cancelled until a refund/correction policy is implemented. Original order price/name snapshots remain intact when the catalog changes. No fake refund is recorded.

## Menu import

Open **Manajemen → Katalog menu → Impor Excel** to download the workbook template, upload a completed `.xlsx`, review additions/updates and validation errors, then save. The `Menu` sheet uses **Nama menu, Kategori, Harga (IDR), Deskripsi, Tersedia**; the separate `Panduan` sheet explains the fields. Limit: 1,000 rows and 500 KB. Matching normalized names update existing menu items; other names create items. Invalid files make no changes, stale previews require reloading, and prior order snapshots retain their original names/prices.

The template is served at `/templates/template-menu-restoOS.xlsx`. Photos are preserved during updates and are not imported from Excel. `FEATURES.menuImageUpload` stays false until Supabase Storage is connected; the interface discloses this pending capability.

## Verification

```powershell
npm test
npm run build
```

Tests cover complete and partial payment lifecycles, safe closure, name reuse/normalization, timestamp retention without session grouping or time-based splits, ordered-minus-cancelled popularity, kitchen demand aggregation, Excel template/import validation, atomic imports and stale-preview rejection, retry behavior, availability and price validation, role checks, auto-accept during pause/ban, cancellation terminal state, progressive ban/unban, price snapshots, rollback, and actual HTTP ownership/permission boundaries using a separate in-memory database.

Browser checks covered the public checkout, manual partial payment followed by remaining order payment, delivery after payment, kitchen readiness, audio activation, and widths 360, 390, 768, 1024 and 1440. The updated transaction picker/detail, kitchen workload, management totals and Excel preview were also checked at those widths. A workbook import was completed against the isolated QA catalog. Screenshot evidence is under `.impeccable/review/` (ignored). Activating audio was verified in the UI; audible output still needs a check on the actual kitchen device. Phone keyboard behavior and touch ergonomics should also be checked on real hardware before pilot.

## Optional isolated QA data

```powershell
node scripts/qa-fixture.js
$env:RESTO_DB='data/qa.sqlite'
$env:PORT='3002'
npm run dev
```

The fixture creates **separate test data** and three test accounts: `qa_manager`, `qa_waiter`, `qa_kitchen`; password `resto-test-only`. These names identify fixture accounts; each account can choose all three workspaces on login. These are only for the QA database; never use that database for pilot or expose it on a network. Re-running the fixture preserves existing QA data. The default application database has no preconfigured credentials or fabricated sales.

## Visual system and assets

See `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, and `public/ASSET-CREDITS.md`. The starter restaurant name **Ruang Rasa**, catalog and photographs are examples. Replace them with the restaurant's own catalog/identity before pilot. Font and image files are served locally; downloading them again is optional with `scripts/fetch-assets.ps1`.

## Before pilot

Decide the financial correction/refund workflow and secure device handover/recovery policy. Add production hosting/TLS and backup procedures, tune abuse controls with real traffic, and run the entire acceptance matrix with concurrent real devices. The local implementation uses one transactional JSON state document within SQLite; it is suitable for functional validation but still needs capacity profiling and a normalized storage migration for sustained high-volume production.
