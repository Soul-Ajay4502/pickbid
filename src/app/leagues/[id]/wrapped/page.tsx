'use client';

// "Auction Wrapped" — a Spotify-Wrapped-style, tap-through recap of the
// league's auction: the record buy, top bids, where the money went, the
// bargain of the day, and a shareable summary card at the end.
//
// Deliberately ungated, like /watch: everything shown here (names, teams,
// winning bids) is exactly what the live spectator screen already broadcast,
// and the league API never exposes contact numbers to non-creators. The whole
// point of the page is to be forwarded around after auction night.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Share2, RotateCcw, X, Users } from 'lucide-react';
import { getTemplate } from '@/lib/templates';
import { computeWrapped, teamOf, type WrappedStats, type TeamSpend } from '@/lib/recap';
import { copyToClipboard } from '@/lib/utils';
import type { LeagueWithPlayers, Player } from '@/lib/types';

const SLIDE_MS = 7000;

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Cloudinary crop for slide-sized portraits. */
function portrait(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_500,h_500,c_fill,g_auto/');
  }
  return url;
}

function thumb(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_96,h_96,c_fill,g_auto/');
  }
  return url;
}

/** rAF count-up with ease-out — the Wrapped "number reveals". */
function useCountUp(target: number, duration = 1400): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

type SlideId = 'intro' | 'record' | 'top5' | 'teams' | 'steal' | 'numbers' | 'finale';

