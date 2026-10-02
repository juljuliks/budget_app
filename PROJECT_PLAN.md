# Budget App — Project Roadmap

This document outlines the remaining work to finish the privacy-first SMS transaction tracker app. It groups tasks by area, lists concrete deliverables, and suggests priorities and owners.

## Goals
- Parse bank SMS messages on-device, categorize transactions, and surface actionable notifications.
- No server: all data stored locally (SQLite) with export/import options.
- Headless/background SMS handling and notification actions to categorize quickly.

## High Priority (core functionality)
- [x] Replace Kotlin RN stubs with proper React Native Android integration
  - [x] RN 0.71 Gradle config (react-native-gradle-plugin, autolinking, Hermes)
  - [x] `MainActivity` / `MainApplication`, `index.js`, `app.json`, babel/metro configs
  - [x] `./gradlew assembleDebug` succeeds (JDK 17)
- [x] Finish Kotlin BroadcastReceiver + Headless JS
  - [x] `SmsReceiver`: permission check, multipart SMS join, sender filter, `BROADCAST_SMS` guard
  - [x] `SmsHeadlessService` extends the real `HeadlessJsTaskService`
- [x] Port DB layer to React Native
  - `src/db/driver.native.ts` (react-native-quick-sqlite 8.1.0, last version supporting RN 0.71) / `src/db/driver.ts` (better-sqlite3 for Jest & scripts) behind one async `Db` interface
  - Versioned migrations (`src/db/migrations.ts`, `PRAGMA user_version`); `db/schema.sql` removed
  - Pure-JS SHA-256 (`src/hash.ts`) replaces Node `crypto`
  - Shared `ingestSms()` (`src/ingest.ts`) used by headless task and importer; applies merchant rules on arrival
  - [x] `assembleDebug` with quick-sqlite verified (needs NDK 23.1.7779620 + CMake 3.22.1)
- Notifee notifications + action buttons
  - [x] Show top category suggestions in notification
  - [x] "Create new category" action opens the app on the category editor; tapping the body opens the transaction
  - [x] Android shows max 3 action buttons: 2 suggestions + "➕ Новая категория" (always present)
  - [x] Money transfers: notification suggests only transfer-type categories; the in-app picker shows all, transfer ones first
  - [x] Handle action presses in JS and persist assignments (+ exact rule + backfill that keeps manual choices)
- Permissions & device testing
  - [x] Runtime permissions (`RECEIVE_SMS`, `POST_NOTIFICATIONS`) requested on app start (`src/permissions.ts`); `READ_SMS` removed as unused
  - Background/boot behavior and battery optimizations

- Parser coverage (needs real TBC SMS samples, masked)
  - [ ] Declined / refund / cash withdrawal / transfer to a person / purchase in USD — current keywords for these are a best guess
  - [x] Confirm TBC sender IDs: real sender is `TBC SMS` (`SmsReceiver.BANK_SENDERS` also accepts `TBC`, `TBC BANK`)

## Medium Priority (UX & data)
- [x] Transactions UI (React Navigation 6 native-stack)
  - [x] List: all transactions, keyset pagination by 50, day headers, pull-to-refresh, live refresh on new SMS
  - [x] Detail: category chips, "remember for merchant" toggle (rule + backfill), clear category, raw SMS
  - [x] Create category screen (from detail or notification), assigns it to the transaction
  - [x] Category management (gear next to "Категория"): list grouped by type, ✎ edit, 🗑 delete
  - [x] Delete = soft delete: this month's transactions move to a chosen category (rules follow), past months keep the old one
  - [x] Category types ("Хобби: Гитара"), optional; types screen (gear next to "Тип"); "Переводы" is the system transfer type
  - [x] Delete a transaction
  - [ ] Rename applies to all months (ask if past months should keep the old name)
  - [x] Add transaction manually (amount, income/expense, description, today/yesterday, category)
  - [x] Search by SMS text, merchant / description, category and type (Cyrillic case-insensitive, ё = е); edit / delete icons on results
  - [x] Multi-select ("Выбрать несколько") -> bulk change category (existing categories, no merchant rules)
  - [x] Tap a category in Статистика / История -> Transactions with the search prefilled
  - [x] Read state: unread = never opened and uncategorized; blue dot in the list, count badge on the tab
  - [x] Filter modes: По тексту / По категории (categories that have transactions, with counts) / По дате (day or period calendar)
  - [x] "Выбрать все" selects everything shown; "Редактировать" in the tab header; "+" hidden while a filter is active
  - [ ] Combine filters (e.g. category + period)
  - [ ] Edit / delete a manual transaction; arbitrary date picker
