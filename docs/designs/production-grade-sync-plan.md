# Expense Tracker — Production-Grade Gmail/HDFC Sync

## Context

Personal (solo-user) expense tracker syncing HDFC bank alert emails via Gmail
API into a Postgres/Prisma-backed Next.js app. Currently unreliable: sync may
fetch zero emails (sender domain mismatch), never backfills history (hardcoded
1-day/3-page cap), and several pipeline stages (parsing, dedup, categorization)
have correctness gaps that fail silently. Currently tracked manually in Excel;
user wants to fully replace that.

Scope: HDFC only. Solo user — no multi-tenant/admin features. Correctness,
reliability, and security hygiene, not SaaS polish.

## Current State (verified this session)

- Sender confirmed via real email: `alerts@hdfcbank.bank.in`. Matches
  `src/lib/gmail.ts:74`'s search query and is present in
  `email-detector.ts`'s domain list — **already correct**, contrary to the
  earlier assumption; needs a regression test, not a fix.
- **NEW, confirmed against real samples — reference/UTR extraction is broken.**
  `extractReferences` (`parser.ts:118-134`) regex
  `/(?:ref(?:erence)?|txn|transaction)\s*(?:no|number|id|#)?[\s:]*([A-Z0-9]{6,})/gi`
  against `"UPI transaction reference no.: 489172985779"`: the case-insensitive
  flag makes `[A-Z0-9]` match lowercase letters, so the regex matches at
  "transaction" and greedily captures the word **"reference"** itself (9
  letters, satisfies `{6,}`) instead of continuing to the actual 12-digit
  number. Result: `referenceNumber` = `"reference"` (garbage), and since
  that's <12 chars, `utr` = `null` too. **This silently disables exact
  reference/UTR match — the highest-confidence dedup signal (+50 score) never
  fires for any real transaction.** Highest priority parser fix.
- **NEW, confirmed — date extraction fails entirely for the real template.**
  HDFC alerts use `"on 26-09-26"` (DD-MM-**YY**, 2-digit year); every pattern
  in `extractDates` (`parser.ts:55-99`) requires a 4-digit year. No pattern
  matches, `transactionDate` is `null` for every real email, and
  `ingestion.ts:386` silently falls back to `new Date()` (today) — every
  transaction gets today's date instead of its real date.
- **NEW, confirmed — merchant extraction never fires for real HDFC UPI
  alerts.** None of the 4 patterns in `extractMerchantName` (`parser.ts:226-247`)
  match `"towards VPA <upi-id> (<Name>)"` — the real, reliable merchant name
  sits in parens (e.g. `(VIPIN KUMAR)`, `(McDonalds Hardcastle Restaurants)`)
  and is currently never captured.
- **NEW, confirmed — UPI handle whitelist gap.** `extractUpiId` (`parser.ts:152-182`)
  doesn't recognize `@yesbankltd` (seen in a real sample) — no substring in
  the whitelist matches it, so a legitimate UPI ID is silently dropped.
- Amount extraction (`parser.ts:282`, `amounts[0]`) verified correct for real
  UPI debit alerts — exactly one `Rs.X.XX` per email in all 3 samples, no
  balance-vs-debited ambiguity for this alert type. Lower priority than
  originally assumed; keep as defensive hardening only, not urgent.
- `processGmailImport` (`src/lib/ingestion.ts:73,80`): `MAX_PAGES = 3`, query
  capped to `after:1-day` — never backfills.
- `processIncrementalSync` (`src/lib/ingestion.ts:144-233`): no catch around
  `getHistoryChanges`; Gmail expires `historyId` after ~7 days with a 404,
  unhandled.
- No lock between manual (`/api/gmail/sync` POST) and cron (`/api/cron/sync`)
  sync for the same user.
- `gmail/callback/route.ts:42` and `connect/route.ts` don't guard against
  Google omitting `refresh_token` on repeat consent.
- `parser.ts:282`: `amounts[0]` picked blindly as the transaction amount.
- `parser.ts:226-247`: merchant regex covers 4 phrasings only.
- `ingestion.ts:412`: review triggered only below 0.5 confidence.
- `deduplication.ts` `AUTO_MERGE_THRESHOLD=90`: same amount + ±3 day window
  can false-positive.