export default function WrappedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leagues/${id}`);
        if (!res.ok) { router.push('/'); return; }
        setData(await res.json());
      } catch { router.push(`/leagues/${id}`); }
      finally { setLoaded(true); }
    })();
  }, [id, router]);

  const stats = useMemo(() => (data ? computeWrapped(data) : null), [data]);
  const t = getTemplate(data?.templateId ?? '');

  const slides = useMemo<SlideId[]>(() => {
    if (!stats || stats.soldPlayers.length === 0) return [];
    const s: SlideId[] = ['intro'];
    if (stats.topBuys[0]) s.push('record');
    if (stats.soldPlayers.length >= 3) s.push('top5');
    if (stats.teamSpends.length >= 2) s.push('teams');
    if (stats.steal && stats.steal.id !== stats.topBuys[0]?.id) s.push('steal');
    s.push('numbers', 'finale');
    return s;
  }, [stats]);

  const last = slides.length - 1;
  const next = useCallback(() => setIdx((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  // Stories auto-advance; any manual jump changes idx which re-arms the timer
  useEffect(() => {
    if (slides.length === 0 || idx >= last) return;
    const timer = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [idx, last, next, slides.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Tap right two-thirds → forward, left third → back. Buttons and links tag
  // themselves data-noadvance so using them never flips the slide.
  function onStageClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-noadvance]')) return;
    if (e.clientX / window.innerWidth < 0.3) prev(); else next();
  }

  async function downloadImage(): Promise<Blob | null> {
    const node = shareRef.current;
    if (!node) return null;
    // Same capture recipe as the card PDFs: html2canvas-pro for Tailwind v4's
    // modern colour functions, stylesheets stripped from the clone because the
    // summary card is styled entirely inline.
    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(node, {
      scale: 3, useCORS: true, backgroundColor: null, logging: false,
      onclone: (doc) => doc.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => el.remove()),
    });
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function handleDownload() {
    if (!data) return;
    setExporting(true);
    try {
      const blob = await downloadImage();
      if (!blob) throw new Error();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_wrapped.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not generate the image — please try again');
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!data || !stats) return;
    const url = `${window.location.origin}/leagues/${id}/wrapped`;
    const top = stats.topBuys[0];
    const topTeam = top ? teamOf(top, stats.teamSpends) : null;
    const text =
      `🏏 ${data.name} — Auction Wrapped ${stats.season}\n` +
      `💰 Total spend: ${fmt(stats.totalSpend)}\n` +
      (top ? `👑 Record buy: ${top.name} — ${fmt(top.soldPrice ?? 0)}${topTeam ? ` (${topTeam.name})` : ''}\n` : '') +
      `\n${url}`;
    setExporting(true);
    try {
      if (typeof navigator.share === 'function') {
        // Prefer sharing the rendered image; drop to text if files aren't allowed
        try {
          const blob = await downloadImage();
          if (blob) {
            const file = new File([blob], 'auction-wrapped.png', { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({ files: [file], text });
              return;
            }
          }
        } catch { /* fall through to text share */ }
        await navigator.share({ text });
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch { /* user closed the share sheet */ }
    finally { setExporting(false); }
  }

  async function handleCopyLink() {
    const ok = await copyToClipboard(`${window.location.origin}/leagues/${id}/wrapped`);
    if (ok) toast.success('Wrapped link copied'); else toast.error('Could not copy link');
  }

  if (!loaded || !data || !stats) {
    return (
      <div className="h-screen flex items-center justify-center bg-[oklch(0.085_0.014_260)]">
        <p className="text-white/40 animate-pulse text-lg">Wrapping up the auction…</p>
      </div>
    );
  }

  // No sales recorded yet — nothing to wrap
  if (slides.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-[oklch(0.085_0.014_260)] text-white text-center px-6">
        <span className="text-7xl select-none">🎁</span>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Nothing to wrap yet</h1>
          <p className="text-white/45 mt-2 max-w-sm">
            The Auction Wrapped unlocks once players have been sold. Run the auction, then come back for the story of the night.
          </p>
        </div>
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">
          Back to League
        </button>
      </div>
    );
  }

  const slide = slides[idx];

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.085_0.014_260)] text-white overflow-hidden select-none" onClick={onStageClick}>
      <style>{`
        @keyframes wrapFadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wrapPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
        @keyframes wrapBar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @keyframes storyProgress{from{width:0}to{width:100%}}
        @keyframes wrapOrb{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,-24px) scale(1.12)}}
        @keyframes wrapGlow{0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>

      {/* Story progress bars */}
      <div className="flex gap-1.5 px-4 pt-4 shrink-0 relative z-30">
        {slides.map((s, i) => (
          <div key={s} className="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
            {i < idx && <div className="h-full w-full bg-white/85" />}
            {i === idx && (
              <div key={idx} className="h-full bg-white/85"
                style={idx >= last ? { width: '100%' } : { animation: `storyProgress ${SLIDE_MS}ms linear both` }} />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{data.name}</p>
            <p className="text-[10px] uppercase tracking-[2.5px] text-white/40 font-bold">Auction Wrapped · {stats.season}</p>
          </div>
        </div>
        <button data-noadvance onClick={() => router.push(`/leagues/${id}`)} aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 relative min-h-0 cursor-pointer">
        <div className="absolute -top-24 left-1/4 w-[45vw] h-[45vw] max-w-150 max-h-150 rounded-full blur-[130px] pointer-events-none"
          style={{ background: `rgba(${t.accentRgb},0.10)`, animation: 'wrapOrb 12s ease-in-out infinite' }} />
        <div className="absolute bottom-0 right-1/5 w-[38vw] h-[38vw] max-w-125 max-h-125 rounded-full blur-[110px] pointer-events-none"
          style={{ background: `rgba(${t.accentRgb},0.07)`, animation: 'wrapOrb 14s ease-in-out 3s infinite' }} />

        <div key={slide} className="relative z-10 h-full overflow-y-auto">
          {slide === 'intro' && <IntroSlide data={data} stats={stats} accent={t.borderColor} />}
          {slide === 'record' && <RecordSlide player={stats.topBuys[0]} stats={stats} />}
          {slide === 'top5' && <Top5Slide stats={stats} />}
          {slide === 'teams' && <TeamsSlide stats={stats} />}
          {slide === 'steal' && stats.steal && <StealSlide player={stats.steal} stats={stats} />}
          {slide === 'numbers' && <NumbersSlide data={data} stats={stats} />}
          {slide === 'finale' && (
            <FinaleSlide
              data={data} stats={stats} shareRef={shareRef} exporting={exporting}
              onDownload={handleDownload} onShare={handleShare} onCopyLink={handleCopyLink}
              onReplay={() => setIdx(0)} onSquads={() => router.push(`/leagues/${id}/teams`)}
            />
          )}
        </div>
      </div>

      {/* Tap hint on the first slide */}
      {idx === 0 && (
        <p className="text-center text-white/25 text-[11px] uppercase tracking-[3px] font-bold pb-4 shrink-0 relative z-30"
          style={{ animation: 'wrapGlow 2.4s ease-in-out infinite' }}>
          Tap to continue
        </p>
      )}
    </div>
  );
}

// ── Slides ────────────────────────────────────────────────────────────────────

function SlideShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center text-center gap-6 px-6 py-8 max-w-xl mx-auto">
      {children}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] sm:text-xs uppercase tracking-[5px] font-bold text-white/40"
      style={{ animation: 'wrapFadeUp .5s cubic-bezier(.22,1,.36,1) both' }}>
      {children}
    </p>
  );
}

function PlayerPortrait({ player, ring, size = 160 }: { player: Player; ring: string; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ animation: 'wrapPop .55s .1s cubic-bezier(.34,1.56,.64,1) both' }}>
      <div className="absolute inset-0 rounded-3xl blur-3xl scale-125 pointer-events-none" style={{ background: `${ring}30` }} />
      {player.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portrait(player.photo)} alt={player.name} crossOrigin="anonymous"
          className="relative rounded-3xl object-cover"
          style={{ width: size, height: size, border: `3px solid ${ring}`, boxShadow: `0 12px 48px ${ring}40` }} />
      ) : (
        <div className="relative rounded-3xl flex items-center justify-center text-6xl bg-white/6"
          style={{ width: size, height: size, border: `3px solid ${ring}` }}>
          🏏
        </div>
      )}
    </div>
  );
}

