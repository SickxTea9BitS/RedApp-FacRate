import { deflateRawSync, inflateRawSync } from 'node:zlib';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_ARCHIVE_BYTES = 4_500_000;
const MAX_UNCOMPRESSED_BYTES = 12_000_000;
const MAX_ENTRIES = 20;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date: Date) => {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
};

export const createZip = (files: Record<string, string>) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  let totalUncompressed = 0;
  const timestamp = dosDateTime(new Date());

  for (const [name, content] of Object.entries(files)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith('.')) throw new Error('Invalid archive filename.');
    const nameBytes = encoder.encode(name);
    const raw = Buffer.from(encoder.encode(content));
    totalUncompressed += raw.length;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('The export exceeds the 12 MB uncompressed data limit. Export fewer datasets.');
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(timestamp.time, 10);
    local.writeUInt16LE(timestamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    Buffer.from(nameBytes).copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(timestamp.time, 12);
    central.writeUInt16LE(timestamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    Buffer.from(nameBytes).copy(central, 46);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error('The export exceeds the 4.5 MB archive limit. Export fewer datasets.');
  return archive;
};

export const readZip = (input: Uint8Array) => {
  const buffer = Buffer.from(input);
  if (buffer.length < 22 || buffer.length > MAX_ARCHIVE_BYTES) throw new Error('The ZIP file is empty or exceeds the 4.5 MB limit.');
  let endOffset = -1;
  for (let i = Math.max(0, buffer.length - 65_557); i <= buffer.length - 22; i += 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) endOffset = i;
  }
  if (endOffset < 0) throw new Error('Invalid ZIP archive: end record not found.');
  const count = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (count < 1 || count > MAX_ENTRIES || centralOffset + centralSize > endOffset) throw new Error('Invalid ZIP directory or too many files.');
  const files: Record<string, string> = {};
  let cursor = centralOffset;
  let totalSize = 0;

  for (let entry = 0; entry < count; entry += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (flags & 1 || (method !== 0 && method !== 8) || uncompressedSize > MAX_UNCOMPRESSED_BYTES) throw new Error('Encrypted, unsupported, or oversized ZIP entry.');
    const name = decoder.decode(buffer.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.startsWith('.') || Object.prototype.hasOwnProperty.call(files, name)) throw new Error('Unsafe or duplicate ZIP filename.');
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid ZIP local header.');
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) throw new Error('ZIP entry exceeds archive bounds.');
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const raw = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (raw.length !== uncompressedSize || crc32(raw) !== checksum) throw new Error('ZIP entry failed size or checksum validation.');
    totalSize += raw.length;
    if (totalSize > MAX_UNCOMPRESSED_BYTES) throw new Error('ZIP archive expands beyond the allowed size.');
    files[name] = decoder.decode(raw);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
};

export const toCsv = (rows: Array<Record<string, string | number>>, columns = Object.keys(rows[0] ?? {})) => {
  if (!columns.length) return '';
  const cell = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return [columns.map(cell).join(','), ...rows.map(row => columns.map(column => cell(row[column] ?? '')).join(','))].join('\r\n');
};

export const parseCsv = (source: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift()!.map(value => value.trim());
  if (headers.some(value => !value) || new Set(headers).size !== headers.length) throw new Error('CSV has missing or duplicate column names.');
  return rows.filter(values => values.some(value => value !== '')).map(values => {
    if (values.length !== headers.length) throw new Error('CSV row has a different number of columns than its header.');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
};
