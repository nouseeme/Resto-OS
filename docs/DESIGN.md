---
name: restoOS
description: An ivory editorial menu book for the daily rhythm of restaurant service.
colors:
  primary: "#a43c2d"
  secondary: "#405644"
  danger: "#963629"
  paper: "#f5f1e7"
  surface: "#faf7f0"
  ink: "#2b2923"
  muted: "#686256"
  line: "#dcd5c8"
  placeholder: "#6b6356"
  sidebar: "#eee9df"
  inset: "#ece7dc"
  on-brand: "#fff9f0"
  navigation-active: "#e5ddd0"
  kitchen-header: "#2e3028"
  kitchen-header-muted: "#d6d5c9"
  kitchen-header-hover: "#414338"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "58px"
    fontWeight: 450
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "36px"
    fontWeight: 450
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "25px"
    fontWeight: 450
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  production-headline:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  production-title:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 650
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 450
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  field: "2px"
  control: "3px"
  dialog: "4px"
spacing:
  compact: "8px"
  label: "12px"
  control: "17px"
  panel: "20px"
  section: "22px"
  wide: "38px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
    padding: "10px 17px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
    padding: "10px 17px"
  button-text:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    padding: "0"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  navigation-active:
    backgroundColor: "{colors.navigation-active}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "12px 11px"
  kitchen-ticket:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "20px"
---

# Design system: restoOS

[Index](INDEX.md) · [Product contract](PRODUCT.md) · [UI/UX case study](PORTFOLIO-UIUX-CASE-STUDY.md)

## 1. Direction: The Ivory Menu Book

The visual language comes from a restaurant menu book: ivory paper, charcoal ink, warm thin rules, expressive serif headings and restrained brick red. The customer portal gives photography and browsing more room; staff interfaces prioritize scanning, status and repeated actions.

The frontmatter preserves the documented default tokens. The implementation source is [src/styles.css](../src/styles.css), with runtime restaurant branding applied by the application. Not every CSS value is expressed through a central token; inspect the owning rule before changing a particular component.

## 2. Color and typography

Primary paper/surface colors are `#f5f1e7` and `#faf7f0`; text is `#2b2923`, supporting ink `#686256`, and rules `#dcd5c8`. Brick red `#a43c2d` marks primary actions, selection and focus. Herb green `#405644` supports availability/positive feedback; danger uses `#963629`.

Newsreader supplies editorial page/dish headings and emphasized amounts. Manrope supplies body text, controls, metadata and kitchen production headings. Local variable fonts use swap loading; numeric values use tabular figures. Preserve the division between expressive headings and operational text.

Restaurant settings can change brand/accent colors. Server validation requires sufficiently dark colors for contrast against the designated inset background. This is not a guarantee that every possible brand combination has passed a complete accessibility audit.

## 3. Layout by task

### Workspace chooser

After login, three ruled choices introduce Kitchen, Waiter and Management. The account header shows identity and logout; each choice names its work. A switch-workspace control returns here without another credential prompt. Choice belongs to the session, and every admitted staff account can enter all three.

### Kitchen

A dark station header and horizontal queue/availability navigation lead into a full-width ticket board. Production headings use Manrope. The queue distinguishes “Dimasak” from “Menunggu Diantar.” Menu demand is a sticky side panel on larger screens and an expandable summary above the queue on phones.

Portions and kitchen notes stay close to production actions. Demand groups waiting/accepted versus cooking units and excludes ready/delivered/cancelled units. New orders are accepted immediately; the interface must not promise a required acceptance delay.

### Waiter

Horizontal navigation leads to “Daftar pelanggan,” “Pesanan diantar” and availability. One customer table groups “Order aktif” above “Piutang lama,” sharing headers, search and selection. These are informational section headings, not separate filter tabs.

One “Buat order” action searches an active transaction or creates a new one. Transaction detail leads with outstanding balance and presents each timestamped order directly beneath it. Active transactions permit name editing; payment and delivery stay distinct. Merge uses selection, review and survivor choice.

### Management

