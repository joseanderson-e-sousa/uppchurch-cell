import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReport, periodBounds, todayInSaoPaulo } from '../lib/reports.ts';

test('periods handle Sunday, year rollover and leap February', () => {
  assert.deepEqual(periodBounds('semana', '2027-01-03'), { start: '2026-12-28', end: '2027-01-04' });
  assert.deepEqual(periodBounds('semana', '2026-10-05'), { start: '2026-10-05', end: '2026-10-12' });
  assert.deepEqual(periodBounds('mes', '2028-02-29'), { start: '2028-02-01', end: '2028-03-01' });
  assert.equal(todayInSaoPaulo(new Date('2026-10-06T01:00:00Z')), '2026-10-05');
});
test('report validation accepts zero and rejects invalid dates and counts', () => {
  const form = (date, participants, visitors) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ meeting_date: date, participants, visitors })) data.set(key, value);
    return data;
  };
  assert.deepEqual(parseReport(form('2028-02-29', '0', '2')), { meeting_date: '2028-02-29', participants: 0, visitors: 2 });
  for (const date of ['', '2026-02-29', '2026-04-31', 'invalid']) assert.equal(parseReport(form(date, '1', '1')), null);
  for (const count of ['', '-1', '1.5', 'NaN', '2147483648']) {
    assert.equal(parseReport(form('2026-10-06', count, '1')), null);
    assert.equal(parseReport(form('2026-10-06', '1', count)), null);
  }
  assert.equal(parseReport(new FormData()), null);
});