- `learnFromUserChoice` (`categorizer.ts:390`) is defined but called from
  nowhere in the codebase (verified via grep).
- `/api/subscriptions/route.ts`: GET/POST only, no detection logic.
- No merchant rename/alias-creation endpoint; `PATCH /api/transactions/[id]`
  only reassigns to an existing `merchantId`.
- `/api/setup/route.ts`: raw SQL schema migration gated by plain `===` secret
  comparison, exempted in `middleware.ts:8`. No `prisma/migrations/` directory
  exists; `package.json` already has `db:migrate: "prisma migrate deploy"`
  scripted but unused.
- `budgets/route.ts:15-46` `getPeriodRange`: ignores the budget's `startDate`
  for MONTHLY/default — always uses current calendar month.
- Analytics/budgets correctly filter `isExcluded: false` and restrict spend to
  `EXPENSE`/`FEE` types — confirmed correct, do not touch.
- Tests exist for `parser`, `categorizer`, `deduplication`,
  `merchant-normalizer`, `email-detector`. None for `ingestion.ts`, `gmail.ts`,
  or any API route.

## Proposed Change

Fix the sync pipeline end-to-end for correctness and reliability, close the
silent-failure gaps, replace the raw-SQL migration backdoor with real Prisma
migrations, and add merchant correction (rename/alias, retroactive bulk-apply)
and subscription auto-detection.

### Implementation Details

