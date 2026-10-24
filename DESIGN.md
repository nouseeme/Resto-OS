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

# Design System: restoOS

## Overview

**Creative North Star: "The Ivory Menu Book"**

The restaurant's menu book supplies the material language: ivory paper, charcoal ink, fine warm rules, expressive serif headings, and restrained brick red. Three distinct staff workspaces apply that language to their tasks: a full-width kitchen production board, a horizontal waiter service workflow, and a management report sidebar. A shared role chooser introduces these spaces after login. The customer portal opens it into a photographic menu with more generous editorial headings.

This is a source-first record of the implemented Operate-mode app, extracted from `PRODUCT.md`, `src/styles.css`, `src/StaffWorkspaces.jsx`, `src/main.jsx`, `src/TransactionPanels.jsx`, `src/ManagementOverview.jsx`, `src/CreateOrder.jsx`, and `src/MenuImport.jsx`. The transaction, kitchen-demand, reporting, and Excel-import extension continues this incumbent world. The PRD's menu-book direction informs the world; no approved image composition is claimed. The frontmatter records the default implementation tokens. Restaurant settings can override primary and secondary CSS variables at runtime, so those two values are defaults rather than immutable restaurant identity colors.

**Key Characteristics:**

- Ivory surfaces and thin warm dividers.
- Newsreader editorial headings paired with Manrope controls, supporting copy, and kitchen production headings.
- Restrained brick-red actions and explicit service status labels.
- Compact staff workflows and a photographic customer menu.

## Colors

The palette feels like warm paper and printed ink, with color reserved for action and service state. Token values in the frontmatter are normative; names below explain their application.

### Primary

- **Printed Brick Red** (`primary`): primary buttons, selected navigation text, active tab rules, focus outlines, caret, and brand mark.
- **Warm White Ink** (`on-brand`): text on primary actions, including the mobile cart bar.

### Secondary

- **Herb Green** (`secondary`): connected/live indicators, checked availability switches, and positive accents.
- **Cancellation Red** (`danger`): destructive text and cancelled service state. Ready and delivered statuses also have their own literal green text/dot treatments; cooking uses amber.

### Neutral

- **Ivory Paper** (`paper`): application canvas and dialog background.
- **Fresh Page** (`surface`): fields, secondary buttons, kitchen and delivery tickets.
- **Charcoal Ink** (`ink`): primary copy and strong section rules.
- **Warm Gray Ink** (`muted`): supporting descriptions, timestamps, and metadata.
- **Warm Rule** (`line`): table separators, borders, tabs, and page divisions.
- **Placeholder Ink** (`placeholder`): input and search hints at full opacity.
- **Bound Paper** (`sidebar`): fixed management navigation and waiter header surface.
- **Inset Paper** (`inset`): service-flow summary and customer cart panel.
- **Selected Paper** (`navigation-active`): active management sidebar destination.
- **Station Charcoal** (`kitchen-header`): dark kitchen station header, with Fresh Page text.
- **Station Supporting Ink** (`kitchen-header-muted`): restaurant and account metadata on the dark header.
- **Station Hover** (`kitchen-header-hover`): kitchen header icon-button hover feedback.

**The Restrained Accent Rule.** Use the primary accent for action, focus, and selection; retain paper and ink for the main reading surface.

## Typography

**Display Font:** Newsreader, with Georgia and serif fallbacks.
**Body Font:** Manrope, with Arial and sans-serif fallbacks. Local variable font files cover weights 200–800 with swap loading.

Newsreader provides the menu-book voice; Manrope keeps dense interface text precise. Numbers use tabular figures throughout. The frontmatter records default desktop roles; individual surfaces use the observed variations below.

### Hierarchy

- **Display:** portal introduction, with desktop default defined above; grows to (68px) at the wide portal breakpoint and reduces through (51px), (46px), (45px), and (40px) at narrower widths. Login story uses (56px), line height (1.15), before responsive reductions.
- **Headline:** management and waiter page titles use Newsreader; responsive overrides range from (28px) to (31px). Kitchen production titles use Manrope (36px, weight 600), reducing to (28px) on phones. The role chooser uses Newsreader (49px), reducing to (37px) on phones.
- **Title:** section headings use the title role; dish titles use (29px) on desktop, kitchen production customer headings use Manrope (24px, weight 650), dialogs (29px), and small headings (22px).
- **Body:** the global default is defined above; working copy is frequently (11–13px), with supporting metadata (9–12px) and some compact labels (8px) at the smallest breakpoint.
- **Label:** buttons use the label role; tabs and navigation use contextual (10–12px) sizes. Wordmark metadata alone uses small uppercase lettering and wide tracking.
- **Numeric emphasis:** Newsreader metrics use (35px) by default; payment totals rise to (45px). Prices retain IDR formatting without fractional digits.

