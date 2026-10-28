# restoOS — Product brief
<!-- impeccable:product-schema 1 -->

## TL;DR

restoOS is a web-based operating workspace for one restaurant and one kitchen. It connects customer ordering, kitchen preparation, waiter service and manual payment through one shared record, while giving each participant an interface organized around their work.

The central idea is that **food service and payment are separate obligations**. Customers can order more than once, dishes can become ready individually, and payment can happen before or after delivery. A transaction stays open until every portion is cancelled or both paid and delivered.

The product includes a public menu, three switchable staff workspaces, catalog management, recorded receipts and expenses, and spreadsheet reporting. Its current scope is day-to-day restaurant coordination rather than inventory management, online payment processing or full accounting.

## 1. What is the product?

restoOS maintains the relationship between what a customer ordered, what the kitchen still needs to prepare, what the waiter still needs to deliver, and what remains unpaid.

Its model has three levels:

| Concept | Meaning | Why it matters |
| --- | --- | --- |
| Transaction | The customer's active grouping of orders and obligations | Additional orders and outstanding balances stay together |
| Order | One timestamped submission within a transaction | Each round of ordering retains its own identity |
| Portion | One serving with its own service and payment states | Staff can prepare, deliver and settle items independently |

A transaction is not a permanent customer profile. The customer's display name identifies an active service grouping, while stable IDs preserve the underlying records. The application does not model a customer account, loyalty history, dining-table entity or multi-branch organization.

The main capabilities are:

- Account-free menu browsing, search, dish details, cart notes and order submission.
- Kitchen tickets, aggregated menu demand, portion readiness, ordering pause, availability and optional audio alerts.
- Waiter-assisted ordering, active-customer and older-debt grouping, delivery, manual payment, renaming and transaction merging.
- Management overview, read-only history, paid-expense recording, catalog/photos, staff access, branding and finance settings.
- Validated Excel catalog import and integrated XLSX report export.

## 2. Why does it exist?

Restaurant service involves several related handoffs. A submitted order becomes kitchen work, prepared food becomes delivery work, and delivered food may still carry a payment obligation. Keeping those records separately makes it harder to determine what remains unfinished.

restoOS addresses that coordination problem by preserving one service model across the customer, kitchen, waiter and management views. Each screen answers a different question using the same underlying transactions and portions.

The intended benefits are clearer handoffs, fewer ambiguous outstanding tasks, and more understandable records of orders and money. These are product objectives, not measured claims of faster service, higher revenue or improved customer satisfaction.

## 3. Who is it for?

| Participant | Primary need | Product response |
| --- | --- | --- |
| Dine-in customer | Choose food and send an order with little friction | A photographic public menu without registration |
| Kitchen staff | Know what needs preparation and what is awaiting pickup | A production-focused ticket board and menu-demand summary |
| Waiter | Identify who still needs food, payment or help ordering | Customer-centered service lists, transaction detail and delivery/payment actions |
| Management | Understand activity and maintain restaurant data | Reports, ledger, catalog, settings and staff administration |

Staff choose Kitchen, Waiter or Management after signing in. The choice persists for that login session and can be changed without another credential prompt.

**All admitted staff accounts can select all three workspaces.** These are task contexts, not permanent permission tiers. The server restricts actions by the selected workspace, but the current product does not isolate management access from other admitted employees.

## 4. Where is it used?

The product runs in browsers across customer phones and staff phones, tablets or desktop displays. The customer entry is `/portal`; the root URL redirects there. Staff use the unlisted `/ruang-staf` address. Keeping staff entry out of normal public navigation separates the experiences; authentication remains the security boundary.

The operating scope is one restaurant and one kitchen per installation. Staff share operational data through the application backend. Local hosting is possible, but clients still need a reachable server: there is no offline browser queue or automatic local/cloud replication.

The interface uses Indonesian. Optional manually maintained menu-description translations support browsing in other languages without translating the entire application. Project documentation uses English.

## 5. When does work begin and end?

A valid submission is accepted immediately and enters the kitchen queue. It does not wait for a timed acceptance job. Staff can act on portions individually, so a drink can become ready before another dish in the same order.

Payment and delivery can occur in either order. Closure depends on completed obligations, not elapsed time:

- Paid but undelivered portions still require service.
- Delivered but unpaid portions still carry debt.
- Cancelled portions no longer require service or payment.
- The transaction closes when all portions are cancelled or both paid and delivered.

Additional orders join the same open transaction. Midnight, a shift change or a long gap does not automatically create another transaction.

The waiter's five-hour grouping distinguishes recent activity from older unpaid debt. It changes list presentation, not transaction identity or closure. A recent non-cancelled order keeps a customer active; without one, debt older than five hours appears in the older-debt group.

## 6. How does the workflow operate?

1. **Browse and review.** A customer selects available dishes, quantities and notes, then provides a name. A waiter can instead find an active transaction or create a new one.
2. **Validate and record.** The server checks prices, availability, ordering pause, request identity and ownership, then records the submission and its portions together.
3. **Prepare.** Kitchen staff review tickets and notes, consult aggregate demand and mark portions ready. Ordering can be paused or individual menu availability changed.
4. **Deliver and settle.** Waiters deliver ready portions and record payment for selected portions or the remaining unpaid portions of an order.
5. **Finish the visit.** Once every obligation is complete, the transaction closes and the portal resets its draft and request identity.
6. **Review activity.** Management distinguishes order value, money received, paid expenses and outstanding obligations, then exports records when needed.

Browser ownership follows authorized transaction merges. Repeated requests are recognized, and stale requests from closed visits are rejected instead of silently attaching to a new transaction.

