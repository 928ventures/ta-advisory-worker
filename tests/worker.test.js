const test = require('node:test');
const assert = require('node:assert/strict');

// index.js exits the process if NOTION_TOKEN is missing, so make sure a
// dummy value is present before requiring worker.js (which requires index.js).
process.env.NOTION_TOKEN = process.env.NOTION_TOKEN || 'test-token';

const {
  plainValue,
  isOverdue,
  getActionNeededDate,
  getCandidateName,
  todayISO,
} = require('../worker.js');

function row(properties, id = 'row-id') {
  return { id, properties };
}

test('todayISO returns a YYYY-MM-DD string', () => {
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('plainValue: title', () => {
  const value = { type: 'title', title: [{ plain_text: 'Jane' }, { plain_text: ' Doe' }] };
  assert.equal(plainValue(value), 'Jane Doe');
});

test('plainValue: rich_text', () => {
  const value = { type: 'rich_text', rich_text: [{ plain_text: 'hello' }] };
  assert.equal(plainValue(value), 'hello');
});

test('plainValue: select', () => {
  assert.equal(plainValue({ type: 'select', select: { name: 'Active' } }), 'Active');
  assert.equal(plainValue({ type: 'select', select: null }), '');
});

test('plainValue: status', () => {
  assert.equal(plainValue({ type: 'status', status: { name: 'Sourced' } }), 'Sourced');
});

test('plainValue: multi_select', () => {
  const value = { type: 'multi_select', multi_select: [{ name: 'A' }, { name: 'B' }] };
  assert.equal(plainValue(value), 'A, B');
});

test('plainValue: people', () => {
  const value = { type: 'people', people: [{ name: 'Alice' }, { id: 'u2' }] };
  assert.equal(plainValue(value), 'Alice, u2');
});

test('plainValue: date without end', () => {
  assert.equal(plainValue({ type: 'date', date: { start: '2026-09-01' } }), '2026-09-01');
});

test('plainValue: date with end', () => {
  const value = { type: 'date', date: { start: '2026-09-01', end: '2026-09-05' } };
  assert.equal(plainValue(value), '2026-09-01 → 2026-09-05');
});

test('plainValue: checkbox', () => {
  assert.equal(plainValue({ type: 'checkbox', checkbox: true }), 'yes');
  assert.equal(plainValue({ type: 'checkbox', checkbox: false }), 'no');
});

test('plainValue: number', () => {
  assert.equal(plainValue({ type: 'number', number: 42 }), 42);
});

test('plainValue: url/email/phone_number', () => {
  assert.equal(plainValue({ type: 'url', url: 'https://x.test' }), 'https://x.test');
  assert.equal(plainValue({ type: 'email', email: 'a@b.com' }), 'a@b.com');
  assert.equal(plainValue({ type: 'phone_number', phone_number: '555' }), '555');
});

test('plainValue: formula', () => {
  const value = { type: 'formula', formula: { type: 'string', string: 'gap!' } };
  assert.equal(plainValue(value), 'gap!');
});

test('plainValue: unknown type falls back to (type)', () => {
  assert.equal(plainValue({ type: 'rollup' }), '(rollup)');
});

test('getActionNeededDate returns the date string when present', () => {
  const r = row({ 'Action Needed': { type: 'date', date: { start: '2026-08-20' } } });
  assert.equal(getActionNeededDate(r), '2026-08-20');
});

test('getActionNeededDate returns null when date property is empty', () => {
  const r = row({ 'Action Needed': { type: 'date', date: null } });
  assert.equal(getActionNeededDate(r), null);
});

test('getActionNeededDate returns null when property is missing', () => {
  const r = row({});
  assert.equal(getActionNeededDate(r), null);
});

test('getCandidateName returns the title text when present', () => {
  const r = row({ Candidate: { type: 'title', title: [{ plain_text: 'Bryan Hull' }] } });
  assert.equal(getCandidateName(r), 'Bryan Hull');
});

test('getCandidateName falls back to row id when missing', () => {
  const r = row({}, 'fallback-id');
  assert.equal(getCandidateName(r), 'fallback-id');
});

test('isOverdue is true when the date is on or before the reference date', () => {
  const r = row({ 'Action Needed': { type: 'date', date: { start: '2026-08-20' } } });
  assert.equal(isOverdue(r, '2026-08-20'), true);
  assert.equal(isOverdue(r, '2026-08-25'), true);
});

test('isOverdue is false when the date is after the reference date', () => {
  const r = row({ 'Action Needed': { type: 'date', date: { start: '2026-09-01' } } });
  assert.equal(isOverdue(r, '2026-08-25'), false);
});

test('isOverdue is false when there is no Action Needed date', () => {
  const r = row({});
  assert.equal(isOverdue(r, '2026-08-25'), false);
});