**The Two Voices Rule.** Keep editorial headings and emphasized totals in Newsreader; use Manrope for controls, status, operational detail, and kitchen production headings.

## Layout

The role chooser is an ivory page with a ruled account header (1280px maximum width) and a centered main area (1120px maximum width). Its three equal workspace choices share top and bottom rules, vertical dividers, outlined icons, serif names, concise task summaries, and bottom-aligned entry actions. Desktop page padding is (30px 48px), with an (80px) main top margin. Every authenticated staff member can choose Dapur, Garson, or Manajemen; these are session workspace contexts, not permanent account types.

Dapur uses the full width without a sidebar: a dark station header, horizontal Antrean dapur / Ketersediaan tabs, and a production canvas (1920px maximum width, 29px 36px 20px padding). Tickets auto-fill from (300px), with Manrope production headings and (22px) ticket padding. The queue shares a grid with a (290px) sticky kitchen-demand panel, separated by (25px); the panel sticks (20px) from the top. Garson uses a paper service header, horizontal Pelanggan & Order / Siap Diantar / Ketersediaan tabs, and a row of active-transaction, ready-unit, and running-order counters. Its content and counters center within (1300px), with (36px) horizontal padding and generous ruled customer rows.

Manajemen retains the fixed left sidebar (240px), matching workspace offset, and ruled top bar (76px). Its destinations are Ringkasan bisnis, Arsip transaksi, Katalog menu, and Pengaturan. Main content has desktop padding (39px 38px 16px) and a maximum width (1660px). The summary begins with four ruled metrics, then a two-column ledger and service-flow layout. Settings use two columns within (1050px). Transaction history is read-only; operational service work belongs in the other workspaces.
The portal is centered within (1600px), with horizontal padding (55px), a menu plus (320px) cart column, and a (40px) gap. Menu dishes use two columns and wide cropped photos. The cart is sticky (20px) from the top. The recurring spacing is contextual rather than a strict arithmetic scale: compact control gaps, medium panel padding, and larger section separations.

- At **max-width 1200px**, the management sidebar becomes (210px); management content padding narrows to (26px) horizontally and the portal cart to (290px).
- At **max-width 1000px**, the management sidebar becomes (190px), overview metrics become two columns, ledger/service content stacks, and settings and delivery become one column. The chooser narrows to (30px) horizontal padding and (55px) main top margin; its three columns remain. Kitchen and waiter headers/canvases narrow to (25px) horizontal padding, and kitchen tickets auto-fill from (280px). At 768–1000px the portal keeps two dish columns beside its cart, square photos, and a stacked price/button footer in each dish.
- At **max-width 767px**, management navigation becomes an off-canvas (250px) drawer with a scrim and menu button. Selecting a destination closes it. The workspace loses its sidebar offset; the top bar becomes (65px), with (22px) horizontal content padding. Order-form fields stack. The chooser becomes a single column of ruled choices with icons beside their copy. Kitchen and waiter retain horizontally scrolling tabs, use (18px) horizontal padding, truncate compact account metadata, and hide the station/service annotations. Kitchen tickets become one column with (18px) padding; production actions remain side by side with minimum (44px) height. Waiter counters retain three columns with labels beneath their values. Portal content becomes one column, with two dish columns; the inline cart hides and a fixed cart action opens the cart dialog. The existing bill summary remains in the portal content. The cart bar accounts for the safe-area inset and the footer reserves bottom space.
- At **768–850px**, portal-specific adjustments use a (265px) cart and (27px) horizontal padding; cart notes wrap beneath quantity controls.
- At **max-width 380px**, staff and portal horizontal content padding reduces to (17px), tables tighten, and typography scales down while quantity targets retain their width.
- At **min-width 1600px**, the portal hero grows, cart width becomes (350px), and its main grid gap becomes (55px).

Category, workspace, kitchen, and settings tabs can scroll horizontally. The menu column explicitly allows shrinking to prevent categories from widening the page. Long customer names, order identifiers, and bill names wrap.

At **768–1100px**, the kitchen-demand column narrows to (240px), its padding becomes (16px), and its grid gap becomes (20px). At **max-width 767px**, a native collapsible summary replaces the side panel above the production queue; its summary target is at least (52px) tall. Excel previews retain a (530px) minimum-width table inside a local scrolling area capped at (300px) height, with sticky column headings. The surrounding dialog remains within the viewport.

