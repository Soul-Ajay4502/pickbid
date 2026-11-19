// Reads the first sheet of an .xlsx workbook, or a .csv, into rows of text.
//
// Browser-only and dependency-free on purpose. An .xlsx is a zip of XML, and
// the browser already ships both halves of reading one — `DecompressionStream`
// inflates the entries, `DOMParser` reads them — so the import dialog needs no
// spreadsheet library in the bundle, and the file never leaves the organizer's
// device until they have seen the preview. Only what a registration sheet
// holds is supported: cell text and numbers from the first worksheet. Formats,
// formulas (their cached results are read) and other sheets are ignored.

/** Thrown with a message that is safe to show the organizer as-is. */
export class SheetError extends Error {}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** Hard ceiling on rows read, so a stray formatted-to-row-1,000,000 sheet can't hang the tab. */
const MAX_ROWS = 5000;
const MAX_COLS = 60;

export async function readSheet(file: File): Promise<string[][]> {
  if (file.size > MAX_FILE_BYTES) throw new SheetError('That file is over 8 MB — export just the registration sheet');
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  let rows: string[][];
  if (isZip) rows = await readXlsx(bytes);
  else if (name.endsWith('.xls')) {
    throw new SheetError('Old .xls files aren\'t supported — in Excel choose Save As → Excel Workbook (.xlsx) or CSV');
  } else rows = parseCsv(new TextDecoder('utf-8').decode(bytes));
  // Drop rows with nothing in them, and trailing empty cells
  return rows
    .map((r) => { const out = [...r]; while (out.length && !out[out.length - 1]) out.pop(); return out; })
    .filter((r) => r.some((c) => c));
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.search(/\r|\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter = count('\t') > count(',') ? '\t' : count(';') > count(',') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      rows.push(row); row = [];
      if (rows.length >= MAX_ROWS) return rows;
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

interface ZipEntry { method: number; compressedSize: number; localOffset: number }

function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record sits at the very end, after an
  // optional comment of up to 64 KB
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new SheetError('That file isn\'t a readable Excel workbook');
  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder('utf-8');
  for (let n = 0; n < total && p + 46 <= bytes.length; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    entries.set(decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen)), {
      method: view.getUint16(p + 10, true),
      compressedSize: view.getUint32(p + 20, true),
      localOffset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function entryText(bytes: Uint8Array, entry: ZipEntry | undefined): Promise<string | null> {
  if (!entry) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.localOffset;
  if (o + 30 > bytes.length || view.getUint32(o, true) !== 0x04034b50) throw new SheetError('That workbook is damaged');
  const start = o + 30 + view.getUint16(o + 26, true) + view.getUint16(o + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder('utf-8').decode(data);
  if (entry.method !== 8) throw new SheetError('That workbook uses a compression this importer can\'t read — save it as CSV instead');
  if (typeof DecompressionStream === 'undefined') {
    throw new SheetError('This browser can\'t open .xlsx files — save the sheet as CSV and import that');
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new SheetError('That workbook is damaged');
  return doc;
}

const all = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag));

/** Text of a string item: its runs joined, phonetic guides left out. */
function stringItem(node: Element): string {
  return all(node, 't').filter((t) => t.parentElement?.localName !== 'rPh').map((t) => t.textContent ?? '').join('');
}

/** "BC12" → 54 (zero-based column). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

/** Which worksheet file is the workbook's first tab. */
async function firstSheetPath(bytes: Uint8Array, entries: Map<string, ZipEntry>): Promise<string> {
  try {
    const workbook = await entryText(bytes, entries.get('xl/workbook.xml'));
    const rels = await entryText(bytes, entries.get('xl/_rels/workbook.xml.rels'));
    if (workbook && rels) {
      const sheet = all(xml(workbook), 'sheet')[0];
      const relId = sheet && Array.from(sheet.attributes).find((a) => a.localName === 'id' && a.name !== 'sheetId')?.value;
      const target = all(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === relId)?.getAttribute('Target');
      if (target) {
        const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
        if (entries.has(path)) return path;
      }
    }
  } catch { /* fall through to the conventional name */ }
  const fallback = [...entries.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  if (!fallback) throw new SheetError('That workbook has no sheets');
  return fallback;
}

async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const entries = zipEntries(bytes);
  const sheetText = await entryText(bytes, entries.get(await firstSheetPath(bytes, entries)));
  if (!sheetText) throw new SheetError('That workbook has no sheets');
  const sharedText = await entryText(bytes, entries.get('xl/sharedStrings.xml'));
  const shared = sharedText ? all(xml(sharedText), 'si').map(stringItem) : [];

  const rows: string[][] = [];
  for (const rowNode of all(xml(sheetText), 'row')) {
    // Rows can be sparse too — `r` is the real row number
    const rowIdx = Number(rowNode.getAttribute('r')) - 1;
    const at = Number.isInteger(rowIdx) && rowIdx >= 0 ? rowIdx : rows.length;
    if (at >= MAX_ROWS) break;
    const row: string[] = [];
    let next = 0;
    for (const c of all(rowNode, 'c')) {
      const ref = c.getAttribute('r');
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      if (col < 0 || col >= MAX_COLS) continue;
      const type = c.getAttribute('t');
      const raw = all(c, 'v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = stringItem(c);
      else if (type === 'b') value = raw === '1' ? 'Yes' : 'No';
      else if (type === 'str' || type === 'e') value = raw;
      // A number: phone numbers land here, sometimes written as 9.87654321E9
      else value = raw !== '' && Number.isFinite(Number(raw)) ? String(Number(raw)) : raw;
      while (row.length < col) row.push('');
      row[col] = value.trim();
    }
    while (rows.length < at) rows.push([]);
    rows[at] = row;
  }
  return rows;
}
