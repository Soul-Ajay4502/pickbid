// Writes a one-sheet .xlsx workbook — the counterpart of sheetReader.ts, and
// dependency-free for the same reason. It exists for the import dialog's
// template: an organizer who is told "upload an Excel sheet" should be handed
// an Excel sheet to fill in, not a CSV to convert.
//
// The zip is written *stored* (no compression): a template is a few kilobytes,
// and that keeps this to a CRC table and some headers. Cells are inline
// strings, so nothing is ever reinterpreted as a number or a date.

export interface SheetColumn {
  header: string;
  /** Column width in Excel's character units. */
  width: number;
  /**
   * Format the whole column as text, so what is typed stays as typed — a phone
   * number keeps its leading zero and never becomes 9.87E+09.
   */
  text?: boolean;
  /** Offer these values as an in-cell dropdown. Other values are still allowed. */
  options?: readonly string[];
}

/** Rows below the header that carry the column's dropdown. */
const VALIDATED_ROWS = 500;

const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Control characters are not legal in XML 1.0 at all
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/** "A", "B", … "Z", "AA" for a zero-based column index. */
function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

// Cell styles: 0 plain, 1 bold header on a tint, 2 text-formatted.
const STYLES =
  `${XML}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function sheetXml(columns: SheetColumn[], rows: string[][]): string {
  const cell = (value: string, col: number, row: number, style: number) =>
    value === ''
      ? ''
      : `<c r="${columnName(col)}${row}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"${c.text ? ' style="2"' : ''}/>`)
    .join('');
  const header = `<row r="1">${columns.map((c, i) => cell(c.header, i, 1, 1)).join('')}</row>`;
  const body = rows
    .map((r, ri) => `<row r="${ri + 2}">${columns.map((c, ci) => cell(r[ci] ?? '', ci, ri + 2, c.text ? 2 : 0)).join('')}</row>`)
    .join('');
  const validations = columns
    .map((c, i) => {
      if (!c.options?.length) return '';
      const range = `${columnName(i)}2:${columnName(i)}${VALIDATED_ROWS + 1}`;
      // A list literal is one quoted, comma-separated string. `showErrorMessage`
      // is left off on purpose: the importer reads free text too, so the
      // dropdown suggests, it doesn't forbid.
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" sqref="${range}"><formula1>"${xmlEscape(c.options.join(','))}"</formula1></dataValidation>`;
    })
    .filter(Boolean);
  return (
    `${XML}<worksheet xmlns="${MAIN_NS}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${header}${body}</sheetData>` +
    (validations.length ? `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>` : '') +
    '</worksheet>'
  );
}

// ── Zip (stored) ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; text: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const data = encoder.encode(f.text);
    return { name: encoder.encode(f.name), data, crc: crc32(data) };
  });
  const size =
    entries.reduce((n, e) => n + 30 + e.name.length + e.data.length + 46 + e.name.length, 0) + 22;
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  // A fixed timestamp (1 Jan 2025) — the template is the same file every time
  const DOS_TIME = 0;
  const DOS_DATE = ((2025 - 1980) << 9) | (1 << 5) | 1;
  let p = 0;
  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(p);
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true);       // version needed
    view.setUint16(p + 6, 0x0800, true);   // names are UTF-8
    view.setUint16(p + 8, 0, true);        // stored
    view.setUint16(p + 10, DOS_TIME, true);
    view.setUint16(p + 12, DOS_DATE, true);
    view.setUint32(p + 14, e.crc, true);
    view.setUint32(p + 18, e.data.length, true);
    view.setUint32(p + 22, e.data.length, true);
    view.setUint16(p + 26, e.name.length, true);
    view.setUint16(p + 28, 0, true);
    out.set(e.name, p + 30);
    out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.data.length;
  }
  const directory = p;
  entries.forEach((e, i) => {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, 0x0800, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, DOS_TIME, true);
    view.setUint16(p + 14, DOS_DATE, true);
    view.setUint32(p + 16, e.crc, true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, e.name.length, true);
    // extra, comment, disk, internal attrs, external attrs: all zero
    view.setUint32(p + 42, offsets[i], true);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  });
  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - directory, true);
  view.setUint32(p + 16, directory, true);
  return out;
}

/** A workbook with one sheet: a styled, frozen header row and the given rows of text. */
export function buildXlsx(sheetName: string, columns: SheetColumn[], rows: string[][]): Blob {
  const name = xmlEscape(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
  const bytes = zip([
    {
      name: '[Content_Types].xml',
      text: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      text: `${XML}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `${XML}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `${XML}<Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', text: STYLES },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml(columns, rows) },
  ]);
  return new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