## Elevation & Depth

The system is flat by default. Paper tones, thin borders, section rules, and layout grouping convey hierarchy. Dialogs sit above a translucent charcoal backdrop; the mobile sidebar uses a lighter scrim. The only authored box shadow is under the mobile cart action (`0 5px 18px #38292026`), which separates the fixed control from scrolling content. Do not generalize that shadow to operational panels.

## Shapes

Controls have nearly square, gently softened corners; the small radius tokens are defined above. Kitchen tickets, catalogue rows, photographic dishes, and cart panels keep straight edges. Dividers and field borders are (1px). Circular avatars, live dots, and the pill-shaped availability switch are the recurring rounded exceptions. Icons are thin outlined Lucide symbols; the small restaurant serving-mark is an inline stroke illustration.

## Components

### Buttons

Refined, compact, and direct. Primary actions use brick red with warm white text. Secondary controls use the fresh-page surface and a warm border. Both have minimum height (44px), an (8px) icon gap, and the shared control radius. Hover changes background over (140ms); primary hover darkens through brightness. Text actions use accent ink and underline on hover. Icon buttons and quantity controls are (44px) square. Disabled buttons use opacity (.48) and a not-allowed cursor.

### Cards / Containers

Kitchen and delivery tickets use ruled fresh-page surfaces. Kitchen production tickets use (22px) desktop padding; delivery tickets use (20px). Both use (18px) on mobile. Their headings identify the customer and order; individual units remain separate ruled rows with status and action beside each other. Service summaries and the portal cart use inset paper; the cart adds a thin border. Customer ledgers, menu catalogues, and bills remain lists with separators.

### Inputs / Fields

Fields use visible Manrope labels, fresh-page fill, warm borders, and the field radius. Standard form fields have minimum height (46px); search controls have minimum height (44px). Placeholder ink stays at full opacity. Focus-visible outlines use the primary accent (2px) with (3px) offset; search also receives a focus-within outline. Form errors combine red text, pale warm-red background, border, and explicit message. The availability switch has a (33px by 20px) track inside a label with minimum height (44px).

### Navigation

Management destinations are icon-and-text sidebar rows with minimum height (46px). Default text is warm gray, hover adds a paper tint, and the active destination uses selected paper, accent text, and heavier weight. Kitchen and waiter instead use horizontal icon-and-text workspace tabs with minimum height (57px), reducing to (55px) on phones. Selection uses darker ink, heavier weight, and a (2px) brick-red underline. A bordered count beside Siap Diantar communicates ready units. Category and settings tabs retain their underlined treatment.

Dapur exposes production actions, sound activation, ordering pause, and compact availability. Garson exposes customer/order service, delivery, payments, and compact availability. Manajemen exposes reports, read-only transaction history, catalogue editing, and restaurant/staff settings; staff switch workspaces for operational actions. Each workspace places a (44px) switch-role icon beside logout in its account area.

### Role chooser

Every login opens the three workspace choices. Refresh retains the selected workspace for that login session; the switch-role icon resets the session choice and returns to the chooser without another credential prompt. A session without a role receives no operational data or actions. The chooser shows the staff identity, restaurant name, and logout; workspace choices are task entry buttons, not account permissions. Their paper hover, visible focus, and ruled layout match the incumbent controls.
### Status and service ledger

Statuses pair a colored dot with explicit Indonesian text: Menunggu, Diterima, Dimasak, Siap diantar, Diantar, and Dibatalkan. Waiting and accepted use neutral styling; cooking uses amber; ready/delivered use green; cancelled uses danger red. Financial amounts align right. The ledger uses customer initials, wrapping names, transaction opening times, order counts, and outstanding totals.

### Transactions and order creation

**Transaksi** is the canonical customer grouping previously called Tab; **Pesanan** is one timestamped submission within it. Orders belong directly to the transaction, without order sessions or time-gap grouping. Login and workspace sessions retain their separate meaning. A transaction closes only after both its financial and operational obligations finish.

Garson enters creation through one **Buat order** action. Its labeled customer combobox searches active transactions, supports arrow keys, Enter and Escape, and shows a new-transaction option only when no active name matches. Choosing a name reveals the menu and cart; the chosen transaction remains explicit and can be changed. The dropdown is a ruled fresh-page list with a (245px) scrolling maximum and (62px) minimum option height.

