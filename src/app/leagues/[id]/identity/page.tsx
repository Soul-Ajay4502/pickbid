'use client';

// The league's document register — organizers only.
//
// Two documents per player, from two different places: the identity proof lives
// on the player's *account* (uploaded once on their profile, reused by every
// league they join), the entry-fee receipt lives on the *card* (paid to this
// league, and to no other). This is the one screen in the app that shows
// either, which is exactly why they never have to appear anywhere else: not on
// the player card, not on a poster, not in a squad PDF. The API is gated on
// `requireLeagueManager`; a 403 here means "you don't run this league", which
// is worth its own message rather than a redirect.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, UserX, FileText, Lock, Search,
  Maximize2, Minimize2, ExternalLink, ReceiptIndianRupee,
  ArrowUpDown, BadgeCheck, Circle, Download, ChevronDown, IndianRupee, Loader2,
  UsersRound, type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { downloadPaymentListPdf, downloadTeamPaymentPdf, partitionByPayment } from '@/lib/paymentPdf';
import type { LeagueDocumentsResponse, PlayerDocuments } from '@/lib/types';
import { cloudinaryImage } from '@/lib/utils';

type DocKind = 'id' | 'payment';

/**
 * How the register is ordered. Registration order is the default because it's
 * the one the organizer watched happen; the two payment orders exist so the
 * names still owing bubble to the top of a long list.
 */
type SortKey = 'added' | 'name' | 'unpaid' | 'paid';

const SORT_LABELS: Record<SortKey, string> = {
  added: 'Registration order',
  name: 'Name (A–Z)',
  unpaid: 'Unpaid first',
  paid: 'Paid first',
};

/**
 * One entry in the Download menu. `build` closes over the register, so the menu
 * can list every PDF the same way whatever arguments each builder takes.
 */
interface DownloadOption {
  key: string;
  label: string;
  hint: string;
  /** How many names the PDF will carry, shown beside the label. */
  count: number;
  icon: LucideIcon;
  /** Tailwind colour classes for the icon. */
  tone: string;
  build: () => Promise<void>;
}