- [x] Bottom tabs: Статистика / Транзакции; inside Статистика: Статистика | План | История (see section below)
- Merchant rules UI: create/edit/list and backfill
- Backup/export & import (JSON/CSV via SAF)
- Locale strings (en/ka/ru)
- Category usage analytics (local only) and suggestions

## Budget Planning (Статистика tab: Статистика | План | История) — v2 done
Done:
- Per-month plan (`plan_months`, `plan_items`, migration 3; the old standing plan became pinned items of the current month)
- A new month starts from the latest planned month: 📌 pinned items keep their amount, others come with an empty
  amount (last month's shown as a hint), removed items don't carry over; past months are never auto-created
- Plan can be prepared one month ahead
- Stats: month switcher, donut with total spent in the center, plan / remaining, per-category progress bars,
  grouped by category type with section titles (also in История details)
- История: every month plan vs spent (+ meter), expand -> per category plan vs fact
- Amount to distribute per month (`plan_months.budget_minor`, migration 6; carries over): the plan can't exceed it,
  categories show their share in %, the rest is "Свободно"; amounts are edited via ✎ → input dialog
- Plan item kind (migration 7, carries over): "Лимит" = progress bar that blends green -> amber -> red towards the
  limit; "Статичная трата" (rent, subscriptions) = ✓ "оплачено" once anything is spent in the month
- История: "Сумма / Не распределено / Сохранено" (amount − spent) for months with an amount set
Remaining: tap a category -> its transactions for the month; over-limit notifications; salary-day month start (if needed).

Original spec:
Goal: set a monthly target amount per category and see at a glance which categories are over their limit.

- Navigation: bottom tabs (`@react-navigation/bottom-tabs` 6.x) — "Транзакции" (current stack) and "Бюджет"
- Data (new migration)
  - `budgets (category_id PK, limit_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'GEL')` — one standing monthly limit per category, applies to every month until changed
  - Spent per category for a month = sum of `amount_minor` of expense kinds (`purchase`, `withdrawal`, `transfer`) minus `refund`s, `occurred_at` within the calendar month; `deposit`s excluded
  - Only transactions in the budget currency are counted; others are shown separately as "не учтено: N USD" (no FX conversion offline)
- Budget tab UI
  - Month switcher (← Сентябрь 2026 →), current month by default
  - Summary: total limit / total spent / remaining for the month
  - Per-category rows: emoji + name, progress bar `spent / limit`, remaining or "превышено на X"; colors: normal < 80%, warning 80–100%, over > 100%
  - Sort: over-limit first, then by % used; categories without a limit listed below as "без лимита" with their spend
  - "Без категории" row with its spend, tap → transactions list filtered to uncategorized for that month
  - Tap a category → transactions of that category for the month (reuses the list screen with filters)
- Editing limits: tap the limit → numeric input sheet; "Скопировать лимиты" is not needed since limits are standing
- Notifications (optional, after the tab works): when a new SMS pushes a category past 80% / 100% of its limit, show a notification once per category per month
- Tests: monthly aggregation (month boundaries in local time, refunds, currencies, uncategorized), over-limit sorting

Open questions:
- Budget month = calendar month, or starting from salary day (e.g. the 10th)? Start with calendar month, keep the period start configurable later.
- Should limits be allowed to differ per month (e.g. higher in December)? Start with standing limits; per-month overrides can be a later `budget_overrides` table.

## Telegram Bot (deferred — server on the old laptop, later)
Goal: every bank SMS is parsed and arrives in a Telegram bot; categories, stats and history are managed from the bot.
Decision: the bot runs on a home server (old laptop), not on the phone. Transaction data will live on that server
and in the Telegram chat (not E2E-encrypted) — a conscious exception to the "no server" goal.

- Architecture: `Phone (SmsReceiver → parse) → HTTPS + secret token → Laptop (Node, SQLite, bot) ⇄ Telegram`
- Server (Node/TS, reuse existing code): `parsers/`, `ingest`, `categorize`, `assign`, `db/` with the better-sqlite3 driver, migrations, tests
  - Bot library: grammY; **long polling** (`getUpdates`) instead of a webhook, so the laptop needs no public IP or open ports
  - Access limited to the owner's `chat_id` (whitelist in config); bot token and API token in `.env`, not in git
- Phone → laptop connectivity (laptop is behind home NAT): Tailscale (phone + laptop in one tailnet) — preferred; alternative Cloudflare Tunnel
- Phone app changes: after local parse, POST the transaction to the server; retry queue when offline (WorkManager or a local `outbox` table); idempotent by `sms_hash`
- Bot UX
  - New transaction: "−44.00 GEL · AdamDent LLC" + inline buttons: top-3 categories, "Все категории…", "➕ Новая"; after the choice the message is edited to "✅ Здоровье" and an exact merchant rule is created
  - 📊 Статистика: spend per category for a month, month switcher (later: budget limits / over-limit)
  - 📜 История: paginated transactions, "change category" button per item
  - 🗂 Категории: create, rename, change emoji, archive
- Laptop setup: autostart (systemd/launchd), no sleep on lid close, nightly SQLite backup (`.backup` to another disk/cloud)
- Open question: does Telegram fully replace the phone UI (phone = SMS forwarder only) or do both UIs stay (needs phone↔server sync)? Default: Telegram replaces it.

## Low Priority / Optional
- CI: GitHub Actions for JS tests and Android assemble
- Release APK for personal install (own signing key, JS bundled — works without Metro)
- Crash reporting / opt-in analytics
- Desktop import/export improvements (CSV/Google Sheets)

## Technical Tasks (concrete file-level items)
- [x] `android/settings.gradle` and `android/build.gradle`: verify RN maven/local file repos
- [x] `android/app/build.gradle`: add RN dependency or link via `enableHermes`, `reactNativeHost` as per RN docs
- [x] `android/app/src/main/java/com/budgetapp/sms/*`: finish receivers and services
- [x] `src/native/SmsBackgroundTask.ts`: finalize headless task error handling and Notifee integration
- [x] `src/notifications/notifeeIntegration.ts`: wire action handling to DB calls
- `src/db/*`: [x] migrations, [ ] export/import endpoints
- [x] `README_ANDROID.md`: add device run, permission checklist, and debug tips

## Testing & QA
- Unit tests for parsers (`src/parsers/*.test.ts`) — done
- [x] Integration test: simulate headless JS insertion and notification flow (`__tests__/smsFlow.test.ts`)
- Manual QA checklist for at least 3 Android devices with different OEMs

## Timeline Suggestion (2-week sprints)
- Sprint 1: RN Android integration, fix Kotlin implementation, and ensure `assembleDebug` and `installDebug` work on-device.
- Sprint 2: Notifee actions, headless JS robustness, and UX for assigning categories.
- Sprint 3: Budget planning tab (limits per category, monthly progress, over-limit view), transaction filters.
- Sprint 4: Backup/export, localization, and release APK (signing).
- Later: Telegram bot on the home server (see "Telegram Bot" section) — when the laptop is set up.