Transaction detail opens in the wide ivory dialog. Total outstanding balance leads; each directly nested order shows its own date, time, identifier, total, amount paid, and remaining balance. A (44px) edit icon sits beside the customer title for active transactions in Garson, opening an inline rename form. Payment history follows the unit rows. Management uses the same detail as a read-only view. Order sections use ink top rules, (25px) serif headings, and right-aligned (26px) serif balances, reducing to (24px) on phones; paid and outstanding summaries stack on phones.

### Kitchen demand and management reporting

The inset-paper kitchen-demand summary groups outstanding menu units into **Belum mulai** (waiting plus accepted) and **Dimasak** columns. It includes submissions waiting for acceptance, excludes ready, delivered and cancelled units, and repeats the total pending count in its heading. Desktop/tablet keep the sticky side panel; phones use **Perlu dimasak** above the queue, closed until expanded. This summary remains informational; production actions stay on tickets.

Management's **Transaksi belum selesai** includes paid transactions whose operational work remains unfinished. **Pilihan pelanggan** counts ordered portions minus cancelled portions across all payment states within the selected order period. Active balances and unfinished transactions describe the current state; order value and payments follow their event periods. Keep this distinction explicit in labels and supporting copy.

### Excel catalogue import

The catalogue provides a downloadable Excel template and an **Impor menu dari Excel** dialog. File selection accepts .xlsx up to (500 KB), with up to (1,000) menu rows. The preview shows file name, create/update/error counts, source row numbers, menu names, prices, availability, and intended changes. Existing names update entries; new names add entries. Validation problems identify their rows and explicitly say nothing has been saved; commit errors remain visible in the dialog. **Simpan impor** is disabled while processing, offline, before preview, or when validation errors exist. The complete file is validated before an atomic save; historic order prices remain intact. Menu photo upload stays visibly deferred until Supabase Storage is connected, and photos are not imported from Excel.

### Customer menu and photography

The portal pairs food photography with serif dish names, category, short description, price, and a clear add action. Photos use cover cropping: default aspect ratio (1.5), and (1.05) on mobile and 768–1000px tablets. Titles reserve two lines and descriptions reserve three, with longer copy clamped. Each row's photo, price, and Add-button positions match even when copy lengths differ. The staff catalogue uses smaller square/portrait thumbnails. Unavailable photos become translucent and mostly grayscale; the button explicitly reads “Habis.” Missing or failed photos fall back to the dish name on a warm neutral block. Current catalogue photography is example content and is explicitly disclosed in both menu and portal copy.

### Dialogs, feedback, and accessibility

Dialogs use ivory paper, the dialog radius, a ruled heading, and widths (490px) or (780px) for wide detail. They scroll within (90dvh), switch to a viewport-relative mobile maximum, lock body scroll, support Escape dismissal, wrap keyboard focus among enabled controls, and restore prior focus on close. They carry dialog semantics, modal state, and a title label.

Form labels and icon-button accessible names identify actions. Service state always includes words. Connection failure shows an explicit warning and disables changes; empty states pair an outlined icon, serif title, and explanatory copy. Sonner provides success/error feedback and close controls. Busy indicators rotate over (900ms); reduced-motion preference removes transitions and animations. The mobile drawer movement uses (180ms ease-out), and the availability thumb uses (150ms). These are observed behaviors, not a claim of a complete accessibility audit.

## Do's and Don'ts

### Do:

- **Do** keep ivory paper, charcoal ink, and warm rules as the main reading structure.
- **Do** preserve the Newsreader and Manrope role split.
- **Do** pair service colors with explicit Indonesian labels.
- **Do** preserve the implemented 44px action targets and visible keyboard focus.
- **Do** keep example catalogue photography clearly disclosed and provide the existing text fallback.
- **Do** preserve the three distinct workspace compositions and keep session workspace selection separate from staff identity.
- **Do** keep the public entry at `/portal`, with `/` redirecting there. Staff login and workspace live at the unlisted `/ruang-staf`; never link them from public navigation.
- **Do** use two equal menu columns on phones, tablets, and laptops. Each row uses matching image ratios, two-line title slots and three-line description slots with overflow clamped. Full menu names remain in image alt text, control labels, and title attributes. Bottom-aligned price/button grids must line up across neighboring dishes. At 768–1000px and on phones, stack each price above its full-width 44px Add button.

### Don't:

- **Don't** turn every ledger row into a floating card or spread the mobile cart shadow to ordinary panels.
- **Don't** use accent color as a replacement for readable labels or status text.
- **Don't** present sample photography as confirmed restaurant catalogue assets.
- **Don't** erase wrapping, horizontal tab scrolling, or mobile cart access when extending the layout.