/** What's open in the viewer — which player, and which of their two documents. */
interface Viewing {
  player: PlayerDocuments;
  kind: DocKind;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Cloudinary thumbnail. Player photos are cropped to a square; documents are
 * *fitted* — a full-page ID centre-cropped shows nothing but its blank middle.
 */
function thumb(url: string, mode: 'fill' | 'fit' = 'fill'): string {
  return cloudinaryImage(url, { w: 200, h: 200, mode });
}

function docLabel(kind: DocKind, player: PlayerDocuments): string {
  return kind === 'id' ? (player.idProofType ?? 'ID document') : 'Payment receipt';
}

/**
 * One document cell: the thumbnail when it's there, and otherwise a placeholder
 * that says so. The placeholder goes amber only when this league actually
 * *requires* the document — a blank in a league that never asked for one isn't
 * a gap the organizer needs to chase.
 */
function DocSlot({
  label, url, caption, required, onView,
}: {
  label: string;
  url: string | null;
  caption?: string;
  required: boolean;
  onView: () => void;
}) {
  if (!url) {
    return (
      <div className="w-20 shrink-0 text-center">
        <div className={`w-full h-11 rounded-lg border border-dashed flex items-center justify-center ${
          required ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'
        }`}>
          <span className={`text-[10px] font-semibold ${required ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/50'}`}>
            {required ? 'Missing' : '—'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{label}</p>
      </div>
    );
  }
  return (
    <div className="w-20 shrink-0 text-center">
      <button
        type="button"
        onClick={onView}
        className="w-full rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-green-500/40 transition-all"
        title={`View ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(url, 'fit')} alt={label} className="w-full h-11 object-contain bg-muted" />
      </button>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{caption ?? label}</p>
    </div>
  );
}

/**
 * The organizer's own tick that this player's fee arrived — the one control on
 * this page that writes rather than reads. It sits beside the receipt slot on
 * purpose: an uploaded screenshot is a claim, this is the confirmation, and
 * seeing the two next to each other is the whole point of the register. Sized
 * to match `DocSlot` so the three cells line up.
 */
function PaidToggle({
  paid, busy, onToggle,
}: {
  paid: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="w-20 shrink-0 text-center">
      <button
        type="button"
        role="switch"
        aria-checked={paid}
        aria-label={paid ? 'Entry fee received — click to unmark' : 'Mark entry fee as received'}
        title={paid ? 'Marked paid — click to unmark' : 'Mark the entry fee as received'}
        disabled={busy}
        onClick={onToggle}
        className={`w-full h-11 rounded-lg border flex items-center justify-center gap-1 transition-all duration-200 ${
          busy ? 'opacity-60 cursor-wait' : 'cursor-pointer'
        } ${
          paid
            ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/15'
            : 'border-border bg-card text-muted-foreground hover:border-green-500/40 hover:text-foreground'
        }`}
      >
        {busy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : paid ? <BadgeCheck className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 opacity-50" />}
        <span className="text-[11px] font-bold">{paid ? 'Paid' : 'Unpaid'}</span>
      </button>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">Entry fee</p>
    </div>
  );
}

export default function LeagueDocumentsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<LeagueDocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('added');
  /** Card ids with a payment toggle in flight, so only that row shows a spinner. */
  const [marking, setMarking] = useState<string[]>([]);
  /** `DownloadOption.key` of the PDF being built, so only that row spins. */
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const downloadsRef = useRef<HTMLDivElement>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/leagues/${id}/identity`);
    if (res.status === 401 || res.status === 403) { setForbidden(true); setLoading(false); return; }
    if (!res.ok) { router.push(`/leagues/${id}`); return; }
    setData(await res.json());
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!downloadsOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (downloadsRef.current && !downloadsRef.current.contains(e.target as Node)) setDownloadsOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDownloadsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [downloadsOpen]);

  /** Both switches are the same PATCH on the league, so they share a handler. */
  async function handleToggle(field: 'idProofRequired' | 'paymentProofRequired', next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error('Failed to update the league');
      const key = field === 'idProofRequired' ? 'idRequired' : 'paymentRequired';
      setData((prev) => (prev ? { ...prev, [key]: next } : prev));
      toast.success(
        field === 'idProofRequired'
          ? next ? 'Identity proof is now required' : 'Identity proof is no longer required'
          : next ? 'Payment proof is now required' : 'Payment proof is no longer required'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Tick or untick one player's fee. Applied optimistically and rolled back on
   * failure: the organizer is usually working down a list with a stack of cash
   * in front of them, and a round-trip before every row would make that crawl.
   */
  async function handleTogglePaid(player: PlayerDocuments) {
    const next = !player.paymentReceived;
    const apply = (value: boolean) =>
      setData((prev) => prev && {
        ...prev,
        players: prev.players.map((p) => (p.playerId === player.playerId ? { ...p, paymentReceived: value } : p)),
      });

    setMarking((ids) => [...ids, player.playerId]);
    apply(next);
    try {
      const res = await fetch(`/api/leagues/${id}/identity/${player.playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReceived: next }),
      });
      if (!res.ok) throw new Error('Failed to update payment status');
    } catch (err) {
      apply(!next);
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setMarking((ids) => ids.filter((v) => v !== player.playerId));
    }
  }

  /**
   * Build one of the menu's PDFs. The menu stays open with that row spinning
   * until the file is saved, then closes — the same rhythm as the league
   * page's Share & Export menu.
   */
  async function handleDownload(option: DownloadOption) {
    if (downloading) return;
    setDownloading(option.key);
    try {
      await option.build();
      setDownloadsOpen(false);
      toast.success(`${option.label} downloaded`);
    } catch (err) {
      console.error('Failed to build payment PDF:', err);
      toast.error(err instanceof Error ? err.message : 'Could not build the PDF');
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-3">
        <div className="h-8 bg-muted rounded-xl w-1/2 shimmer" />
        {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 bg-muted rounded-xl shimmer" />)}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <h1 className="text-lg font-bold">Organizers only</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Player documents are visible to this league&apos;s creator and co-organizers.
        </p>
        <button onClick={() => router.push(`/leagues/${id}`)} className="toolbar-btn mt-5 mx-auto">
          <ArrowLeft className="w-3.5 h-3.5" />Back to league
        </button>
      </div>
    );
  }

  if (!data) return null;

  const total = data.players.length;
  const withId = data.players.filter((p) => p.idProofUrl).length;
  const withPayment = data.players.filter((p) => p.paymentProofUrl).length;
  const paidCount = data.players.filter((p) => p.paymentReceived).length;
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? data.players.filter((p) => p.playerName.toLowerCase().includes(needle))
    : data.players;
  // `sort` is stable in every engine this runs on, so equal rows keep the
  // registration order the API sent them in — the payment sorts group without
  // shuffling names inside a group.
  const shown = sort === 'added' ? matched : [...matched].sort((a, b) => {
    if (sort === 'name') return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: 'base' });
    const rank = Number(a.paymentReceived) - Number(b.paymentReceived);
    return sort === 'unpaid' ? rank : -rank;
  });

  const viewedUrl = viewing
    ? (viewing.kind === 'id' ? viewing.player.idProofUrl : viewing.player.paymentProofUrl)
    : null;

  const openDoc = (player: PlayerDocuments, kind: DocKind) => { setViewing({ player, kind }); setZoomed(false); };

  const switches: {
    field: 'idProofRequired' | 'paymentProofRequired';
    on: boolean;
    title: string;
    onCopy: string;
    offCopy: string;
  }[] = [
    {
      field: 'idProofRequired',
      on: data.idRequired,
      title: 'Require an ID to register',
      onCopy: 'Players need an identity proof on their profile before they can add a card.',
      offCopy: 'Players can register without one. Turn this on to make it mandatory.',
    },
    {
      field: 'paymentProofRequired',
      on: data.paymentRequired,
      title: 'Require a payment receipt to register',
      onCopy: 'Players must attach proof of the entry fee when they add their card.',
      offCopy: 'Players can register without paying first. Turn this on to make it mandatory.',
    },
  ];

  // Every list is built from the whole register rather than from `shown` — a
  // search box the organizer forgot to clear must not quietly hand them a short
  // list of who still owes money. The menu's footnote says as much.
  const { leagueName, players, teams } = data;
  const unpaidCount = total - paidCount;
  const flatLists: DownloadOption[] = [
    {
      key: 'paid', label: 'Paid players', hint: 'Everyone marked paid',
      count: paidCount, icon: BadgeCheck, tone: 'text-green-600 dark:text-green-400',
      build: () => downloadPaymentListPdf(leagueName, partitionByPayment(players, 'paid'), 'paid'),
    },
    {
      key: 'unpaid', label: 'Unpaid players', hint: 'Who still owes the entry fee',
      count: unpaidCount, icon: Circle, tone: 'text-amber-600 dark:text-amber-400',
      build: () => downloadPaymentListPdf(leagueName, partitionByPayment(players, 'unpaid'), 'unpaid'),
    },
  ];
  const teamLists: DownloadOption[] = [
    {
      key: 'team-all', label: 'All players by team', hint: 'Every squad, each player marked paid or unpaid',
      count: total, icon: UsersRound, tone: 'text-muted-foreground',
      build: () => downloadTeamPaymentPdf(leagueName, teams, players, 'all'),
    },
    {
      key: 'team-paid', label: 'Paid, by team', hint: 'Settled players under their team',
      count: paidCount, icon: BadgeCheck, tone: 'text-green-600 dark:text-green-400',
      build: () => downloadTeamPaymentPdf(leagueName, teams, players, 'paid'),
    },
    {
      key: 'team-unpaid', label: 'Unpaid, by team', hint: 'Who owes, per team — handy for captains',
      count: unpaidCount, icon: Circle, tone: 'text-amber-600 dark:text-amber-400',
      build: () => downloadTeamPaymentPdf(leagueName, teams, players, 'unpaid'),
    },
  ];

  const renderOption = (option: DownloadOption) => {
    const Icon = option.icon;
    return (
      <button
        key={option.key}
        type="button"
        role="menuitem"
        className="menu-item"
        disabled={downloading !== null}
        onClick={() => handleDownload(option)}
      >
        {downloading === option.key
          ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
          : <Icon className={`w-3.5 h-3.5 shrink-0 ${option.tone}`} />}
        <span className="flex-1 min-w-0">
          <span className="block">{option.label}</span>
          <span className="block text-[11px] text-muted-foreground truncate">{option.hint}</span>
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{option.count}</span>
      </button>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <button onClick={() => router.push(`/leagues/${id}`)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" />{data.leagueName}
      </button>

      <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
        <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-500" />Player Documents
      </h1>
      <p className="text-muted-foreground text-sm mt-1">
        Identity proofs and entry-fee receipts, visible to you and your co-organizers only.
        They never appear on player cards, posters or downloads. Tick a player off once
        their fee lands — cash or transfer, receipt or not.
      </p>

      {/* Requirement switches */}
      <div className="space-y-2 mt-6">
        {switches.map((sw) => (
          <button
            key={sw.field}
            type="button"
            role="switch"
            aria-checked={sw.on}
            disabled={saving}
            onClick={() => handleToggle(sw.field, !sw.on)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
              sw.on ? 'border-green-500/40 bg-green-500/8' : 'border-border bg-card hover:border-primary/30'
            }`}
          >
            <span>
              <span className="block text-sm font-medium text-foreground">{sw.title}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{sw.on ? sw.onCopy : sw.offCopy}</span>
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                sw.on ? 'bg-green-600' : 'bg-muted-foreground/25'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${sw.on ? 'translate-x-5' : 'translate-x-1'}`} />
            </span>
          </button>
        ))}
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground mt-6">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No players yet — the register fills up as cards are added.</p>
        </div>
      ) : (
        <>
          {/* Counts. Receipts and fees are counted separately on purpose: a
              receipt on file is the player's claim, "paid" is what an organizer
              ticked, and a cash payment has the second without the first. */}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <span className={`clay-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              withId === total ? 'text-green-700 dark:text-green-400 bg-green-500/10' : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
            }`}>
              {withId === total ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              {withId}/{total} ID
            </span>
            <span className={`clay-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              withPayment === total ? 'text-green-700 dark:text-green-400 bg-green-500/10' : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
            }`}>
              <ReceiptIndianRupee className="w-3.5 h-3.5" />{withPayment}/{total} receipts
            </span>
            <span className={`clay-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              paidCount === total ? 'text-green-700 dark:text-green-400 bg-green-500/10' : 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
            }`}>
              <IndianRupee className="w-3.5 h-3.5" />{paidCount}/{total} paid
            </span>
          </div>

          {/* Search, sort, and the downloads. The row is `relative` so that on a
              phone — where the Download button can wrap onto a line of its own
              — the menu spans the row instead of hanging off the button and
              running past the screen's left edge. */}
          <div className="relative flex flex-wrap items-center gap-2 mt-3">
            <div className="relative min-w-45 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players…"
                className="w-full h-9 pl-8.5 pr-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort players"
                className="h-9 pl-8.5 pr-3 rounded-xl border border-border bg-card text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/40"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div className="static sm:relative" ref={downloadsRef}>
              <button
                type="button"
                onClick={() => setDownloadsOpen((v) => !v)}
                className="toolbar-btn"
                aria-expanded={downloadsOpen}
                aria-haspopup="menu"
              >
                {downloading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />}
                Download
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${downloadsOpen ? 'rotate-180' : ''}`} />
              </button>
              {downloadsOpen && (
                <div
                  role="menu"
                  aria-label="Download payment lists"
                  className="menu-panel absolute top-full mt-2 left-0 right-0 sm:left-auto sm:w-80 max-h-[70vh] overflow-y-auto p-1.5 z-50"
                >
                  <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Payment lists</p>
                  {flatLists.map(renderOption)}
                  <div className="my-1.5 h-px bg-border/70" />
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Team-wise</p>
                  {teams.length > 0
                    ? teamLists.map(renderOption)
                    : (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Team-wise lists appear once the league has teams.
                      </p>
                    )}
                  <p className="px-3 pt-2 pb-1 mt-1 border-t border-border/70 text-[10px] text-muted-foreground/70">
                    PDFs list every player — search and sort don&apos;t apply.
                  </p>
                </div>
              )}
            </div>
          </div>

          <ul className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60 mt-4">
            {shown.map((p) => (
              <li key={p.playerId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {p.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thumb(p.photo)} alt="" className="w-full h-full object-cover object-top" />
                    : initials(p.playerName)}
                </span>

                <div className="flex-1 min-w-0 basis-36">
                  <p className="text-sm font-semibold truncate">{p.playerName}</p>
                  {/* An unlinked card can never carry an ID — say so, rather than
                      leaving the organizer to chase a player who has no way to
                      submit one. The receipt still works for these cards. */}
                  {!p.linked && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserX className="w-3 h-3 shrink-0" />No account linked — can&apos;t submit an ID
                    </p>
                  )}
                </div>

                {/* The three cells travel as one block, so on a phone they wrap
                    under the name together instead of breaking up mid-row. */}
                <div className="flex items-start gap-2 ml-auto">
                  <DocSlot
                    label="ID"
                    url={p.idProofUrl}
                    caption={p.idProofType ?? 'ID'}
                    required={data.idRequired && p.linked}
                    onView={() => openDoc(p, 'id')}
                  />
                  <DocSlot
                    label="Payment"
                    url={p.paymentProofUrl}
                    required={data.paymentRequired}
                    onView={() => openDoc(p, 'payment')}
                  />
                  <PaidToggle
                    paid={p.paymentReceived}
                    busy={marking.includes(p.playerId)}
                    onToggle={() => handleTogglePaid(p)}
                  />
                </div>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">No player matches “{query}”.</li>
            )}
          </ul>
        </>
      )}

