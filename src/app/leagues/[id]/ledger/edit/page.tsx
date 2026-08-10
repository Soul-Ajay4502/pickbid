'use client';

// Organizer-only editor for the league's income & expense sheet.
//
// Draft-first: saving never shares anything, publishing is the separate,
// explicit step that makes the sheet visible to the league's players. Both live
// on one PUT so "edit then publish" is a single request.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, Pencil, Globe, EyeOff, Trash2, ReceiptText, FileText } from 'lucide-react';
import Markdown from '@/components/Markdown';
import type { LeagueWithPlayers, LedgerResponse } from '@/lib/types';

/** Mirrors MAX_CONTENT_LENGTH in the route handler — the server is the real gate. */
const MAX_CONTENT_LENGTH = 100_000;

/**
 * Starter sheet dropped in when an organizer begins with a blank ledger. It's a
 * worked example rather than a form: the numbers and rows are meant to be
 * replaced, and every league's cost lines are different. Right-aligned amount
 * columns (`---:`) get tabular figures when rendered.
 */
function starterTemplate(): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `# Income & Expenses

_Last updated: ${today}_

## Income

| Source | Details | Amount (₹) |
| --- | --- | ---: |
| Team registration | 8 teams × ₹5,000 | 40,000 |
| Player registration | 96 players × ₹200 | 19,200 |
| Title sponsorship | — | 25,000 |
| **Total income** |  | **84,200** |

## Expenses

| Item | Details | Amount (₹) |
| --- | --- | ---: |
| Ground rent | 6 days | 30,000 |
| Umpires | 2 × 12 matches | 12,000 |
| Trophies & medals | — | 9,500 |
| Cricket balls | 24 balls | 7,200 |
| **Total expenses** |  | **58,700** |

## Balance

| | Amount (₹) |
| --- | ---: |
| Total income | 84,200 |
| Total expenses | 58,700 |
| **Balance in hand** | **25,500** |

## Notes

- Amounts are as of the date above and will change as remaining bills come in.
- Any questions, message the organizers in the league group.
`;
}

