'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Upload, X, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { readSheet, SheetError } from '@/lib/sheetReader';
import { buildXlsx, type SheetColumn } from '@/lib/sheetWriter';
import {
  BATTING_TYPES, BOWLING_TYPES, IMPORT_FIELDS, IMPORT_MAX_ROWS, guessMapping, importDedupeKey, previewRow,
  type ImportField, type ImportMapping,
} from '@/lib/playerImport';
import { PLAYER_ROLES, type Player } from '@/lib/types';

// One definition for both template downloads, so the Excel and CSV versions
// can't drift apart. The two example rows show the spellings the importer
// reads best; the dropdowns in the Excel version offer the same values.
const TEMPLATE_COLUMNS: SheetColumn[] = [
  { header: 'Player Name', width: 26 },
  { header: 'Phone Number', width: 18, text: true },
  { header: 'Email', width: 28 },
  { header: 'Role', width: 22, options: PLAYER_ROLES },
  { header: 'Batting Style', width: 18, options: BATTING_TYPES },
  { header: 'Bowling Style', width: 22, options: BOWLING_TYPES },
  { header: 'Wicket Keeper', width: 16, options: ['Yes', 'No'] },
];
const TEMPLATE_ROWS = [
  ['Arun Kumar', '9876543210', 'arun@example.com', 'All-Rounder', 'Right-Hand Bat', 'Right-Arm Medium', 'No'],
  ['Vignesh R', '9876501234', '', 'Wicket-Keeper Batter', 'Left-Hand Bat', 'N/A', 'Yes'],
];

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadTemplate(format: 'xlsx' | 'csv') {
  if (format === 'xlsx') {
    saveBlob(buildXlsx('Players', TEMPLATE_COLUMNS, TEMPLATE_ROWS), 'pickbid-players-template.xlsx');
    return;
  }
  const csv = [TEMPLATE_COLUMNS.map((c) => c.header), ...TEMPLATE_ROWS].map((r) => r.join(',')).join('\r\n') + '\r\n';
  saveBlob(new Blob([csv], { type: 'text/csv' }), 'pickbid-players-template.csv');
}

/**
 * Organizer-only: turn a registration spreadsheet (.xlsx or .csv — a Google
 * Forms export, last season's list) into player cards.
 *
 * The file is read in the browser and nothing is saved until the organizer has
 * seen what each row becomes: which column feeds which field (guessed from the
 * headers, adjustable), every card in a preview, and the rows that look like
 * someone already on the roster left unticked. Like the Add Player form, an
 * import is exempt from the league's ID and receipt requirements — it is the
 * organizer adding cards on other people's behalf.
 */