      {/* Document viewer.
          `DialogContent` is a viewport-centred fixed box with no height cap, so
          a full-page scan would otherwise render at its natural size and spill
          off the top and bottom of the screen. The dialog is capped and the
          image fits inside it by default; 1:1 is a click away for reading an ID
          number off a scan, and that's what the inner box scrolls. */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) { setViewing(null); setZoomed(false); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogTitle className="text-base pr-8 truncate shrink-0">
            {viewing?.player.playerName} · {viewing ? docLabel(viewing.kind, viewing.player) : ''}
            {viewing?.kind === 'id' && viewing.player.idSubmittedAt && (
              <span className="font-normal text-muted-foreground"> · {formatDate(viewing.player.idSubmittedAt)}</span>
            )}
          </DialogTitle>

          {viewedUrl && (
            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewedUrl}
                alt={viewing ? `${viewing.player.playerName}'s ${docLabel(viewing.kind, viewing.player)}` : ''}
                onClick={() => setZoomed((v) => !v)}
                className={zoomed
                  ? 'max-w-none cursor-zoom-out'
                  : 'w-full max-h-[70vh] object-contain cursor-zoom-in'}
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-muted-foreground">
              Do not share outside the organizing team.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setZoomed((v) => !v)} className="toolbar-btn">
                {zoomed ? <><Minimize2 className="w-3.5 h-3.5" />Fit</> : <><Maximize2 className="w-3.5 h-3.5" />Actual size</>}
              </button>
              <a href={viewedUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="toolbar-btn">
                <ExternalLink className="w-3.5 h-3.5" />Open
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