function IntroSlide({ data, stats, accent }: { data: LeagueWithPlayers; stats: WrappedStats; accent: string }) {
  return (
    <SlideShell>
      {data.logoUrl && (
        <div style={{ animation: 'wrapPop .55s cubic-bezier(.34,1.56,.64,1) both' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.logoUrl} alt="" className="w-20 h-20 rounded-2xl object-contain"
            style={{ filter: `drop-shadow(0 0 24px ${accent}60)` }} />
        </div>
      )}
      <Kicker>{stats.season} Season</Kicker>
      <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]"
        style={{ animation: 'wrapFadeUp .55s .1s cubic-bezier(.22,1,.36,1) both' }}>
        {data.name}
      </h1>
      <p className="text-3xl sm:text-4xl font-black text-gradient-gold"
        style={{ animation: 'wrapFadeUp .55s .2s cubic-bezier(.22,1,.36,1) both' }}>
        The Auction, Wrapped
      </p>
      <p className="text-white/45 text-base sm:text-lg" style={{ animation: 'wrapFadeUp .55s .3s cubic-bezier(.22,1,.36,1) both' }}>
        {stats.soldPlayers.length} players sold · {stats.teamSpends.filter((ts) => ts.count > 0).length} squads built · one unforgettable night
      </p>
    </SlideShell>
  );
}

