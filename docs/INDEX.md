# restoOS documentation

## Reading guide

This documentation explains the product, system design, data model, infrastructure, and operating practices. Read the product overview first, then follow the technical sections relevant to your work.

| Document | Contents | Audience |
| --- | --- | --- |
| [01 — Product and workflows](01-PRODUCT-AND-WORKFLOWS.md) | Purpose, users, terminology, service lifecycle, capabilities and limits | New readers, product and restaurant operations |
| [02 — System design](02-SYSTEM-DESIGN.md) | Architecture, module boundaries, read/write paths, concurrency and synchronization | Developers and technical reviewers |
| [03 — Data model](03-DATA-MODEL.md) | Entities, relationships, fields, physical storage, invariants and financial calculations | Backend developers and data/integration work |
| [04 — Infrastructure and alternatives](04-INFRASTRUCTURE-AND-ALTERNATIVES.md) | Configured stack, environment variables, hosting/database alternatives and migration work | Deployment owners and architecture planning |
| [05 — Security, operations and development](05-SECURITY-OPERATIONS-AND-DEVELOPMENT.md) | Authentication, authorization, setup, backup, recovery, verification and scaling limits | Maintainers and operators |

## Documentation language

All project documentation must be written and maintained in English. This applies to existing documentation and future additions, not only this guide. Preserve actual API identifiers, paths, spreadsheet column names, and quoted Indonesian interface labels where readers need to match the application. The application's Indonesian interface is a separate product decision.

## Relationship to existing documents

- [PRODUCT.md](PRODUCT.md) is the concise product behavior contract.
- [DESIGN.md](DESIGN.md) defines visual tokens and interface conventions.
- [Security and operations](05-SECURITY-OPERATIONS-AND-DEVELOPMENT.md) contains the consolidated deployment runbook, backup/recovery guidance and verification tools. It replaces the former production guide.
- [UI/UX case study](PORTFOLIO-UIUX-CASE-STUDY.md) explains design decisions and portfolio presentation.
- [Asset credits](ASSET-CREDITS.md) records font licenses and photography sources.

Only README remains at the repository root. Project documentation and its navigation live in this folder; font binaries and their original license files remain with the public assets.

## Evidence and verification boundaries

Written against the repository working tree on **28 October 2026**. “Current” means implemented or configured in that source tree. It does not prove that the same revision, migrations, credentials, or configuration are live on the public deployment.

Provider accounts, live production records, billing, availability and deployed migration history were not inspected for this documentation. Examples are illustrative. Infrastructure alternatives are migration designs, not implemented integrations. Provider prices, quotas and service guarantees are intentionally not treated as fixed facts.

Source links point to owning files so readers can investigate drift. Obsolete acceptance-timer, customer-bill, full-read-snapshot and no-demo claims have been removed from the maintained guides. Historical audit/import reports are not part of the maintained documentation set. The code and migration sequence should still be checked before operational decisions.

## Verification for this documentation update

The local suite passed all 34 tests on Node 24 after allowing its temporary loopback HTTP servers. The production frontend build passed, with existing bundle-size and dependency-directive warnings. Local documentation links and the README-only root layout were checked. No live provider integration checks, deployment, screenshot audit or production data changes were performed.
