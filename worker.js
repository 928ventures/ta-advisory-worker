const { notion } = require('./index.js');

// ID pulled from the shared Notion URL:
// https://app.notion.com/p/928ventures/96f2ec7166104d68b52c4c6ffeb809ad?v=...
const DATABASE_ID = '96f2ec7166104d68b52c4c6ffeb809ad';

function plainValue(value) {
  switch (value.type) {
    case 'title':
      return value.title.map((t) => t.plain_text).join('');
    case 'rich_text':
      return value.rich_text.map((t) => t.plain_text).join('');
    case 'select':
      return value.select?.name ?? '';
    case 'status':
      return value.status?.name ?? '';
    case 'multi_select':
      return value.multi_select.map((s) => s.name).join(', ');
    case 'people':
      return value.people.map((p) => p.name ?? p.id).join(', ');
    case 'date':
      return value.date?.end
        ? `${value.date.start} → ${value.date.end}`
        : value.date?.start ?? '';
    case 'checkbox':
      return value.checkbox ? 'yes' : 'no';
    case 'number':
      return value.number ?? '';
    case 'url':
    case 'email':
    case 'phone_number':
      return value[value.type] ?? '';
    case 'formula':
      return value.formula[value.formula.type] ?? '';
    default:
      return `(${value.type})`;
  }
}

// In API version 2025-09-03 a database is a container for one or more
// data sources, and rows are queried from a data source rather than from
// the database itself.
async function resolveDataSourceId(databaseId) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const dataSources = database.data_sources ?? [];

  if (dataSources.length === 0) {
    throw new Error(`Database ${databaseId} has no data sources.`);
  }
  if (dataSources.length > 1) {
    const names = dataSources.map((d) => `${d.name} (${d.id})`).join(', ');
    console.warn(`Database has multiple data sources, using the first: ${names}`);
  }
  return dataSources[0].id;
}

async function fetchRows({ databaseId = DATABASE_ID, pageSize = 100 } = {}) {
  const dataSourceId = await resolveDataSourceId(databaseId);

  const rows = [];
  let cursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: pageSize,
      start_cursor: cursor,
    });
    rows.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return rows;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getCandidateName(row) {
  const prop = row.properties['Candidate'];
  return prop ? plainValue(prop) : row.id;
}

function getActionNeededDate(row) {
  const prop = row.properties['Action Needed'];
  return prop?.date?.start ?? null;
}

// A candidate is overdue when their 'Action Needed' date is today or earlier.
function isOverdue(row, referenceDate = todayISO()) {
  const date = getActionNeededDate(row);
  return date !== null && date <= referenceDate;
}

async function updateActionNeeded(pageId, newDate) {
  return notion.pages.update({
    page_id: pageId,
    properties: {
      'Action Needed': { date: { start: newDate } },
    },
  });
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const verbose = argv.includes('--verbose');
  const reminderArg = argv.find((a) => a.startsWith('--reminder-date='));
  const reminderDate =
    reminderArg?.split('=')[1] || process.env.REMINDER_DATE || todayISO();
  return { apply, verbose, reminderDate };
}

async function main() {
  const { apply, verbose, reminderDate } = parseArgs(process.argv.slice(2));
  const today = todayISO();

  try {
    const rows = await fetchRows();
    console.log(`Fetched ${rows.length} row(s) from database ${DATABASE_ID}\n`);

    if (verbose) {
      rows.forEach((row, index) => {
        console.log(`[${index + 1}] ${row.id}`);
        Object.entries(row.properties).forEach(([name, value]) => {
          console.log(`    ${name}: ${plainValue(value)}`);
        });
        console.log('');
      });
    }

    const overdue = rows.filter((row) => isOverdue(row, today));
    console.log(
      `=== Overdue candidates (Action Needed on/before ${today}): ${overdue.length} ===\n`
    );
    overdue.forEach((row) => {
      console.log(`- ${getCandidateName(row)} (Action Needed: ${getActionNeededDate(row)})`);
    });

    if (overdue.length === 0) {
      console.log('\nNo overdue candidates found.');
      return;
    }

    if (!apply) {
      console.log(
        `\nDry run: no changes written. Re-run with --apply to bump 'Action Needed' to ` +
          `${reminderDate} for the ${overdue.length} candidate(s) above ` +
          `(override the date with --reminder-date=YYYY-MM-DD or the REMINDER_DATE env var).`
      );
      return;
    }

    console.log(
      `\nApplying updates: setting 'Action Needed' to ${reminderDate} for ${overdue.length} candidate(s)...`
    );
    for (const row of overdue) {
      await updateActionNeeded(row.id, reminderDate);
      console.log(`  Updated ${getCandidateName(row)}`);
    }
    console.log('\nDone.');
  } catch (error) {
    if (error.code === 'object_not_found') {
      console.error(
        'Notion could not find that database. Share the page with your ' +
          'integration (••• → Connections) and try again.'
      );
    } else {
      console.error('Failed to read database:', error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fetchRows,
  resolveDataSourceId,
  plainValue,
  DATABASE_ID,
  isOverdue,
  getActionNeededDate,
  getCandidateName,
  updateActionNeeded,
  todayISO,
};
