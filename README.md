# ta-advisory-worker

Scripts for connecting to a Notion candidate-tracking database, reporting on
candidates that need follow-up, and syncing reminder updates back to Notion.

## How candidates get into the system
Candidates are added and edited directly in the Notion database UI, the
same way you always would — there is no separate ingestion step, API call,
or file upload required. The `NOTION_TOKEN` in `.env` is only the
integration's read/write credential so the scripts can access the
database; it is not a mechanism for inserting data yourself.
Any row present in the shared database (see "Database requirements"
below) at the time `worker.js` runs — whether added moments ago or long
ago — will be picked up automatically.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your Notion integration token:
   ```bash
   cp .env.example .env
   ```
   ```
   NOTION_TOKEN=ntn_your_integration_token_here
   ```
3. Share the target Notion database with your integration:
   in Notion, open the database → **•••** → **Connections** → connect your
   integration.

## Files

- `index.js` — verifies the Notion connection. Exports `notion` (the
  configured client) and `testConnection()`.
- `worker.js` — fetches candidate rows from the Notion database, reports
  candidates needing follow-up, and can push reminder-date updates back to
  Notion.

## Usage

### Test the Notion connection

```bash
node index.js
```

Prints the connected integration's bot name, type, and ID.

### Check for overdue candidates (dry run)

```bash
node worker.js
```

Fetches all rows from the database and reports candidates whose
`Action Needed` date is today or earlier. This is a **dry run** — no
changes are written to Notion.

Add `--verbose` to also print every fetched row with all of its properties:

```bash
node worker.js --verbose
```

### Apply reminder updates

To bump the `Action Needed` date for all overdue candidates, re-run with
`--apply`:

```bash
node worker.js --apply
```

By default this sets `Action Needed` to today's date. Override the target
date with `--reminder-date` or the `REMINDER_DATE` environment variable:

```bash
node worker.js --apply --reminder-date=2026-09-15
# or
REMINDER_DATE=2026-09-15 node worker.js --apply
```

**Note:** `--apply` writes directly to the live Notion database. Always
review the dry-run output first to confirm which candidates will be
updated.

## CI / Automation

Two GitHub Actions workflows are included:

- `.github/workflows/ci.yml` — runs on every push/PR to `main`: syntax
  checks (`node --check`) and the unit test suite (`npm test`, using
  Node's built-in test runner against `tests/`).
- `.github/workflows/scheduled-worker.yml` — runs `worker.js` on a cron
  schedule (weekdays at 13:00 UTC by default) as a **dry run** that reports
  overdue candidates in the workflow log. It can also be triggered manually
  via "Run workflow", optionally passing `apply: true` and a custom
  `reminder_date` to actually write updates back to Notion.

Both workflows require a `NOTION_TOKEN` repository secret (Settings →
Secrets and variables → Actions) with the same value as your local `.env`.
Scheduled runs never pass `--apply` automatically, to avoid unattended
writes to the live database.

## Database requirements

- **Fixed database ID:** the worker only reads the database whose ID is
  hardcoded as `DATABASE_ID` in `worker.js` (currently
  `96f2ec7166104d68b52c4c6ffeb809ad`). Candidates in any other Notion
  database will not be seen. To track a different database, update
  `DATABASE_ID` in `worker.js` (or extend it to accept the ID as an
  argument).
- **Must be shared with the integration:** the database (or its parent
  page) must be connected to your integration — in Notion, open it →
  **•••** → **Connections** → connect your integration. If it isn't
  shared, requests fail with a Notion `object_not_found` error even
  though the database exists.
- **Single data source expected:** the worker queries the database's
  first data source. If the database has multiple data sources, it logs
  a warning and only reads/updates the first one.

## Database schema notes

Notable properties on the underlying data source include:

- `Candidate` (title)
- `Action Needed` (date) — read and updated by `worker.js`
- `Contact status` (select: Active, Sourced, Future, Dormant,
  Relationship only, Do not contact)
- `Pipeline Gap` (formula) — read-only, cannot be updated via the API
- `Last Touched` (last-edited time, managed automatically by Notion)

If the database is restructured (e.g. `Candidate` or `Action Needed` are
renamed), update the corresponding property lookups in `worker.js`.