export default function ImportPlayersModal({ leagueId, onClose }: {
  leagueId: string;
  /** `changed` is true when players were imported, so the parent can refetch */
  onClose: (changed: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  /** Sheet rows the organizer has ticked or unticked by hand, overriding the default. */
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // The current roster, to flag rows that are already in the league
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leagues/${leagueId}/players`)
      .then((r) => (r.ok ? r.json() : []))
      .then((players: Player[]) => {
        if (!cancelled && Array.isArray(players)) setExisting(new Set(players.map(importDedupeKey)));
      })
      .catch(() => { /* no duplicate hints — the import itself still works */ });
    return () => { cancelled = true; };
  }, [leagueId]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const rows = await readSheet(file);
      if (rows.length < 2) throw new SheetError('That sheet needs a header row and at least one player');
      const width = Math.max(...rows.map((r) => r.length));
      const head = Array.from({ length: width }, (_, i) => rows[0][i] || `Column ${i + 1}`);
      setHeaders(head);
      setBody(rows.slice(1));
      setMapping(guessMapping(head));
      setOverrides({});
      setFileName(file.name);
    } catch (err) {
      toast.error(err instanceof SheetError ? err.message : 'Could not read that file');
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const preview = useMemo(() => {
    if (!mapping) return [];
    const seen = new Set<string>();
    return body.map((cells, i) => {
      const row = previewRow(cells, mapping, i + 1);
      const key = importDedupeKey(row.player);
      const duplicate = !row.problem && (existing.has(key) ? 'Already in this league' : seen.has(key) ? 'Repeated in this sheet' : null);
      if (!row.problem) seen.add(key);
      return { ...row, duplicate };
    });
  }, [body, mapping, existing]);

  const isTicked = (r: (typeof preview)[number]) => !r.problem && (overrides[r.sheetRow] ?? !r.duplicate);
  const ticked = preview.filter(isTicked);
  const importable = preview.filter((r) => !r.problem);
  const unreadable = preview.length - importable.length;
  const tooMany = ticked.length > IMPORT_MAX_ROWS;

  async function handleImport() {
    if (ticked.length === 0 || tooMany || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/players/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: ticked.map((r) => r.player) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Failed to import players');
      toast.success(`${json.created} player${json.created === 1 ? '' : 's'} imported`);
      onClose(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import players');
      setSaving(false);
    }
  }

  const close = () => { if (!saving) onClose(false); };

  // Portalled to the body, like the other dialogs opened from the league rail —
  // see AddPlayerFromAccountModal. Mounts only on a click, so there is no
  // server render for this guard to mismatch.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-popover border border-foreground/12 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4.5 h-4.5 text-green-500 shrink-0" />
            <h3 className="font-bold text-lg text-foreground truncate">Import players from Excel</h3>
          </div>
          <button onClick={close} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {!mapping ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upload your registration sheet — an Excel workbook (.xlsx) or a CSV, such as a Google
                Forms export. The first row must be the column headings; only a player name is
                required. You&apos;ll see every card before anything is saved.
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void handleFile(e.dataTransfer.files?.[0]); }}
                disabled={reading}
                className="w-full rounded-2xl border-2 border-dashed border-border hover:border-green-500/50 hover:bg-green-500/5 transition-colors px-6 py-10 flex flex-col items-center gap-2 text-center disabled:opacity-60"
              >
                {reading
                  ? <span className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                  : <Upload className="w-6 h-6 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">{reading ? 'Reading…' : 'Choose a file, or drop it here'}</span>
                <span className="text-xs text-muted-foreground">.xlsx or .csv · first sheet only · up to {IMPORT_MAX_ROWS} players per import</span>
              </button>
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground space-y-1.5">
                <p>
                  <strong className="text-foreground">Columns it understands:</strong> player name, phone number, email, role
                  (Batter / Bowler / All-Rounder / Wicket-Keeper), batting style, bowling style, wicket-keeper (Yes / No).
                  Any other columns are ignored.
                </p>
                <p>A row with an email is linked to that person&apos;s PickBid account, so the card shows on their profile. Photos aren&apos;t imported — add them on each card afterwards.</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                  <button type="button" onClick={() => downloadTemplate('xlsx')} className="inline-flex items-center gap-1.5 font-semibold text-green-600 dark:text-green-400 hover:underline underline-offset-2">
                    <Download className="w-3.5 h-3.5" />Download Excel template (.xlsx)
                  </button>
                  <button type="button" onClick={() => downloadTemplate('csv')} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2">
                    <Download className="w-3.5 h-3.5" />CSV template
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-foreground min-w-0 truncate">
                  <strong>{fileName}</strong>
                  <span className="text-muted-foreground"> · {preview.length} row{preview.length === 1 ? '' : 's'}</span>
                </p>
                <button type="button" onClick={() => fileInput.current?.click()} className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline underline-offset-2">
                  Choose a different file
                </button>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Which column is which</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {IMPORT_FIELDS.map((f) => (
                    <label key={f.key} className="block min-w-0">
                      <span className="block text-xs text-muted-foreground mb-1 truncate">{f.label}{f.required ? ' *' : ''}</span>
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={(e) => setMapping({ ...mapping, [f.key as ImportField]: e.target.value === '' ? null : Number(e.target.value) })}
                        className="w-full h-9 px-2 rounded-lg border border-border bg-input text-xs"
                      >
                        <option value="">— none —</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {mapping.name === null && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />Pick the column that holds the player&apos;s name.
                  </p>
                )}
              </div>

              {mapping.name !== null && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="max-h-[38vh] overflow-auto">
                    <table className="w-full text-xs min-w-160">
                      <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left w-8">
                            <input
                              type="checkbox"
                              aria-label="Select all"
                              checked={importable.length > 0 && ticked.length === importable.length}
                              onChange={(e) => setOverrides(Object.fromEntries(importable.map((r) => [r.sheetRow, e.target.checked])))}
                            />
                          </th>
                          <th className="px-2 py-2 text-left font-semibold">#</th>
                          <th className="px-2 py-2 text-left font-semibold">Name</th>
                          <th className="px-2 py-2 text-left font-semibold">Phone</th>
                          <th className="px-2 py-2 text-left font-semibold">Role</th>
                          <th className="px-2 py-2 text-left font-semibold">Batting</th>
                          <th className="px-2 py-2 text-left font-semibold">Bowling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r) => {
                          const on = isTicked(r);
                          const remark = r.problem ?? r.duplicate ?? (r.notes.length ? r.notes.join('; ') : null);
                          return (
                            <tr key={r.sheetRow} className={`border-t border-border/60 ${on ? '' : 'opacity-55'}`}>
                              <td className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Import row ${r.sheetRow}`}
                                  checked={on}
                                  disabled={!!r.problem}
                                  onChange={(e) => setOverrides((o) => ({ ...o, [r.sheetRow]: e.target.checked }))}
                                />
                              </td>
                              <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{r.sheetRow}</td>
                              <td className="px-2 py-1.5">
                                <span className="font-medium text-foreground">{r.player.name || '—'}</span>
                                {r.player.email && <span className="block text-[11px] text-muted-foreground">{r.player.email}</span>}
                                {remark && (
                                  <span className={`block text-[11px] ${r.problem ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>{remark}</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 tabular-nums text-muted-foreground whitespace-nowrap">{r.player.contactNumber ?? '—'}</td>
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                                {r.player.role}{r.player.isWicketKeeper && r.player.role !== 'Wicket-Keeper Batter' ? ' (WK)' : ''}
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.player.battingType}</td>
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{r.player.bowlingType}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Where a role or style is missing or unreadable, the card gets All-Rounder · Right-Hand Bat · N/A — edit it on the card afterwards.
                {unreadable > 0 && ` ${unreadable} row${unreadable === 1 ? ' has' : 's have'} no name and will be skipped.`}
              </p>
            </>
          )}
        </div>

        {mapping && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-foreground/10">
            <p className={`text-xs ${tooMany ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'}`}>
              {tooMany
                ? `${ticked.length} selected — import at most ${IMPORT_MAX_ROWS} at a time`
                : `${ticked.length} of ${preview.length} selected`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={close} disabled={saving}
                className="px-4 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleImport} disabled={ticked.length === 0 || tooMany || saving || mapping.name === null}
                className="px-4 h-10 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center gap-2">
                {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Import {ticked.length} player{ticked.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
