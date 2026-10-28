# restoOS
<!-- impeccable:product-schema 1 -->

## Platform

Web.

## Users

Dine-in customers without accounts, waiters, one kitchen, and restaurant management.

## Product purpose

Maintain one shared record from order submission through preparation, delivery and settlement. A transaction groups a customer's active orders; it is not a permanent customer profile. An order is one independently timestamped submission. Portions carry separate service and payment states.

## Operating context

Each staff login is followed by Kitchen, Waiter or Management workspace selection. Roles are switchable session contexts, not permanent account types or employee permission tiers. Every admitted staff member can choose all three. Refresh retains the selection; a new login requires another choice. A session without a workspace returns to the chooser.

Kitchen provides a full-width production queue, audio activation, ordering pause, availability and aggregated cooking demand. Waiter provides customer transactions, order creation, delivery, payment and availability. Management provides reports, read-only history, finance, catalog, settings and staff creation. Operational order/payment/delivery work requires the appropriate workspace; the server action matrix also allows management to pause ordering and change availability.

One restaurant and one kitchen are modeled. Open transaction names must be unique after normalization. Anonymous browser credentials establish portal ownership. Orders belong directly to transactions without time-gap splitting. Closure requires all portions to be cancelled or both paid and delivered.

Waiter order creation searches active transactions and offers a new name when no match exists. Transaction detail shows total and per-order outstanding balances and permits renaming active transactions. Customer grouping uses one shared list: recent non-cancelled orders keep a customer active; without a recent order, unpaid debt older than five hours places the customer in older debt. This is display grouping, not transaction expiration.

## Configuration

The base currency is selected in Management settings, defaulting to IDR. Stored amounts are whole numbers with no conversion when currency changes and no added tax/service calculation. Server timestamps and non-UI processing use UTC; UI dates use the device timezone.

New valid orders are accepted atomically and immediately enter the kitchen queue. Audio requires browser user activation. Waiting/cooking and manual-acceptance paths remain for compatibility; no acceptance delay or one-second acceptance cron is required by current writes.

## Capabilities and constraints

The root redirects to `/portal`. Normal portal navigation has no staff/login link. Staff access is at the unlisted `/ruang-staf`, backed by server authentication and workspace checks. Portal responses expose catalog and minimal visit identity, without order history, balances or payment details.

Payments are manual for selected portions or the remainder of one order. Paid or delivered portions cannot be cancelled; other cancellation requires a reason. Refund, payment correction, expense correction and unmerge are not implemented. There are no customer accounts, payment gateway, ingredient inventory, multi-restaurant isolation or offline operation.

Anonymous ordering initially limits a fifth submission within 60 seconds with bans of 15, 30 and then at most 60 minutes. These pilot controls are not a complete network defense. The proposed restaurant-wide 20/minute limit is not enabled.

## Catalog and languages

Management supports catalog editing and XLSX template/import with preview. Matching normalized names update items; new names add items. Validate the full file before atomic save. Existing order prices and existing menu photos survive catalog imports. Limits are 500,000 file bytes and 1,000 menu rows.

Static PNG/JPG/WebP photos up to 2 MB are uploaded on save when Supabase Storage is configured, converted to WebP and limited to 1280 px dimensions. Management controls photo replacement/removal.

The default `Deskripsi` column is Indonesian. Optional `Deskripsi [language-code]` columns localize descriptions only. Empty/omitted translations preserve existing values. The selector uses stored languages and falls back per item to Indonesian without filtering dishes out. Language count is flexible within workbook limits.

## Finance and reporting

Management combines customer receipts and paid expenses in one ledger. Expenses include event time, positive integer amount, category, payment method, recipient, note, optional reference, actor and idempotency identity. Category/method options can be added, renamed or archived, retaining at least one active choice.

Overview distinguishes sales by order time, receipts by payment time, paid expenses and net recorded cash movement. Active debt and unfinished transactions remain all-time obligations. Popular-menu counts use non-cancelled portions regardless of payment. Finance offers date/type/category/method/text filters and 50 UI rows per page.

A shared management export action downloads an XLSX snapshot with raw data, formulas, ledger, transaction/debt reports, financial/menu/category breakdowns and summary. Device-local period choices become UTC bounds; exported timestamps are UTC. Supporting history computes opening recorded cash and end-period debt. Recorded cash is neither bank balance nor profit. Existing raw-row edits recalculate dependent results; new rows/categories require extending ranges or re-exporting.

## Merge and portal lifecycle

Waiters can review and merge 2–50 active transactions into a selected survivor. Order/payment IDs, values, timestamps and unit states remain intact. References move to the survivor, whose opening time is the earliest merged opening. Source transactions remain internal ownership redirects excluded from lists/reports.

Linked guest cookies follow redirects for future submissions. Portal ownership reconciles on refresh/focus/submission/reconnect without exposing financial history. Closure occurs only when every non-cancelled portion is paid and delivered; paying or delivering alone is insufficient.

Closed portal state contains only a closure marker, not name/history/bill detail. Draft name/cart/request identity reset on closure or session change. Each anonymous submission supplies `sessionTabId` (null for a new session). Validation and redirect resolution occur inside the order transaction. Stale/closed submissions and completed-session replays receive HTTP 409 and cannot implicitly start or join a newer transaction.

## Implementation

React and Vite provide the browser interface; Express on Node 24 provides the API. Cloud deployment is configured for Vercel with Supabase PostgreSQL, Auth, Storage and Realtime. Cloud staff sessions, idempotency and login throttling are persistent. Reads are scoped by workspace/page with version reconciliation; writes still read full snapshots and commit changed rows under a global revision lock.

SQLite is the standalone/local adapter, explicitly selectable through `RESTO_DB`. It stores one serialized application-state document and uses local authentication and process-local SSE. It is not synchronized with cloud state.

`APP_DEMO_MODE=true` selects an isolated visitor-controlled browser dataset with fictional seed data and no live database/Auth/Storage access. Normal new installations remain empty.

## Brand commitments

Use natural Indonesian interface copy, ivory paper, editorial serif headings, dark text, thin rules and restrained vermilion accents. Project documentation is English. Follow [DESIGN.md](DESIGN.md) for interface conventions.

## Accessibility and inclusion

Target 44 px touch controls, visible keyboard focus, explicit status labels, reduced motion, and layouts from 360 px through desktop. These are targets and implementation conventions, not a complete accessibility certification.

## Initial state

Normal new installations have an empty catalog, no transactions and no staff accounts. Default identity is Restoran Anda and currency IDR. Synthetic data is restricted to tests and explicitly enabled demo mode.

## Further reading

[Documentation index](INDEX.md), [system design](02-SYSTEM-DESIGN.md), [data model](03-DATA-MODEL.md), [infrastructure alternatives](04-INFRASTRUCTURE-AND-ALTERNATIVES.md), [operations](05-SECURITY-OPERATIONS-AND-DEVELOPMENT.md).