## 7. Product decisions

| Decision | Rationale and consequence |
| --- | --- |
| Account-free customer ordering | Keeps entry lightweight; ownership belongs to a browser credential rather than a recoverable customer account |
| A submission-focused customer portal | Customers browse and submit; staff handle order history, balances and payments |
| Transactions group submissions directly | Additional rounds remain together without inventing time-gap sessions |
| Portion-level service and payment | Supports staggered preparation, delivery and settlement without treating the whole order as one indivisible state |
| Workspace selection instead of permanent staff roles | Supports staff moving between jobs, while leaving employee-level management isolation outside current scope |
| Manual payment and restricted cancellation | Records real service payments without pretending to provide gateway settlement or refunds |
| Review before transaction merging or bulk catalog changes | Makes consequential grouping/editing changes explicit; merge has no unmerge flow |
| Separate sales, receipts and expenses | Avoids presenting ordered value as received cash or cash movement as profit |

Names must be unique while transactions are open. Catalog edits do not rewrite historical portion names/prices/categories captured when ordered. Menu import matches existing names, validates the complete file and preserves existing photos.

Currency is configured as one base currency, with whole-number final amounts and no automatic conversion or added tax/service calculation. It should be chosen before recording real activity.

## 8. Design decisions

The visual direction is **The Ivory Menu Book**: warm ivory surfaces, dark ink, fine rules, editorial serif headings and restrained brick-red accents. Newsreader supplies expressive headings and selected totals; Manrope supports controls, dense information and kitchen production text.

Consistency comes from shared typography, surfaces, controls and status language. Layout follows the job:

- The portal emphasizes food photography, exploration and cart review.
- Kitchen uses a broad production board with actionable tickets and demand summaries.
- Waiter service starts with customers, outstanding tasks and balances.
- Management uses stable navigation, comparative tables, filters and reporting hierarchy.

Desktop side panels become mobile drawers, dialogs or collapsible summaries as needed. Touch targets, visible keyboard focus, explicit status labels and reduced-motion paths are part of the design direction.

Motion acknowledges customer actions while data updates immediately. Staff motion remains restrained for repeated work. Sound is optional and requires browser activation; it is not the only signal for incoming orders. These conventions do not establish complete accessibility compliance or verified usability on every device.

## 9. Development decisions

The application is a modular monolith built with React/Vite and an Express API on Node 24. Keeping the service model in one application makes cross-workflow rules easier to coordinate than distributing them across independent services.

Shared modules provide reusable domain vocabulary and calculations. Domain/API tests cover ownership, closure, payment, merging, finance, imports, selected reads and conflict handling. A successful test/build is a development check, not proof of live provider behavior or device usability.

Catalog work and reporting use XLSX because they support bulk editing and portable review. Import requires validation and preview. Export is a snapshot with formulas, not a live database connection or an accounting integration.

Normal new installations start empty, with the default restaurant identity and IDR currency. Fictional data belongs to tests and explicitly enabled demo mode. Demo uses visitor-controlled browser state and is isolated from live database, Auth and Storage operations.

## 10. System and infrastructure decisions

The configured cloud architecture uses Vercel for the frontend/API and Supabase for PostgreSQL, staff Auth, media Storage and Realtime. This combines persistent business state and supporting services, while coupling the application to their integration contracts.

A standalone Node entry supports local or VPS hosting. SQLite is the existing local persistence option; it stores a serialized state document and uses local authentication. Cloud PostgreSQL separates entities into private tables with JSONB payloads, selected relational constraints and indexes. The two adapters share a logical model but not an identical physical schema.

The server is authoritative for prices, ownership, workspace permissions and state transitions. Browsers read through authorized API projections rather than querying private business tables directly.

Reads are selected by workspace/page and can return a small unchanged-version response. Cloud writes currently read a full snapshot, apply business rules and commit changed rows under a global revision lock. This favors understandable cross-entity consistency, with growing history and concurrent writes creating scale limits.

Realtime broadcasts and local SSE are refresh hints. Reconciliation through the API recovers missed events; notifications are not the record of truth. Media storage and database writes do not share one transaction, so image cleanup is handled separately.

Changing application hosts can reuse much of the current code. Replacing Supabase requires work across database transport, Auth, media, notifications and maintenance. Self-hosted Supabase preserves more of those concepts but transfers service administration, security, backup and upgrade responsibility to the operator.

## 11. Boundaries and tradeoffs

The current product does not include ingredient inventory, recipes/purchasing, payment gateways, refunds, payment/expense correction, unmerge, multi-restaurant tenancy or offline operation. Local SQLite favors a single application process; the cloud write design is not a claim of unlimited concurrency.

Menu-photo upload requires configured Storage. Database backups alone do not recover images or external Auth identities. Operating the product requires a reachable backend, appropriate hosting guarantees, protected backups and a tested recovery procedure.

Financial reports describe recorded activity, not full double-entry accounting, bank reconciliation or profit. UI/device checks and provider integration checks remain necessary beyond automated application tests.

## 12. What success should mean

The product is serving its purpose when staff can consistently answer four questions: **what was ordered, what still needs preparation, what still needs delivery, and what remains unpaid**.

Evaluation should examine whether those answers stay correct through additional orders, mixed portion states, partial settlement, older debt, merges and reconnects. Usability, service speed and satisfaction should be measured separately rather than inferred from the presence of features.

This brief summarizes the implemented product direction and its tradeoffs. It does not claim a live deployment audit, measured business outcomes or future capabilities as completed work.
