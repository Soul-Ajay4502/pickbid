'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, ImageDown, Loader2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  POSTER_FORMATS,
  POSTER_LIMITS,
  POSTER_MOODS,
  POSTER_TEMPLATES,
  getPosterTemplate,
  paginatePoster,
  type PosterFormat,
  type PosterMatch,
  type PosterMood,
  type PosterTemplateId,
} from '@/lib/fixtures';

/**
 * "Download PNG" for a fixture: pick a template and size, see the real poster,
 * save or share it. The preview is the server's own render of the current
 * settings (debounced), so what you see is byte-for-byte what you download.
 */

export interface PosterSourceMatch {
  teamAId: string;
  teamBId: string;
  round: number;
  date?: string | null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'fixtures';

async function renderPoster(body: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch('/api/fixtures/poster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? 'Could not render the poster');
  }
  return res.blob();
}

function sharingFilesSupported(): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([''], 'poster.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export default function FixturePosterDialog({ teams, matches, defaultTitle, defaultSubtitle = '', className }: {
  teams: { id: string; name: string; color?: string | null }[];
  matches: PosterSourceMatch[];
  defaultTitle: string;
  defaultSubtitle?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<PosterTemplateId>('floodlight');
  const [mood, setMood] = useState<PosterMood | 'all'>('all');
  const shownTemplates = POSTER_TEMPLATES.filter((t) => mood === 'all' || t.mood === mood);
  const activeTemplate = getPosterTemplate(template);
  const [format, setFormat] = useState<PosterFormat>('portrait');
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [canShare, setCanShare] = useState(false);
  // For revoking the last preview's blob URL on unmount.
  const previewRef = useRef(preview);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current.url); }, []);

  // Only teams that actually play, indexed — the request carries indices, not ids.
  const { posterTeams, posterMatches } = useMemo(() => {
    const index = new Map<string, number>();
    for (const t of teams) {
      if (matches.some((m) => m.teamAId === t.id || m.teamBId === t.id)) index.set(t.id, index.size);
    }
    const byId = new Map(teams.map((t) => [t.id, t]));
    return {
      posterTeams: [...index.keys()].map((id) => ({ name: byId.get(id)!.name, color: byId.get(id)!.color ?? null })),
      posterMatches: matches
        .filter((m) => index.has(m.teamAId) && index.has(m.teamBId))
        .map<PosterMatch>((m) => ({ a: index.get(m.teamAId)!, b: index.get(m.teamBId)!, round: m.round, date: m.date ?? null })),
    };
  }, [teams, matches]);

  const pages = useMemo(() => paginatePoster(posterMatches, format).length, [posterMatches, format]);
  const currentPage = Math.min(page, pages);

  const bodyFor = (p: number) => JSON.stringify({ template, format, title, subtitle, teams: posterTeams, matches: posterMatches, page: p });
  const key = bodyFor(currentPage);

  // Live preview: re-render a moment after the settings settle; a newer request
  // cancels an older one so a slow render never overwrites a newer choice.
  const hasPreview = preview !== null;
  const previewKey = preview?.key;
  useEffect(() => {
    if (!open || posterMatches.length === 0 || previewKey === key) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await renderPoster(key, controller.signal);
        const url = URL.createObjectURL(blob);
        setPreview((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { url, blob, key }; });
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not render the poster');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, hasPreview ? 450 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, key, posterMatches.length, previewKey, hasPreview]);

  const fileName = (p: number) => `${slug(title)}-fixtures${pages > 1 ? `-page-${p}` : ''}.png`;

  async function blobForPage(p: number): Promise<Blob> {
    const body = bodyFor(p);
    return preview?.key === body ? preview.blob : renderPoster(body);
  }

  async function download(all: boolean) {
    setBusy('download');
    try {
      const list = all ? Array.from({ length: pages }, (_, i) => i + 1) : [currentPage];
      for (const p of list) {
        const blob = await blobForPage(p);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName(p);
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      toast.success(list.length > 1 ? `${list.length} pages downloaded` : 'Poster downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy('share');
    try {
      const files: File[] = [];
      for (let p = 1; p <= pages; p++) files.push(new File([await blobForPage(p)], fileName(p), { type: 'image/png' }));
      await navigator.share({ files, title: title || 'Fixtures' });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error('Sharing failed — try Download instead');
    } finally {
      setBusy(null);
    }
  }

  const size = POSTER_FORMATS[format];
  const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide';
  const inputClass = 'w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

  return (
    <>
      <button type="button" onClick={() => { setCanShare(sharingFilesSupported()); setOpen(true); }} disabled={posterMatches.length === 0}
        className={className ?? 'inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'}>
        <ImageDown className="w-3.5 h-3.5" />Download PNG
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Desktop: a fixed-height shell where the preview stays put and only
            the options column scrolls, with its actions pinned beneath it.
            Phone: the columns stack and the whole dialog scrolls as one. */}
        <DialogContent className="sm:max-w-5xl p-0 gap-0 flex flex-col max-h-[92vh] overflow-y-auto panel-scroll md:h-[min(860px,92vh)] md:overflow-hidden">
          <div className="shrink-0 px-5 pt-5 pb-3 pr-12">
            <DialogTitle className="text-base font-semibold">Download fixture poster</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Pick a template and size — the preview is the exact image you&apos;ll get.
            </DialogDescription>
          </div>

          <div className="grid gap-5 px-5 pb-5 md:flex-1 md:min-h-0 md:grid-cols-[minmax(0,1fr)_22rem] md:pr-0">
            {/* Preview — never scrolls */}
            <div className="flex flex-col gap-2 min-w-0 md:min-h-0">
              <div className="relative mx-auto w-full max-w-md max-h-[60vh] aspect-(--poster-ratio) rounded-xl overflow-hidden border border-border bg-muted/50 md:max-w-none md:max-h-none md:aspect-auto md:flex-1 md:min-h-0"
                style={{ '--poster-ratio': `${size.width} / ${size.height}` } as React.CSSProperties}>
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element -- a blob: URL, not an optimisable asset
                  <img src={preview.url} alt={`Fixture poster preview, page ${currentPage}`} className="absolute inset-0 h-full w-full object-contain" />
                )}
                {(loading || !preview) && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive bg-background/80">{error}</div>
                )}
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                    aria-label="Previous page" className="rounded-lg border border-border p-1.5 hover:text-foreground disabled:opacity-40">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="tabular-nums">Page {currentPage} of {pages}</span>
                  <button type="button" onClick={() => setPage(Math.min(pages, currentPage + 1))} disabled={currentPage === pages}
                    aria-label="Next page" className="rounded-lg border border-border p-1.5 hover:text-foreground disabled:opacity-40">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Options — the only part that scrolls on desktop */}
            <div className="flex flex-col min-w-0 md:min-h-0 md:border-l md:border-border">
              <div className="flex flex-col gap-4 md:flex-1 md:min-h-0 md:overflow-y-auto panel-scroll md:pl-5 md:pr-3">
                <fieldset>
                  <legend className="sr-only">Template</legend>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={labelClass} aria-hidden="true">Template</span>
                    <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5" role="group" aria-label="Filter templates">
                      {POSTER_MOODS.map((m) => (
                        <button key={m.id} type="button" onClick={() => setMood(m.id)} aria-pressed={mood === m.id}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${mood === m.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {shownTemplates.map((t) => {
                      const selected = t.id === template;
                      return (
                        <button key={t.id} type="button" onClick={() => setTemplate(t.id)} aria-pressed={selected} title={`${t.name} — ${t.tagline}`}
                          className={`text-left rounded-xl border p-1 transition-colors ${selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}>
                          {/* A miniature of the template in its own colours */}
                          <div className="relative h-14 rounded-lg overflow-hidden" style={{ backgroundImage: t.background }}>
                            {t.glows.map((g, i) => <div key={i} className="absolute inset-0" style={{ backgroundImage: g }} />)}
                            <div className="absolute left-1.5 top-1.5 h-0.5 w-5 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />
                            <div className="absolute left-1.5 top-3 h-1.5 w-12 rounded-sm" style={{ backgroundColor: t.text, opacity: 0.9 }} />
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="absolute left-1.5 right-1.5 h-1.5 rounded-sm flex items-center justify-center"
                                style={{ top: 24 + i * 9, backgroundColor: t.row, border: `1px solid ${t.rowBorder}` }}>
                                <div className="h-1 w-2.5 rounded-full" style={{ backgroundImage: t.vsBg }} />
                              </div>
                            ))}
                          </div>
                          <p className="px-0.5 pt-1 text-[11px] font-semibold leading-tight truncate">{t.name}</p>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{activeTemplate.name}</span> — {activeTemplate.tagline}
                  </p>
                </fieldset>

                <fieldset>
                  <legend className={`${labelClass} mb-2`}>Size</legend>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/50 p-1">
                    {(Object.keys(POSTER_FORMATS) as PosterFormat[]).map((f) => (
                      <button key={f} type="button" onClick={() => { setFormat(f); setPage(1); }} aria-pressed={format === f}
                        className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${format === f ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        {POSTER_FORMATS[f].label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{size.hint} · {size.width}×{size.height}</p>
                </fieldset>

                <div className="space-y-1.5">
                  <label htmlFor="poster-title" className={labelClass}>Title</label>
                  <input id="poster-title" value={title} maxLength={POSTER_LIMITS.title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="poster-subtitle" className={labelClass}>Subtitle <span className="normal-case font-normal">(optional)</span></label>
                  <input id="poster-subtitle" value={subtitle} maxLength={POSTER_LIMITS.subtitle} placeholder="e.g. Conducted by …" onChange={(e) => setSubtitle(e.target.value)} className={inputClass} />
                </div>
              </div>

              {/* Actions — pinned under the scrolling options */}
              <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-border shrink-0 md:pl-5 md:pr-5">
                <button type="button" onClick={() => download(false)} disabled={busy !== null || !!error}
                  className="btn-premium inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60">
                  {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {pages > 1 ? `Download page ${currentPage}` : 'Download PNG'}
                </button>
                {pages > 1 && (
                  <button type="button" onClick={() => download(true)} disabled={busy !== null || !!error}
                    className="inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors disabled:opacity-60">
                    <Download className="w-4 h-4" />Download all {pages} pages
                  </button>
                )}
                {canShare && (
                  <button type="button" onClick={share} disabled={busy !== null || !!error}
                    className="inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted/50 transition-colors disabled:opacity-60">
                    {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}Share
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground text-center">Every poster carries the PICKBID watermark.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
