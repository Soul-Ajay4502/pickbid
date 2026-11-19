'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Images, FolderOpen, X, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { matchPhotos, type PhotoMatchReason } from '@/lib/photoMatch';
import { checkImageFile, sanitizeFolder, uploadFile } from '@/lib/utils';
import type { Player } from '@/lib/types';

/** Files accepted in one go — a league's worth of photos, not a camera roll. */
const MAX_FILES = 400;
/** Uploads in flight at once: quick on a hall's wifi without flooding it. */
const PARALLEL = 3;

interface Row {
  key: string;
  file: File;
  preview: string;
  /** Why this file can't be uploaded at all (too large), or null. */
  problem: string | null;
  /** The card this photo goes to; '' to leave the file out. */
  playerId: string;
  /** How the automatic match was made — cleared once the organizer picks by hand. */
  reason: PhotoMatchReason | null;
  status: 'ready' | 'uploading' | 'done' | 'failed';
  error?: string;
}

const REASON_LABEL: Record<PhotoMatchReason, string> = {
  phone: 'matched by phone number',
  name: 'matched by name',
  partial: 'close name match — check it',
};

/**
 * Organizer-only: put photos on many cards at once.
 *
 * It exists because of the spreadsheet import — a sheet can't carry pictures,
 * so an imported roster arrives faceless — but it works on any card. The
 * organizer picks a folder (or a handful of files); each file is paired with a
 * player from its file name (`matchPhotos`), every pairing is shown and can be
 * changed or dropped, and only then does anything upload. Each photo goes
 * through the same `/api/upload` and player PUT as a single edit, so it is held
 * to the same size and type limits and the replaced image is cleaned up.
 */
