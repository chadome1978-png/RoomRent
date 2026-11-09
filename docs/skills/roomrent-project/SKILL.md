---
name: roomrent-project
description: Project-specific workflow for maintaining and extending RoomRent, a Thai responsive rental-management PWA with account-scoped Supabase storage and a static offline app shell. Use for room/tenant management, bills, PromptPay QR, monthly finance, migration/backups, auth/RLS, tests, or Cloudflare Pages releases.
---

# RoomRent Project Skill

Use this skill for future RoomRent work. Follow the user’s current request and the project’s `plan.md` and `TODO.md`; preserve later user changes and the architecture choices below.

## Product contract

- Keep the app Thai-first, responsive on phones, and in its charcoal-and-pine dark theme. Keep invoice paper white for screen preview and print/PDF.
- Store rooms/tenants, invoices/payment status, expenses, and PromptPay settings in an authenticated Supabase account snapshot when build-time configuration is present. Keep legacy/local records in `localStorage` only until an owner downloads a backup and explicitly confirms migration. Never silently upload or replace Cloud data.
- Keep the app a static PWA at the existing Cloudflare Pages hostname `roomrent-local-pwa.pages.dev`; do not add a container or application API. Cache only the app shell/assets. Cloud data requires a signed-in account and internet access; offline mode must not make unsynced changes look saved.
- Preserve JSON export/import for local and Cloud data. Warn that backup files include personal tenant/payment details and should be stored securely. Preserve local/Cloud records whenever a save, migration, or restore fails.
- Never include local rental records, backup JSON, PromptPay identifiers, credentials, or browser storage dumps in source commits, tests, screenshots, build archives, logs, or diagnostics.

## Business rules to preserve

- Keep room, invoice, PromptPay, and expense validation/defaulting in `client/src/components/roomrent/types.ts`. Keep old version-1 stores/backups readable. Validate a full import before writing; require explicit confirmation before merging into Cloud and stop on ambiguous room/bill/PromptPay conflicts.
- Allow edits to unpaid bills and recalculate their totals while preserving unpaid status. Do not offer edit controls for paid bills.
- Generate PromptPay QR entirely in the browser from the owner-scoped configured recipient ID and the exact unpaid invoice total. Hide the QR for paid bills. QR scanning is not proof of receipt and must never update payment status automatically; the owner confirms payment manually.
- For monthly finance, count only paid bills as income and group them by invoice billing period. Show unpaid balances separately, outside income. Group expenses by their entered transaction date. Define net as paid-bill income minus expenses, and keep the date-basis explanation visible.
- Treat tenant contact details and PromptPay IDs as sensitive. Use invented IDs and synthetic bills in tests; never read production storage, log payloads, or use real accounts as fixtures.
- Keep Supabase publishable/anon key browser-visible only with RLS enforced. Never put service-role/secret keys in `VITE_*`, client source, GitHub Variables, bundle, screenshots, or logs. The snapshot table permits authenticated SELECT under `auth.uid()`; writes go through the revision-checked `save_roomrent_account_data` RPC.

## Project map

- `client/src/components/roomrent/RoomRentApp.tsx` — app navigation, account gate, snapshot state, CRUD, and explicit backup/migration/restore flows.
- `client/src/components/roomrent/types.ts` — local schema, validators, backward-compatible parsing, and Thai date/currency helpers.
- `client/src/components/roomrent/supabaseRooms.ts`, `supabaseAccountData.ts`, `accountMigration.ts` — shared Supabase auth/client, snapshot read/write, and conflict-aware migration from local and legacy rooms.
- `client/src/components/roomrent/SupabaseAccountPanel.tsx` — email/password auth, account setup, backup acknowledgement, and migration confirmation.
- `supabase/roomrent_account_data.sql` — owner-scoped RLS, select-only table grants, 1 MiB limit, and revision-checked save RPC. `supabase/rental_rooms.sql` is legacy room storage retained for migration.
- `client/src/components/roomrent/RoomDialog.tsx`, `InvoicePreview.tsx`, `PromptPayQr.tsx`, `PromptPaySettingsDialog.tsx` — room, bill, and payment flows.
- `client/src/components/roomrent/FinanceDashboard.tsx`, `ExpenseDialog.tsx`, `finance.ts` — monthly summary, expense entry, and pure finance calculations.
- `client/src/components/roomrent/*.test.ts` — pure tests for PromptPay, local data, and finance logic.
- `client/src/index.css` — dark UI and print styling.
- `client/public/manifest.webmanifest`, `sw.js`, PWA icons, `manus-routes.json` — install/offline assets and page-route declaration.
- `plan.md` and `TODO.md` — implementation/design decisions and explicit product outcomes.

