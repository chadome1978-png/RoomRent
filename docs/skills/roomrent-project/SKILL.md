---
name: roomrent-project
description: Project-specific guidance for building, maintaining, and releasing the RoomRent monthly-rental PWA. Use whenever changing its rooms, tenants, bills, PromptPay QR, monthly finance reports, local backups, offline behavior, UI, tests, or static hosting.
---

# RoomRent Project Skill

Use these instructions for work in the RoomRent application. Treat the current request and the project’s `plan.md` and `TODO.md` as authoritative; preserve later user changes.

## Product and non-negotiable constraints

- Keep the product Thai-first, mobile-responsive, and in its existing charcoal-and-pine dark theme.
- Keep RoomRent a **single-device, local-first PWA**. After the first HTTPS visit/install, its app shell should work offline. Rental data belongs in browser `localStorage` under `roomrent-local-data-v1`; it does not sync across devices or to a cloud account.
- Keep delivery **static-only** on the existing free Cloudflare Pages hostname `roomrent-local-pwa.pages.dev`. Do not add a container, application server, custom domain, authentication, remote database, cloud sync, or analytics unless the user explicitly changes the architecture.
- Explain that clearing browser/site data or using a different device/browser can make local records unavailable. Encourage a JSON backup before device or browser changes.
- Do not read, log, upload, or include a user’s local records, PromptPay settings, or backup files in test data, repository commits, build archives, screenshots, or diagnostics.

## Business rules

- Keep room and invoice records, PromptPay settings, and expenses in the versioned `LocalDatabase` parser in `client/src/components/roomrent/types.ts`. Preserve backward compatibility: missing optional fields in an older store or backup must receive safe defaults rather than erasing rooms or bills.
- An unpaid bill can be edited; recalculate its total and replace that bill while retaining its unpaid status. Do not offer editing for paid bills.
- Generate PromptPay QR payloads in the browser from the locally configured PromptPay ID and the exact unpaid invoice total. Keep QR generation offline-capable. Show the QR on an unpaid bill only; hide it after the bill is marked paid. Scanning a QR does not verify receipt or change payment status—payment confirmation remains a manual owner action.
- For the monthly finance screen, count only paid invoices as income and group them by the invoice’s billing period. Show unpaid bills separately as pending, not income. Group expenses by their recorded transaction date. Calculate net as paid-bill income minus expenses, and keep the on-screen note explaining these date semantics.
- Keep expense categories aligned with `finance.ts`. Expense CRUD must update local state and storage; backup import must preserve existing records and merge rather than silently clearing the current store.
- Treat a PromptPay ID as sensitive even though it stays local. Use invented IDs and synthetic invoices for tests; never use the owner’s real payment account as a fixture.

## Project map

- `client/src/components/roomrent/RoomRentApp.tsx` — top-level navigation, local state, invoice and expense actions, backup/restore wiring.
- `client/src/components/roomrent/types.ts` — local schema, runtime validation, backward-compatible parsing, Thai date/currency helpers.
- `client/src/components/roomrent/RoomDialog.tsx`, `InvoicePreview.tsx`, `PromptPayQr.tsx`, and `PromptPaySettingsDialog.tsx` — room forms, bills, and payment QR settings/display.
- `client/src/components/roomrent/FinanceDashboard.tsx`, `ExpenseDialog.tsx`, and `finance.ts` — monthly cash-flow UI, expense entry, and pure calculation helpers.
- `client/src/components/roomrent/*.test.ts` — local unit tests for payment payloads, data rules, and finance calculations.
- `client/src/index.css` — application and print styling; preserve the white invoice sheet for paper/PDF while keeping the app chrome dark.
- `client/public/manifest.webmanifest`, `sw.js`, PWA icons, and `manus-routes.json` — install metadata, offline shell, assets, and declared page routes.
- `plan.md` and `TODO.md` — design/architecture decisions and complete behavior criteria; update them when scope changes.

## Change workflow

1. Inspect `plan.md`, `TODO.md`, current source, and `git status` before editing. Continue the initialized project; do not reinitialize it, discard uncommitted work, or overwrite unrelated changes.
2. For new stored fields, update the types, validation/defaulting, persistence, and backup merge path together. Validate imported JSON before applying it. Do not introduce network calls for user data.
3. For screens, follow the existing dark visual language and responsive components. Keep touch targets usable on narrow phones, chart labels readable, empty states helpful, and forms keyboard accessible. Prefer existing dependencies and keep all needed runtime code bundled for offline use.
4. Add pure unit tests for calculation or validation changes. Keep test fixtures synthetic and isolated; never seed or inspect production browser storage.
5. Before completion, run from the project root:

   ```sh
   pnpm check
   pnpm test
   pnpm build:static
   node --check client/public/sw.js
   git diff --check
   ```

   When frontend assets change, advance the service-worker cache name in `client/public/sw.js` so installed copies can fetch the new shell on their next online visit. If visual review is needed, use `pnpm dev:static` and disposable data only on the isolated Preview origin; remove those fixtures afterwards.

## Static release rules

- Keep the build output at `dist/public` using `pnpm build:static`; this app is intentionally not a Manus container deployment. A missing Webdev `deploy` declaration is expected under this architecture.
- Before a source push/checkpoint, inspect the current Manus publishing setting. If Auto Publish is still enabled, stop and ask the user to turn it off in the Manus project dashboard; do not add a `deploy` block or trigger an invalid container publish to work around it.
- Release the public app through the existing, user-approved Cloudflare Pages project `roomrent-local-pwa`, using its static upload flow only when publication is in scope. Wait for every asset upload to complete, choose Production only for an approved live update, and verify the success result and required public assets afterwards.
- Build the upload archive only from `dist/public`. Exclude `api/platform/config.js`, platform/debug placeholders, hidden files, and all local user data or backups. Do not upload from the source tree or include `.env`, credentials, local storage dumps, or payment identifiers.
- Never call Webdev `POST publish` for this project unless the user explicitly changes it to a server/container deployment. A static Pages release is separate from the Manus Webdev publish pipeline.
