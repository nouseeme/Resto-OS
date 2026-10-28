# restoOS — UI/UX and product design case study

[Index](INDEX.md) · [Design system](DESIGN.md) · [Product workflows](01-PRODUCT-AND-WORKFLOWS.md)

## 1. Project overview

restoOS connects customer ordering, kitchen production, waiter service and management reporting in one restaurant workflow. The design challenge is to maintain a shared service model while giving each user an interface organized around their immediate work.

The design includes the customer portal, three staff workspaces, a shared visual system, transaction/portion detail, staged payment, catalog editing/import and responsive compositions. This document describes implemented design choices and a proposed portfolio presentation. It does not claim measured business impact or completed user research.

## 2. One system, four working contexts

| User | Main question | Interface response |
| --- | --- | --- |
| Customer | What should I order, and what is in my cart? | Photographic menu, dish detail, category/search and accessible cart review |
| Kitchen | What needs preparation, and what is ready? | Tickets, portion notes, two queue stages and aggregated demand |
| Waiter | Who still needs service or payment? | Customer list, outstanding balances, delivery queue and transaction detail |
| Management | What happened, and what needs configuration? | Overview, read-only history, ledger, catalog and settings |

The three staff spaces have different navigation/compositions. A session chooser and workspace switch support people who assist in more than one task. This is a workflow decision: all admitted staff can choose all three spaces, so the chooser should not be presented as a permanent permission hierarchy.

## 3. Visual direction: The Ivory Menu Book

Ivory paper, dark ink, fine warm rules, editorial serif headings and restrained brick-red actions connect the customer and staff experience. Newsreader gives headings and selected totals an editorial character. Manrope supports controls, dense detail and kitchen production headings.

Hierarchy comes from type, spacing, dividers and surface tones rather than a stack of elevated cards. Food photography supplies the portal's main imagery; staff screens prioritize names, portion status and actions. Status includes words so meaning does not rely on color.

The maintained token reference and component conventions are in [DESIGN.md](DESIGN.md).

## 4. End-to-end service flow

```text
Customer or waiter submits an order
                  ↓
Order and portions join an active transaction
                  ↓
Immediate acceptance into the kitchen queue
                  ↓
Kitchen marks individual portions ready
                  ↓
Waiter delivers ready portions
                  ↓
Transaction closes when every remaining portion is paid and delivered
```

Payment may occur before or after delivery. The design therefore separates payment and service state rather than forcing one sequence. A paid portion can still require delivery; a delivered portion can still carry debt.

Three levels make this understandable: transaction as the customer grouping, order as one timestamped submission, and portion as the actionable serving. Additional submissions retain their own identity inside the same open transaction.

## 5. Customer experience

```text
Open menu → browse/search → inspect a dish → add to cart
→ adjust quantities/notes → provide a name → review → submit
```

Browsing requires no account. Identity is requested at ordering time. Menu cards combine imagery, name, description, price and add action; a dialog reveals longer content without abandoning the list.

A desktop side cart connects exploration with review. A mobile fixed action exposes portion count/total and opens the cart dialog. State updates immediately and motion acknowledges the action.

Current portal responses deliberately exclude order history, outstanding balances and payment detail. Customers contact staff for those. Additional orders attach to the active session through ownership checks. Closure clears drafts/request identity so an old cart does not leak into a new visit.

Unavailable items, price changes, ordering pause and stale sessions are explained in relation to the customer's next action. A paused restaurant preserves the draft rather than implying submission succeeded.

## 6. Staff experience

### Waiter: customer-centered service

The shared customer list groups active service above older debt. Both groups remain visible/searchable together. The five-hour distinction is presentation, not automatic closure. A customer's balance still includes older orders.

One order-creation entry searches active transactions and offers a new transaction when appropriate. Transaction detail separates each submission, portion state and payment record. Payments can settle selected portions or the remaining portions of one order.

Merging multiple transactions uses explicit review and survivor choice because it changes identity/balance grouping. The implementation preserves underlying order/payment records and does not provide unmerge.

### Kitchen: portions as work

Tickets put customer identity, order time, items and notes near the production controls. “Dimasak” and “Menunggu Diantar” distinguish unfinished preparation from food awaiting waiter pickup. New submissions are accepted immediately; a mandatory manual acceptance step is not part of the current primary flow.

Portions can become ready individually. Aggregated menu demand helps staff see the total workload while actions remain on tickets, preserving customer/note context.