A desktop sidebar organizes overview, history, finance, catalog and settings; smaller screens use a drawer. History is read-only. Finance distinguishes sales, receipts, expenses and outstanding debt. Use the existing shared export action rather than adding competing export buttons throughout the page.

Catalog editing is tabular, with image thumbnails and direct comparisons across items. The import dialog presents add/update/error counts and source-row issues before atomic save. Settings group restaurant identity, staff, finance options and audit information.

### Customer portal

A photographic menu supports category selection, search, dish detail and a cart. Larger screens place a sticky cart beside the menu; phones use a fixed cart control opening a review dialog. The normal portal has no staff link and no history/balance/payment display. Demo intentionally adds a separate banner with staff entry and reset.

Two dish columns, matched image ratios and reserved text slots align adjacent entries. Long names/descriptions are clamped in list cards while full content remains available through detail/accessibility text. Missing or failed imagery falls back to a warm text block. Unavailable items use explicit copy as well as subdued imagery.

## 4. Shared components

- Buttons and icon controls generally use 44 px minimum action targets, near-square corners and clear disabled/busy states.
- Fields have visible labels, warm borders, surface fill and a brand focus outline. Search uses focus-within feedback.
- Status combines colored dots with explicit Indonesian text. Do not make color the only explanation.
- Ruled lists/tickets carry most structure. Avoid adding floating-card shadows to ordinary operational rows.
- Dialogs use ivory surfaces, a dimmed backdrop, bounded scrolling, title semantics and keyboard dismissal/focus handling.
- Financial values align for comparison; transaction names and identifiers must wrap rather than widen the page.
- Sonner supplies action feedback. Inline errors remain next to the relevant form when review/recovery is required.

These are implementation conventions; see [modal handling](../src/useModalDismiss.js), [shared UI](../src/main.jsx) and the owning components before extending them.

## 5. Responsive behavior

The design changes composition to preserve task priority rather than simply shrinking every element. Desktop management navigation becomes a drawer; the kitchen demand panel becomes collapsible; transaction detail stacks amounts on narrow screens; spreadsheet previews scroll locally within dialogs.

Portal cart controls reserve space for mobile safe areas and surrounding content. Horizontal category/workspace tabs may scroll. The target range begins at 360 px, but actual touch/audio and device behavior still require testing. Avoid treating a successful build as responsive verification.

Detailed breakpoint values live in CSS and should be inspected there rather than copied into a second exhaustive list that can drift.

## 6. Motion

Customer motion acknowledges actions without delaying data updates. The current code uses a 650 ms category entrance with bounded staggering, 480 ms value feedback, and a 450 ms curved image-to-cart flight. Cart contents update immediately; the flight is visual acknowledgement. Its normal landing feedback uses 600 ms. These values describe current source, not historical tuning notes.

Search and keyboard category interactions remain immediate where implemented. Repeated input retargets/cancels animations rather than building an unbounded queue, and visual flights are capped. Reduced-motion behavior differs between CSS and explicit Web Animations paths: scripted effects use short opacity feedback or skip the flight. Do not claim all motion is literally absent in every path.

Staff motion is restrained because actions repeat frequently. Reference [MenuMotion.jsx](../src/MenuMotion.jsx), [publicMenuMotion.js](../src/publicMenuMotion.js) and CSS for exact behavior.

## 7. Accessibility and verification boundaries

Maintain visible focus, explicit labels, keyboard-operable customer selection, dialog focus restoration, readable states and reduced-motion support. Audio activation is optional user action and cannot be the sole way to discover an order.

No complete WCAG audit or current screenshot/device inspection is claimed by this document. Screen descriptions were checked against source. Real-browser and real-device checks remain necessary for focus, overflow, layout, contrast and motion.

## 8. Contribution rules

Preserve the paper-and-ink hierarchy, typography roles and distinct workspace compositions. Keep documentation in English and preserve actual Indonesian product labels when quoting the UI. Normal public navigation leads to ordering; staff entry remains unlisted. Do not reintroduce customer bill history, delayed acceptance or permanent staff role tiers through design copy.

Use source-backed values and identify proposed changes explicitly. Keep decorative effects subordinate to ordering and repeated service tasks.
