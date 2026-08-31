# ta-advisory-worker

Scripts for connecting to a Notion candidate-tracking database, reporting on
candidates that need follow-up, and syncing reminder updates back to Notion.

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

## Database schema notes

The worker targets a fixed `DATABASE_ID` (see `worker.js`). Notable
properties on the underlying data source include:

- `Candidate` (title)
- `Action Needed` (date) — read and updated by `worker.js`
- `Contact status` (select: Active, Sourced, Future, Dormant,
  Relationship only, Do not contact)
- `Pipeline Gap` (formula) — read-only, cannot be updated via the API
- `Last Touched` (last-edited time, managed automatically by Notion)

If the database is restructured (e.g. `Candidate` or `Action Needed` are
renamed), update the corresponding property lookups in `worker.js`.