### Management: overview to explanation

The sidebar anchors overview, history, finance, catalog and settings. The overview separates order value, received money and outstanding obligations. Read-only history supports investigation without mixing in operational actions.

Catalog editing favors a comparison table. Import previews explain creates/updates and row problems before atomic commit. Finance combines receipts and paid expenses while keeping event dates and classifications explicit.

## 7. Interaction and responsive design

Portal motion connects adding a dish with cart acknowledgement. Category changes and values have deliberate transitions; staff interactions remain restrained. Reduced-motion paths shorten or skip spatial effects. Source values, rather than historical timing claims, are recorded in the design-system guide.

Responsive changes preserve the job: side cart becomes a fixed mobile entry; kitchen demand becomes collapsible; management sidebar becomes a drawer; transaction amounts stack; wide import tables scroll inside their own area.

Shared buttons, fields, focus, dialogs and status vocabulary maintain one product identity across different layouts. These implementation choices are not substitutes for current browser/device evaluation.

## 8. Feature map for portfolio material

| Area | Modules worth showing |
| --- | --- |
| Customer | Photographic catalog, search/categories, translated descriptions, dish detail, cart review, submission/session feedback |
| Staff entry | Login, workspace chooser and session switching |
| Waiter | Customer grouping, order creation, transaction detail, staged payment, eligible cancellation, merge review and delivery |
| Kitchen | Ticket queue, portion completion, ready queue, demand summary, audio activation, pause and availability |
| Management | Overview, read-only archive, receipt/expense ledger, catalog editing/images, XLSX preview/export, identity/staff/finance settings |
| Shared | Responsive composition, visible keyboard focus, status labels and recovery states |

Customer bill/history screens and delayed acceptance should not appear as current capabilities. Demo is a separate showcase mode with fictional data, not evidence that normal installations contain sample restaurant data.

## 9. Suggested design artifacts

| Artifact | Story it explains |
| --- | --- |
| Product map | Four contexts connected through one service model |
| Main user flow | Handoffs from submission through preparation, delivery and settlement |
| Workspace comparison | Consistent identity with task-specific information architecture |
| Visual-system excerpt | Color/type/components applied across browsing and operations |
| Desktop/mobile pair | Preserved priorities under a different composition |
| Interaction recording | Immediate state change with visual acknowledgement |
| Complex-flow sequence | Partial settlement or transaction merge with review |
| Catalog/import sequence | Preventing bulk-edit mistakes before saving |

Use a short recording for animation rather than trying to prove motion quality with a still image. Do not imply a usability study, conversion lift or service-time improvement without actual measurements.

## 10. Screenshot plan

No screenshots were captured as part of this documentation update. The following is a capture plan, not a set of delivered assets.

| Priority | Capture | State and annotation focus |
| --- | --- | --- |
| 1 | Desktop portal | Consistent food images and populated cart; connect browsing and review |
| 2 | Mobile portal/cart pair | Fixed cart entry and review dialog |
| 3 | Workspace chooser | Three tasks introduced together, with visible account context |
| 4 | Customer list | Active/older-debt groups with coherent balances and service states |
| 5 | Transaction and payment detail | Two submissions and partially settled portions; explain grouping and obligations |
| 6 | Kitchen queue | Several tickets/notes and aggregate demand; explain local and global context |
| 7 | Delivery queue | Ready portions across customers; explain the kitchen/waiter handoff |
| 8 | Management overview | Internally consistent sales, receipts, debt and service metrics |

Supporting crops can show dish detail, customer search, merge review, catalog editing, import errors, finance filters, identity settings and an empty/error state.

Use fictional data consistently across screenshots. Preserve customer/order identity from portal through service and payment. Present the portal first, then the service flow and workspaces, followed by complex interactions and responsive/system details. Keep annotations tied to visible decisions rather than generic claims.

## 11. Evidence and limits

This case study was refreshed against the current repository on 28 October 2026. It describes source-visible behavior, not a live deployment verification. There is no measured efficiency/satisfaction outcome, new screenshot session or accessibility certification asserted here.

[UI source](../src/main.jsx), [staff workspaces](../src/StaffWorkspaces.jsx), [customer service](../src/Customers.jsx), [motion](../src/publicMenuMotion.js), [domain](../server/store.js), and [read projection](../server/read-model.js) support the current description.