export default function BulkPhotoUploadModal({ leagueId, leagueName, onClose }: {
  leagueId: string;
  leagueName: string;
  /** `changed` is true when at least one photo was saved, so the parent can refetch */
  onClose: (changed: boolean) => void;
}) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  // Read at close time so the last render's previews are the ones revoked
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => () => { rowsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)); }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leagues/${leagueId}/players`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((list: Player[]) => { if (!cancelled) setPlayers(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) { setPlayers([]); toast.error('Could not load the players'); } });
    return () => { cancelled = true; };
  }, [leagueId]);

  // `webkitdirectory` isn't in React's input typings; set it on the element.
  useEffect(() => { folderInput.current?.setAttribute('webkitdirectory', ''); }, []);

  const byId = useMemo(() => new Map((players ?? []).map((p) => [p.id, p])), [players]);
  const sortedPlayers = useMemo(
    () => [...(players ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })),
    [players],
  );

  function addFiles(list: FileList | File[] | null | undefined) {
    if (!list || !players) return;
    const images = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (images.length === 0) { toast.error('No image files in that selection'); return; }
    const room = MAX_FILES - rows.length;
    if (images.length > room) toast.warning(`Only the first ${Math.max(0, room)} of ${images.length} photos were added — ${MAX_FILES} at a time`);
    const incoming = images.slice(0, Math.max(0, room));
    // Match against players no earlier file has already claimed
    const claimed = new Set(rows.map((r) => r.playerId).filter(Boolean));
    const matches = matchPhotos(incoming.map((f) => f.name), players.filter((p) => !claimed.has(p.id)));
    setRows((prev) => [
      ...prev,
      ...incoming.map((file, i): Row => ({
        key: `${Date.now()}-${prev.length + i}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        problem: checkImageFile(file),
        playerId: matches[i]?.playerId ?? '',
        reason: matches[i]?.reason ?? null,
        status: 'ready',
      })),
    ]);
  }

  function assign(key: string, playerId: string) {
    setRows((prev) => prev.map((r) => {
      if (r.key === key) return { ...r, playerId, reason: null };
      // One photo per card: picking a player here takes them off any other row
      return playerId && r.playerId === playerId && r.status !== 'done' ? { ...r, playerId: '', reason: null } : r;
    }));
  }

  function remove(key: string) {
    setRows((prev) => prev.filter((r) => {
      if (r.key === key) URL.revokeObjectURL(r.preview);
      return r.key !== key;
    }));
  }

  /** Will this row upload when Upload is pressed? */
  const willUpload = (r: Row) =>
    r.status !== 'done' && !r.problem && !!r.playerId && (replaceExisting || !byId.get(r.playerId)?.photo);
  const queue = rows.filter(willUpload);
  const unmatched = rows.filter((r) => r.status !== 'done' && !r.problem && !r.playerId).length;
  const skippedExisting = rows.filter((r) => r.status !== 'done' && !r.problem && !!r.playerId && !replaceExisting && !!byId.get(r.playerId)?.photo).length;

  async function handleUpload() {
    if (running || queue.length === 0) return;
    setRunning(true);
    const folder = `${sanitizeFolder(leagueName || leagueId)}/players`;
    const pending = [...queue];
    let saved = 0;
    let failed = 0;
    const patch = (key: string, next: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));

    async function worker() {
      for (let row = pending.shift(); row; row = pending.shift()) {
        patch(row.key, { status: 'uploading', error: undefined });
        try {
          const url = await uploadFile(row.file, folder);
          const res = await fetch(`/api/leagues/${leagueId}/players/${row.playerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: url }),
          });
          if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not save the photo');
          const playerId = row.playerId;
          setPlayers((prev) => prev && prev.map((p) => (p.id === playerId ? { ...p, photo: url } : p)));
          patch(row.key, { status: 'done' });
          saved += 1;
        } catch (err) {
          patch(row.key, { status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' });
          failed += 1;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, pending.length) }, worker));

    setSavedCount((c) => c + saved);
    setRunning(false);
    if (saved > 0) toast.success(`${saved} photo${saved === 1 ? '' : 's'} added`);
    if (failed > 0) toast.error(`${failed} photo${failed === 1 ? '' : 's'} failed — press Upload to retry`);
  }

  const close = () => { if (!running) onClose(savedCount > 0); };
  const withoutPhoto = (players ?? []).filter((p) => !p.photo).length;

  // Portalled to the body, like the other dialogs opened from the league rail.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-popover border border-foreground/12 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (!running) addFiles(e.dataTransfer.files); }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <Images className="w-4.5 h-4.5 text-green-500 shrink-0" />
            <h3 className="font-bold text-lg text-foreground truncate">Bulk photo upload</h3>
            {savedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shrink-0">
                {savedCount} added
              </span>
            )}
          </div>
          <button onClick={close} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <input ref={filesInput} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={folderInput} type="file" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

          <p className="text-sm text-muted-foreground leading-relaxed">
            Choose a folder of player photos, or several files. Each photo is matched to a player by its
            file name — the player&apos;s name (<span className="text-foreground">Arun Kumar.jpg</span>) or phone number
            (<span className="text-foreground">9876543210.jpg</span>). You check every match before anything uploads.
            {players && players.length > 0 && (
              <> <strong className="text-foreground">{withoutPhoto}</strong> of {players.length} players have no photo.</>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!players || running} onClick={() => folderInput.current?.click()} className="toolbar-btn disabled:opacity-50">
              <FolderOpen className="w-3.5 h-3.5" />Choose a folder
            </button>
            <button type="button" disabled={!players || running} onClick={() => filesInput.current?.click()} className="toolbar-btn disabled:opacity-50">
              <Images className="w-3.5 h-3.5" />Choose photos
            </button>
            <span className="self-center text-xs text-muted-foreground">or drop them here · JPG, PNG or WebP, 5MB each</span>
          </div>

          {!players && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading players…</p>}
          {players && players.length === 0 && <p className="text-sm text-muted-foreground">This league has no players yet.</p>}

          {rows.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer w-fit">
                <input type="checkbox" checked={replaceExisting} disabled={running} onChange={(e) => setReplaceExisting(e.target.checked)} />
                Replace photos players already have
              </label>

              <ul className="rounded-xl border border-border divide-y divide-border/60 overflow-hidden">
                {rows.map((r) => {
                  const player = r.playerId ? byId.get(r.playerId) : undefined;
                  const keepsOld = !!player?.photo && !replaceExisting && r.status !== 'done';
                  const note = r.problem
                    ?? (r.status === 'failed' ? r.error
                      : r.status === 'done' ? 'Saved'
                        : !r.playerId ? 'No match — choose the player'
                          : keepsOld ? 'Already has a photo — skipped'
                            : r.reason ? REASON_LABEL[r.reason] : 'Chosen by you');
                  const tone = r.problem || r.status === 'failed' ? 'text-red-600 dark:text-red-400'
                    : r.status === 'done' ? 'text-green-600 dark:text-green-400'
                      : !r.playerId || keepsOld || r.reason === 'partial' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground';
                  return (
                    <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.preview} alt="" className="w-11 h-11 rounded-lg object-cover object-top bg-muted shrink-0" />
                      <div className="min-w-0 flex-1 basis-32">
                        <p className="text-xs font-medium text-foreground truncate" title={r.file.name}>{r.file.name}</p>
                        <p className={`text-[11px] truncate ${tone}`}>{note}</p>
                      </div>
                      <select
                        value={r.playerId}
                        disabled={running || r.status === 'done' || !!r.problem}
                        onChange={(e) => assign(r.key, e.target.value)}
                        aria-label={`Player for ${r.file.name}`}
                        className="h-9 w-40 sm:w-56 px-2 rounded-lg border border-border bg-input text-xs shrink-0 disabled:opacity-60"
                      >
                        <option value="">— skip this photo —</option>
                        {sortedPlayers.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.photo ? ' (has photo)' : ''}</option>
                        ))}
                      </select>
                      <span className="w-6 shrink-0 flex justify-center">
                        {r.status === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          : r.status === 'done' ? <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            : r.status === 'failed' || r.problem ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                              : (
                                <button type="button" onClick={() => remove(r.key)} disabled={running} aria-label={`Remove ${r.file.name}`}
                                  className="text-muted-foreground hover:text-foreground disabled:opacity-40">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-foreground/10">
            <p className="text-xs text-muted-foreground">
              {queue.length} ready
              {unmatched > 0 && <> · <span className="text-amber-600 dark:text-amber-400">{unmatched} unmatched</span></>}
              {skippedExisting > 0 && <> · {skippedExisting} skipped (has a photo)</>}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={close} disabled={running}
                className="px-4 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                {savedCount > 0 && queue.length === 0 ? 'Done' : 'Cancel'}
              </button>
              <button type="button" onClick={handleUpload} disabled={running || queue.length === 0}
                className="px-4 h-10 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center gap-2">
                {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {running ? 'Uploading…' : `Upload ${queue.length} photo${queue.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
