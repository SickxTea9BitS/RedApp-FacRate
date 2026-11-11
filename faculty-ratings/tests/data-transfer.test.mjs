import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZip, parseCsv, readZip, toCsv } from '../src/server/data-transfer.ts';

test('ZIP archives round-trip UTF-8 CSV and JSON files', () => {
  const files = {
    'manifest.json': JSON.stringify({ format: 'faculty-ratings-export', schemaVersion: 1 }),
    'faculties.csv': 'faculty_id,first_name,middle_name,last_name,school\r\nVITBFAC0001,"Asha, Devi",,Rao,SCOPE',
  };
  const archive = createZip(files);
  const restored = readZip(archive);
  assert.deepEqual(restored, files);
});

test('CSV serialization preserves commas, quotes, and line breaks', () => {
  const rows = [{ name: 'Asha, "Devi"', note: 'Line one\nLine two' }];
  const csv = toCsv(rows, ['name', 'note']);
  assert.deepEqual(parseCsv(csv), rows);
});

test('CSV serialization emits headers for empty datasets', () => {
  assert.equal(toCsv([], ['faculty_id', 'first_name']), 'faculty_id,first_name');
  assert.deepEqual(parseCsv('faculty_id,first_name'), []);
});

test('ZIP reader rejects malformed archives', () => {
  assert.throws(() => readZip(Buffer.from('not a zip archive')));
});