export default function EditLedgerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState('');
  const [published, setPublished] = useState(false);
  const [exists, setExists] = useState(false);
  /** Last content the server confirmed — the baseline for the unsaved-changes guard */
  const [savedContent, setSavedContent] = useState('');

  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [busy, setBusy] = useState<null | 'save' | 'publish' | 'unpublish' | 'delete'>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = content !== savedContent;

  const fetchData = useCallback(async () => {
    const leagueRes = await fetch(`/api/leagues/${id}`);
    if (!leagueRes.ok) { router.push('/'); return; }
    const leagueJson: LeagueWithPlayers = await leagueRes.json();
    // Editing the accounts is organizers-only; everyone else gets the read view
    if (!leagueJson.canManage) { router.push(`/leagues/${id}/ledger`); return; }
    setLeague(leagueJson);

    const ledgerRes = await fetch(`/api/leagues/${id}/ledger`);
    if (ledgerRes.ok) {
      const json: LedgerResponse = await ledgerRes.json();
      setExists(json.exists);
      setContent(json.ledger?.content ?? '');
      setSavedContent(json.ledger?.content ?? '');
      setPublished(json.ledger?.published ?? false);
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Browser-level guard for closing the tab / hitting back with unsaved edits.
  // In-app navigation is covered by the confirm() in handleBack.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /**
   * One call for every mutation. `nextPublished` left undefined means "save the
   * text, leave the published flag alone" — so a draft stays a draft and a live
   * ledger stays live when its numbers are corrected.
   */
  const save = useCallback(async (
    action: 'save' | 'publish' | 'unpublish',
    nextPublished?: boolean
  ) => {
    if (busy) return;
    if (content.length > MAX_CONTENT_LENGTH) {
      toast.error('Ledger is too long — trim it before saving');
      return;
    }
    // Mirrors the server rule: what matters is whether the *result* would be a
    // published-but-empty sheet, which also covers Ctrl+S on a live ledger
    // whose text has just been cleared.
    const willBePublished = nextPublished !== undefined ? nextPublished : published;
    if (willBePublished && !content.trim()) {
      toast.error('Add some content before publishing — unpublish it instead to hide it');
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/leagues/${id}/ledger`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, ...(nextPublished !== undefined ? { published: nextPublished } : {}) }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        throw new Error(error || 'Save failed');
      }
      const json: LedgerResponse = await res.json();
      setExists(true);
      setSavedContent(json.ledger?.content ?? content);
      setPublished(json.ledger?.published ?? false);
      toast.success(
        action === 'publish'   ? 'Published — the league\'s players can see this now'
        : action === 'unpublish' ? 'Unpublished — back to organizers only'
        : 'Saved'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save ledger');
    } finally {
      setBusy(null);
    }
  }, [busy, content, id, published]);

  async function handleDelete() {
    if (!confirm('Delete this ledger? The income and expense sheet will be removed for everyone.')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/leagues/${id}/ledger`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Ledger deleted');
      router.push(`/leagues/${id}`);
    } catch {
      toast.error('Failed to delete ledger');
      setBusy(null);
    }
  }

  function handleBack() {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    router.push(`/leagues/${id}/ledger`);
  }

  function insertTemplate() {
    const template = starterTemplate();
    setContent((prev) => (prev.trim() ? `${prev.replace(/\s*$/, '')}\n\n${template}` : template));
    setTab('write');
    // Focus after the state flush so the caret lands in the filled textarea
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  // Ctrl/Cmd+S saves the draft, as in any editor — without it the browser opens
  // its "save page" dialog, which is never what's wanted here.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save('save');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  if (loading || !league) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="space-y-3">
          <div className="h-8 w-48 rounded-xl bg-muted shimmer" />
          <div className="h-96 rounded-2xl bg-muted shimmer" />
        </div>
      </div>
    );
  }

  const spinner = <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <div className="mb-6">
        <button onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Ledger
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gradient-green tracking-tight">Edit Ledger</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                published
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                {published ? <><Globe className="w-3 h-3" />Published</> : <><EyeOff className="w-3 h-3" />Draft</>}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{league.name}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <ReceiptText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Write in <span className="font-semibold text-foreground">Markdown</span> — headings, lists and tables all work.
          Nothing is shared until you publish, and only this league&apos;s players and organizers can ever see it.
        </p>
      </div>

      {/* Write / Preview */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40">
          <div className="flex items-center gap-1">
            {(['write', 'preview'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t ? 'bg-card text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {t === 'write' ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {t === 'write' ? 'Write' : 'Preview'}
              </button>
            ))}
          </div>
          <button onClick={insertTemplate} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            title="Insert an example income & expense sheet you can edit">
            <FileText className="w-3 h-3" />Insert template
          </button>
        </div>

        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder={'# Income & Expenses\n\n## Income\n\n| Source | Amount (₹) |\n| --- | ---: |\n| Team registration | 40,000 |\n'}
            className="w-full min-h-[28rem] p-4 sm:p-5 bg-transparent font-mono text-[0.8125rem] leading-relaxed resize-y focus:outline-none"
          />
        ) : (
          <div className="p-5 sm:p-7 min-h-[28rem]">
            {content.trim()
              ? <Markdown content={content} />
              : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{dirty ? 'Unsaved changes' : exists ? 'All changes saved' : 'Not saved yet'}</span>
        <span className={content.length > MAX_CONTENT_LENGTH ? 'text-destructive font-semibold' : ''}>
          {content.length.toLocaleString('en-IN')} / {MAX_CONTENT_LENGTH.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Actions. Two distinct states so it's never ambiguous what a save does:
          a draft saves quietly and publishes as the primary action; a live
          ledger makes saving the primary action, with unpublish as the escape. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {published ? (
          <>
            <button onClick={() => save('save')} disabled={!!busy || !content.trim()}
              className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Update what the league's players see (Ctrl+S)">
              {busy === 'save' ? spinner : <Save className="w-4 h-4" />}Save Changes
            </button>
            <button onClick={() => save('unpublish', false)} disabled={!!busy} className="toolbar-btn"
              title="Hide it from the league's players again">
              {busy === 'unpublish' ? spinner : <EyeOff className="w-3.5 h-3.5" />}Unpublish
            </button>
          </>
        ) : (
          <>
            <button onClick={() => save('save')} disabled={!!busy}
              className="toolbar-btn" title="Save privately — nothing is shared yet (Ctrl+S)">
              {busy === 'save' ? spinner : <Save className="w-3.5 h-3.5" />}Save Draft
            </button>
            <button onClick={() => save('publish', true)} disabled={!!busy || !content.trim()}
              className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Share it with this league's players">
              {busy === 'publish' ? spinner : <Globe className="w-4 h-4" />}Publish to League
            </button>
          </>
        )}

        {exists && (
          <button onClick={handleDelete} disabled={!!busy}
            className="toolbar-btn hover:text-destructive hover:border-destructive/40 ml-auto">
            {busy === 'delete' ? spinner : <Trash2 className="w-3.5 h-3.5" />}Delete Ledger
          </button>
        )}
      </div>
    </div>
  );
}