**1. Sync correctness**
- Sender confirmed (`alerts@hdfcbank.bank.in`) already matches both the Gmail
  search query and `KNOWN_FINANCIAL_DOMAINS` — no fix needed. Add a
  regression test asserting the query string and domain list stay in sync
  (single shared constant instead of duplicated across two files, so this
  can't silently drift again).
- Replace hardcoded `MAX_PAGES`/`after:1-day` with `SYNC_LOOKBACK_DAYS` env var
  (default 180) for the first-ever full sync; subsequent full-imports (used as
  incremental-sync fallback) query only since `lastSyncAt`.
- Remove the page cap or raise it substantially + paginate across multiple
  invocations (store `nextPageToken` on `GmailConnection` so a
  Vercel-timeout-limited run resumes instead of restarting).
- `processIncrementalSync`: catch Gmail's 404 on expired `historyId`
  specifically and fall back to `processGmailImport` bounded to since
  `lastSyncAt` (not full 180-day rescan).
- Add an advisory lock: check-and-set `syncStatus` to `SYNCING` atomically
  (single UPDATE with `WHERE syncStatus != 'SYNCING'`, checking rows affected)
  before starting; both manual and cron routes reuse this.
- OAuth: on Gmail connect/callback, only overwrite `refreshToken` when Google
  actually returns a non-empty one; never null out an existing valid refresh
  token.

**2. Parsing correctness (calibrated against 3 real HDFC UPI debit alerts)**
- **Reference/UTR extraction fix (highest priority):** rewrite the
  `ref(erence)?|txn|transaction` pattern in `extractReferences` so the
  optional filler word ("reference", "no.") between the trigger keyword and
  the actual digits doesn't get captured instead of the number. Target: for
  `"UPI transaction reference no.: 489172985779"`, capture `489172985779`,
  not `"reference"`. Add a dedicated pattern for `"UPI transaction reference
  no.:? ([0-9]{6,})"` specifically, ahead of the generic one. Add a unit test
  using the exact real string above as a regression guard.
- **Date extraction fix:** add a DD-MM-YY (2-digit year) pattern to
  `extractDates` (`"on 26-09-26"` format), assuming 20XX. Add a unit test
  using the exact real date string as a regression guard.
- **Merchant extraction fix:** add a dedicated pattern for
  `"towards VPA [\w.@-]+\s*\(([^)]+)\)"` — the parenthesized name after the
  VPA/UPI ID — ahead of the generic patterns, since it's the most reliable
  signal for real HDFC UPI alerts. Verified against `(VIPIN KUMAR)`,
  `(SIDDEGOWDA H C)`, `(McDonalds Hardcastle Restaurants)`.
- **UPI handle whitelist fix:** add `yesbankltd` (confirmed real handle) to
  `extractUpiId`'s whitelist. Note for future: this whitelist will keep
  needing updates as new UPI handles appear — acceptable given HDFC-only,
  solo-user scope; not solving generally in this pass.
- Amount extraction: verified working correctly for real UPI debit alerts
  (single amount per email, no ambiguity in the 3 samples checked). Add a
  defensive fix anyway (prefer amount nearest debit/credit keyword over
  "available balance" phrasing) since other HDFC alert types (statements,
  card alerts) may include multiple amounts — lower priority, do after the
  three fixes above.
- Confidence: keep existing scoring math, but surface the reasons (which
  signals fired) into `ReviewItem.suggestedAction` JSON so the review UI can
  show why a transaction was flagged.

**3. Deduplication**
- Keep same-amount + date-window scoring, but require score ≥
  `AUTO_MERGE_THRESHOLD` AND at least one of {UTR match, reference match} OR
  (same merchant AND same payment method) before auto-merging.

**4. Categorization learning**
- Wire `learnFromUserChoice` into `PATCH /api/transactions/[id]`: whenever
  `categoryId` changes on an update where `merchantId` is set, call it after
  the transaction update, in the same request.

**5. Merchant correction**
- New endpoint `PATCH /api/merchants/[id]` (rename `Merchant.name`, doesn't
  touch `normalizedName` matching logic) and `POST
  /api/merchants/merge-and-alias` (assign a transaction's raw merchant string
  as an alias of an existing or newly created merchant, then bulk-update all
  transactions sharing that `merchantId` to the target `categoryId` if the
  user also picks one — atomic via a Prisma transaction).
- Minimal UI: on the transaction detail page, an "Edit merchant" action
  offering "rename this merchant" or "reassign to a different/new merchant,"
  with an "apply to all N past transactions from this merchant" checkbox
  (defaulted checked).

**6. Subscription detection**
- New `src/lib/subscription-detector.ts`: groups non-excluded `EXPENSE`
  transactions by `merchantId`, finds runs of ≥2 with amount within ±5% and a
  consistent interval (weekly ±3d / monthly ±3d / quarterly ±5d / yearly
  ±7d), upserts a `Subscription` row (matched by `merchantId`) with
  `nextExpectedDate` computed from last charge + interval. Runs as part of the
  sync pipeline after `processGmailImport`/`processIncrementalSync` complete.
- Not auto-trusted for review purposes: creates/updates the `Subscription` row
  directly (read-modeling, not money-moving), but creates a `ReviewItem` (new
  type `POSSIBLE_SUBSCRIPTION`, added to `ReviewType` enum) only the first
  time a given merchant is newly detected.

**7. Security / ops**
- Generate the initial Prisma migration from the current schema (`prisma
  migrate diff` against the live DB → baseline migration, since the DB already
  has the schema from `/api/setup`), delete `/api/setup/route.ts` entirely,
  remove its middleware exemption, switch deploy to run `prisma migrate
  deploy` (already scripted) before `next build`.

**8. Bug fix**
- `budgets/route.ts` `getPeriodRange`: fix MONTHLY (and add a real default) to
  anchor off `startDate`'s day-of-month, not always "current calendar month."

**9. Error visibility**
- `processGmailImport`/`processIncrementalSync`: on partial per-message
  failures, collect failure count + first error message into the stats object
  returned to `/api/gmail/sync`, persist a rolled-up `lastSyncErrorCount`
  alongside existing `errorMessage` on `GmailConnection`, shown in the
  Settings page's sync status card.

## Acceptance Criteria

1. A test Gmail account with HDFC alert emails spanning 180+ days: full sync
   creates one `FinancialEmail` + correct `Transaction` per genuine alert,
   verified count matches manual count from a sample of 20 emails picked at
   random.
2. Re-running sync twice does not create duplicate `Transaction` rows
   (idempotency).
3. Simulated expired `historyId` (mock 404) triggers automatic fallback to
   bounded full sync, not a silent permanent error state.
4. Manual sync + cron sync triggered concurrently for the same user: exactly
   one runs to completion, the second is rejected or no-ops.
5. Reconnecting Gmail OAuth a second time does not null out a previously
   stored valid `refreshToken` (unit test on the callback handler logic).
6. Editing a transaction's category via the API updates or creates a
   `CategoryRule` with `source: LEARNED`.
7. Renaming a merchant and choosing "apply to all N past transactions"
   updates exactly those N transactions' category in one atomic operation; a
   concurrent read never sees a partial state.
8. A synthetic transaction history with 3 monthly charges of the same amount
   from the same merchant produces exactly 1 `Subscription` row and exactly 1
   `ReviewItem` of type `POSSIBLE_SUBSCRIPTION`.
9. `/api/setup` route no longer exists in the codebase; `prisma migrate
   deploy` runs clean against a fresh copy of the production schema.
10. A monthly budget with `startDate` on the 15th reports spend for the
    correct rolling window, not the calendar month (regression test added).
11. `npm test` covers `ingestion.ts` (full + incremental + lock +
    history-expiry fallback), `gmail.ts` (token refresh persistence), and
    integration tests for `/api/gmail/sync`, `/api/transactions/[id]`,
    `/api/merchants/*`, `/api/budgets`.
12. All existing unit tests still pass.

## Testing Plan

| Layer | What | Count |
|---|---|---|
| Unit | amount/merchant extraction edge cases, dedup threshold logic, budget period range, subscription pattern detection | +12 |
| Unit | `ingestion.ts`: lock acquisition, history-expiry fallback, partial-failure stats | +6 |
| Integration | `/api/gmail/sync` (mocked Gmail client) full+incremental+concurrent-lock | +4 |
| Integration | `/api/transactions/[id]` PATCH → learning wired | +2 |
| Integration | `/api/merchants/*` rename + merge-and-alias + bulk apply | +3 |
| Integration | `/api/budgets` period range regression | +2 |

## Rollback Plan

All changes are additive or isolated (new endpoints, new lib file, schema
migration adds one enum value + no destructive column changes). If sync
changes misbehave in production, `GmailConnection.syncStatus` can be manually
reset and `/api/gmail/reset` clears synced data for a fresh re-import.
Migration baseline is generated as a no-op against current DB state, so
switching to `prisma migrate deploy` carries no data risk.

## Effort Estimate

- Sync pipeline fixes (sender/backfill/lock/history-expiry/OAuth): ~4h
- Parser/dedup correctness: ~2h
- Categorization learning wiring: ~30min
- Merchant correction (API + minimal UI): ~2h
- Subscription detection: ~2h
- Prisma migration baseline + `/api/setup` removal: ~1h
- Budget bug fix: ~15min
- Tests (all above): ~4h
- **Total: ~16h**

## Files Reference

| File | Change |
|---|---|
| `src/lib/email-detector.ts` | Fix/unify known-domain list |
| `src/lib/gmail.ts:74` | Fix sender query, add lookback param |
| `src/lib/ingestion.ts` | Backfill window, pagination resume, lock, history-expiry fallback, error stats |
| `src/app/api/gmail/connect/route.ts`, `callback/route.ts` | Refresh-token overwrite guard |
| `src/lib/parser.ts` | Amount disambiguation, merchant regex expansion |
| `src/lib/deduplication.ts` | Tighter auto-merge condition |
| `src/lib/categorizer.ts` | (no logic change; now actually called) |
| `src/app/api/transactions/[id]/route.ts` | Call `learnFromUserChoice` on category change |
| `src/app/api/merchants/[id]/route.ts` (new) | Rename merchant |
| `src/app/api/merchants/merge-and-alias/route.ts` (new) | Merge/alias + bulk category apply |
| `src/lib/subscription-detector.ts` (new) | Detection logic |
| `prisma/schema.prisma` | Add `POSSIBLE_SUBSCRIPTION` to `ReviewType` |
| `src/app/api/setup/route.ts` | Delete |
| `src/middleware.ts` | Remove setup exemption |
| `prisma/migrations/` (new) | Baseline migration |
| `src/app/api/budgets/route.ts:15-46` | Fix `getPeriodRange` |
| `src/lib/__tests__/*` (new files) | Coverage per testing plan |

## Out of Scope

- Other banks beyond HDFC.
- Multi-user/admin features.
- Email/push notifications on sync errors (existing `ReviewItem` flow only).
- Real-time push sync (Gmail Pub/Sub push notifications) — stays on cron +
  manual trigger.

## Open Item Before Implementation

Need 2-3 real (redact amounts/personal info if desired, keep wording/structure)
HDFC alert email bodies from the user to calibrate the sender-domain fix and
merchant-extraction regex against the real inbox rather than assumptions.