function RecordSlide({ player, stats }: { player: Player; stats: WrappedStats }) {
  const price = useCountUp(player.soldPrice ?? 0);
  const team = teamOf(player, stats.teamSpends);
  return (
    <SlideShell>
      <Kicker>The Record Buy</Kicker>
      <PlayerPortrait player={player} ring="#fbbf24" />
      <div style={{ animation: 'wrapFadeUp .55s .2s cubic-bezier(.22,1,.36,1) both' }}>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight">{player.name}</h2>
        <p className="text-white/45 mt-1">{player.role}</p>
      </div>
      <p className="text-5xl sm:text-7xl font-black text-gradient-gold tabular-nums"
        style={{ animation: 'wrapFadeUp .55s .3s cubic-bezier(.22,1,.36,1) both' }}>
        {fmt(price)}
      </p>
      {team && (
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/8 border border-white/15"
          style={{ animation: 'wrapFadeUp .55s .4s cubic-bezier(.22,1,.36,1) both' }}>
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: team.colorHex }} />
          <span className="font-bold">{team.name}</span>
          <span className="text-white/40 text-sm">won the war</span>
        </div>
      )}
    </SlideShell>
  );
}

function Top5Slide({ stats }: { stats: WrappedStats }) {
  return (
    <SlideShell>
      <Kicker>The Top Buys</Kicker>
      <div className="w-full max-w-md flex flex-col gap-2.5">
        {stats.topBuys.map((p, i) => {
          const team = teamOf(p, stats.teamSpends);
          return (
            <div key={p.id}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/6 border border-white/10 text-left"
              style={{ animation: `wrapFadeUp .5s ${0.12 + i * 0.12}s cubic-bezier(.22,1,.36,1) both` }}>
              <span className={`w-7 text-center font-black tabular-nums text-lg shrink-0 ${i === 0 ? 'text-amber-400' : 'text-white/30'}`}>
                {i + 1}
              </span>
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(p.photo)} alt="" crossOrigin="anonymous" className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0">🏏</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{p.name}</p>
                {team && (
                  <p className="text-xs text-white/40 flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.colorHex }} />{team.name}
                  </p>
                )}
              </div>
              <span className="font-black tabular-nums text-green-400 shrink-0">{fmt(p.soldPrice ?? 0)}</span>
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

function TeamsSlide({ stats }: { stats: WrappedStats }) {
  const maxSpent = Math.max(...stats.teamSpends.map((ts) => ts.spent), 1);
  return (
    <SlideShell>
      <Kicker>Where the Money Went</Kicker>
      <div className="w-full max-w-md flex flex-col gap-3">
        {stats.teamSpends.map((ts, i) => (
          <TeamBar key={ts.id} ts={ts} pct={Math.max(4, Math.round((ts.spent / maxSpent) * 100))} rank={i} />
        ))}
      </div>
      <p className="text-white/35 text-sm" style={{ animation: 'wrapFadeUp .5s .6s cubic-bezier(.22,1,.36,1) both' }}>
        👑 <span className="text-white/70 font-semibold">{stats.teamSpends[0].name}</span> opened the wallet widest
      </p>
    </SlideShell>
  );
}

function TeamBar({ ts, pct, rank }: { ts: TeamSpend; pct: number; rank: number }) {
  return (
    <div className="text-left" style={{ animation: `wrapFadeUp .5s ${0.1 + rank * 0.12}s cubic-bezier(.22,1,.36,1) both` }}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ts.colorHex }} />
          <span className="font-bold text-sm truncate">{ts.name}</span>
          {rank === 0 && <span className="shrink-0">👑</span>}
        </span>
        <span className="text-sm tabular-nums text-white/60 shrink-0">
          {ts.count} players · <span className="text-green-400 font-bold">{fmt(ts.spent)}</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full origin-left"
          style={{ width: `${pct}%`, background: ts.colorHex, animation: `wrapBar .9s ${0.25 + rank * 0.12}s cubic-bezier(.22,1,.36,1) both` }} />
      </div>
    </div>
  );
}

function StealSlide({ player, stats }: { player: Player; stats: WrappedStats }) {
  const team = teamOf(player, stats.teamSpends);
  return (
    <SlideShell>
      <Kicker>Bargain of the Day</Kicker>
      <PlayerPortrait player={player} ring="#4ade80" size={140} />
      <div style={{ animation: 'wrapFadeUp .55s .2s cubic-bezier(.22,1,.36,1) both' }}>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{player.name}</h2>
        <p className="text-white/45 mt-1">{player.role}</p>
      </div>
      <p className="text-5xl sm:text-6xl font-black text-green-400 tabular-nums"
        style={{ animation: 'wrapFadeUp .55s .3s cubic-bezier(.22,1,.36,1) both' }}>
        {fmt(player.soldPrice ?? 0)}
      </p>
      <p className="text-white/45 text-sm sm:text-base max-w-xs" style={{ animation: 'wrapFadeUp .55s .4s cubic-bezier(.22,1,.36,1) both' }}>
        {team ? <><span className="text-white/80 font-semibold">{team.name}</span> got the steal of the auction.</> : 'The steal of the auction.'}
      </p>
    </SlideShell>
  );
}

function NumbersSlide({ data, stats }: { data: LeagueWithPlayers; stats: WrappedStats }) {
  const total = useCountUp(stats.totalSpend, 1600);
  const tiles = [
    { label: 'Players Sold', value: `${stats.soldPlayers.length}/${data.players.length}` },
    { label: 'Average Bid', value: fmt(stats.avgPrice) },
    { label: 'Went Unsold', value: String(stats.unsoldCount) },
    { label: 'Icon Players', value: String(stats.iconCount) },
  ];
  return (
    <SlideShell>
      <Kicker>By the Numbers</Kicker>
      <div style={{ animation: 'wrapFadeUp .55s .1s cubic-bezier(.22,1,.36,1) both' }}>
        <p className="text-white/40 text-xs uppercase tracking-[3px] font-bold mb-2">Total Spend</p>
        <p className="text-5xl sm:text-7xl font-black text-gradient-gold tabular-nums">{fmt(total)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {tiles.map((tile, i) => (
          <div key={tile.label} className="rounded-2xl bg-white/6 border border-white/10 px-4 py-4"
            style={{ animation: `wrapFadeUp .5s ${0.25 + i * 0.1}s cubic-bezier(.22,1,.36,1) both` }}>
            <p className="text-2xl font-black tabular-nums">{tile.value}</p>
            <p className="text-[10px] uppercase tracking-[2px] text-white/40 font-bold mt-1">{tile.label}</p>
          </div>
        ))}
      </div>
      {stats.roleSpends[0] && (
        <p className="text-white/45 text-sm sm:text-base" style={{ animation: 'wrapFadeUp .5s .7s cubic-bezier(.22,1,.36,1) both' }}>
          Most money chased <span className="text-white/85 font-bold">{stats.roleSpends[0].role}s</span> — {fmt(stats.roleSpends[0].spent)} across {stats.roleSpends[0].count} buys
        </p>
      )}
    </SlideShell>
  );
}

// ── Finale + shareable summary card ──────────────────────────────────────────

function FinaleSlide({ data, stats, shareRef, exporting, onDownload, onShare, onCopyLink, onReplay, onSquads }: {
  data: LeagueWithPlayers;
  stats: WrappedStats;
  shareRef: React.RefObject<HTMLDivElement | null>;
  exporting: boolean;
  onDownload: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onReplay: () => void;
  onSquads: () => void;
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-5 px-4 py-6">
      <div style={{ animation: 'wrapPop .55s cubic-bezier(.34,1.56,.64,1) both' }}>
        <ShareCard ref={shareRef} data={data} stats={stats} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5" data-noadvance
        style={{ animation: 'wrapFadeUp .5s .25s cubic-bezier(.22,1,.36,1) both' }}>
        <button onClick={onDownload} disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" />{exporting ? 'Working…' : 'Download'}
        </button>
        <button onClick={onShare} disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
          <Share2 className="w-4 h-4" />Share
        </button>
        <button onClick={onSquads}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-white/80 text-sm font-semibold transition-colors">
          <Users className="w-4 h-4" />Squads
        </button>
        <button onClick={onReplay}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-white/80 text-sm font-semibold transition-colors">
          <RotateCcw className="w-4 h-4" />Replay
        </button>
      </div>
      <button data-noadvance onClick={onCopyLink}
        className="text-white/35 hover:text-white/70 text-xs underline underline-offset-2 transition-colors"
        style={{ animation: 'wrapFadeUp .5s .35s cubic-bezier(.22,1,.36,1) both' }}>
        Copy link to this Wrapped
      </button>
    </div>
  );
}

/**
 * The downloadable/shareable summary. Styled entirely inline (like PlayerCard)
 * so html2canvas can capture it with the app stylesheets stripped.
 */
function ShareCard({ ref, data, stats }: {
  ref: React.RefObject<HTMLDivElement | null>;
  data: LeagueWithPlayers;
  stats: WrappedStats;
}) {
  const t = getTemplate(data.templateId);
  const top = stats.topBuys[0];
  const topTeam = top ? teamOf(top, stats.teamSpends) : null;
  const spender = stats.teamSpends[0];
  const gold = '#fbbf24';
  const label: React.CSSProperties = { color: 'rgba(255,255,255,0.4)', fontSize: 8, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 700 };

  return (
    <div ref={ref} style={{
      width: 340, background: `linear-gradient(160deg, ${t.rootBg} 0%, #05070d 100%)`,
      border: `2px solid ${t.borderColor}`, borderRadius: 20, padding: '22px 22px 16px',
      fontFamily: "'Arial', 'Helvetica', sans-serif", color: '#fff', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: `rgba(${t.accentRgb},0.12)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, position: 'relative' }}>
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.logoUrl} alt="" crossOrigin="anonymous" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 8, background: `rgba(${t.accentRgb},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏏</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.15 }}>{data.name}</div>
          <div style={{ ...label, color: t.awardColor, marginTop: 3 }}>Auction Wrapped · {stats.season}</div>
        </div>
      </div>

      {/* Total spend */}
      <div style={{ textAlign: 'center', padding: '14px 0 16px', borderTop: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
        <div style={label}>Total Spend</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: gold, marginTop: 4 }}>{fmt(stats.totalSpend)}</div>
      </div>

      {/* Record buy */}
      {top && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 10, position: 'relative' }}>
          {top.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(top.photo)} alt="" crossOrigin="anonymous" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${gold}`, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏏</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={label}>👑 Record Buy</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{top.name}</div>
            {topTeam && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: topTeam.colorHex, flexShrink: 0 }} />{topTeam.name}
              </div>
            )}
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: gold, flexShrink: 0 }}>{fmt(top.soldPrice ?? 0)}</div>
        </div>
      )}

      {/* Biggest spender */}
      {spender && spender.spent > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 14, position: 'relative' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: spender.colorHex, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={label}>Biggest Spender</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spender.name}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#4ade80', flexShrink: 0 }}>{fmt(spender.spent)}</div>
        </div>
      )}

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, position: 'relative' }}>
        {[
          { v: String(stats.soldPlayers.length), l: 'Sold' },
          { v: fmt(stats.avgPrice), l: 'Avg Bid' },
          { v: String(stats.teamSpends.filter((ts) => ts.count > 0).length), l: 'Squads' },
          { v: String(stats.unsoldCount), l: 'Unsold' },
        ].map((s) => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '8px 2px', borderRadius: 10, background: `rgba(${t.accentRgb},0.08)`, border: `1px solid rgba(${t.accentRgb},0.18)` }}>
            <div style={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{s.v}</div>
            <div style={{ ...label, fontSize: 7, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, position: 'relative' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>Conducted by {data.conductedBy}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.awardColor, letterSpacing: 1 }}>pickbid.vercel.app</span>
      </div>
    </div>
  );
}