## Workflow

1. **Orient:** Inspect `plan.md`, `TODO.md`, relevant source, diagnostics registration, `git status`, and the currently selected architecture before changing files. Continue the initialized project; do not reinitialize or discard unrelated work.
2. **Translate the request:** Update the existing plan only when assumptions/design change. Add complete user-facing behavior criteria to `TODO.md` before implementation. Make reasonable low-risk UI decisions without asking repetitive questions; ask only when a required business rule or irreversible action is unclear.
3. **Implement locally:** Use Supabase only as the user-authorized owner-scoped storage for account records; never send tenant/payment data to analytics, QR/image/LLM services, or logs. Keep local/legacy-to-Cloud migration explicit and backup-first. Roll back optimistic UI changes when snapshot writes fail. Keep static assets bundled; offline works for the app shell only. Maintain accessible forms, useful empty states, readable charts, keyboard use, and mobile touch targets.
4. **Test safely:** Add pure tests for new calculation/validation logic. Use synthetic records only. If visual checks need data, seed disposable data only on an isolated Preview origin and clear it after review; never inspect or modify the user’s production browser storage.
5. **Run project checks** from `/home/ubuntu/roomrent`:

   ```sh
   pnpm check
   pnpm test
   pnpm build:static
   node --check client/public/sw.js
   git diff --check
   ```

   When front-end assets change, increment the cache name in `client/public/sw.js` so installed PWA copies can fetch the new shell after their next online visit. Keep the static output in `dist/public`.

## Static-only checkpoint and release

- Do not interpret the missing Webdev `deploy` configuration as a reason to add a container; the project is intentionally static-only. Do not call Webdev `POST publish` for the current architecture.
- Build Supabase browser configuration only from `VITE_SUPABASE_URL` and a publishable/anon key. For GitHub Actions, use repository Variables; these values are public in the generated bundle. Never use a Supabase secret/service-role key in the frontend.
- A push to `main` in the GitHub repository runs `.github/workflows/deploy-cloudflare-pages.yml` and deploys Production. Treat such a push as a live release: require explicit user authorization, confirm the Supabase SQL schema/RLS is installed first, and do not publish a build that would strand existing local data behind an unconfigured migration flow.
- Before pushing a source checkpoint, read the actual current Auto Publish setting. If it is still enabled, stop and ask the user to disable it through the Manus dashboard before pushing; do not change it yourself, add `deploy`, or assume a chat confirmation changed the stored setting. If it still reads enabled after the user says it is off, report the mismatch once, re-check safely, and do not perform another blind push.
- When checkpointing is safe, fetch `origin/main`, preserve and integrate concurrent changes, run the checks above, commit only intended source/docs, push to canonical `main`, and confirm the recorded checkpoint. Never force-push.
- Publish the static site to Cloudflare Pages only when the user requests or clearly authorizes a live release. Use the existing project `roomrent-local-pwa` and its Dashboard Direct Upload flow. Wait until every file has uploaded before deploying to Production, then verify the success result and HTTPS app assets.
- Build archives only from `dist/public`. Exclude `api/platform/config.js`, platform/debug placeholders, hidden files, environment files, local records, and backup data. Never upload the source tree.
- Do not include a custom domain or server/container cost in the release plan unless the user explicitly requests a change from the accepted free `pages.dev` static hosting.
