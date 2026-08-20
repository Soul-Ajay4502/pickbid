'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MessageCircle, Copy, Presentation } from 'lucide-react';
import { toast } from 'sonner';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import Confetti from '@/components/Confetti';
import { buildPlayerSoldMessage, whatsappShareLink, copyToClipboard } from '@/lib/utils';
import type { LiveAuctionState, LivePurse } from '@/lib/types';

// This page is both the projector view in the hall and the phone view for
// spectators, so the type scale can't just be bumped for everyone. `big` is
// projector mode: it scales the chrome up and pushes every muted white
// brighter, because a projector's black level plus ambient light swallows
// anything under ~60% opacity. Layout and card fitting are otherwise unchanged.
const COL_W = { normal: { base: 224, lg: 256 }, big: { base: 288, lg: 320 } };

function fmt(n: number): string {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function PurseTile({ t, big, className = '', onClick }: { t: LivePurse; big: boolean; className?: string; onClick?: () => void }) {
  const bal = t.budget != null ? t.budget - t.spent : null;
  const full = t.maxPlayers != null && t.count >= t.maxPlayers;
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`rounded-xl border ${big ? 'px-4 py-3' : 'px-3 py-2'} ${onClick ? 'cursor-pointer hover:border-white/25 transition-colors' : ''} ${full ? 'border-green-500/25 bg-green-500/5' : big ? 'border-white/20 bg-white/8' : 'border-white/8 bg-white/4'} ${className}`}>
      <div className={`flex items-center gap-1.5 ${big ? 'mb-1.5' : 'mb-1'}`}>
        <div className={`${big ? 'w-3 h-3' : 'w-2 h-2'} rounded-full shrink-0`} style={{ background: t.color }} />
        <span className={`font-semibold truncate flex-1 ${big ? 'text-lg text-white' : 'text-xs text-white/75'}`}>{t.name}</span>
        <span className={`tabular-nums font-bold ${big ? 'text-sm' : 'text-[10px]'} ${full ? 'text-green-400' : big ? 'text-white/70' : 'text-white/40'}`}>
          {t.count}{t.maxPlayers != null && `/${t.maxPlayers}`}
        </span>
      </div>
      <div className={`flex items-center justify-between gap-2 tabular-nums whitespace-nowrap ${big ? 'text-base' : 'text-[11px]'}`}>
        <span className={big ? 'text-white/60' : 'text-white/40'}>Spent <span className={`font-semibold ${big ? 'text-white' : 'text-white/70'}`}>{fmt(t.spent)}</span></span>
        {bal != null && <span className={big ? 'text-white/60' : 'text-white/40'}>Bal <span className="text-green-400 font-semibold">{fmt(bal)}</span></span>}
      </div>
      {t.maxBid != null && (
        <div className={`mt-0.5 flex items-center justify-between gap-2 tabular-nums whitespace-nowrap ${big ? 'text-base' : 'text-[11px]'}`}>
          <span className={big ? 'text-white/60' : 'text-white/40'}>Max/player</span>
          <span className={`font-semibold ${full ? (big ? 'text-white/45' : 'text-white/30') : 'text-amber-300'}`}>{full ? '—' : fmt(t.maxBid)}</span>
        </div>
      )}
    </div>
  );
}

// Mobile: a horizontal strip of all purses below the stage
function PurseStrip({ purses, big, onView }: { purses: LivePurse[]; big: boolean; onView: (t: LivePurse) => void }) {
  return (
    <div className="md:hidden flex gap-2.5 px-4 py-3 border-t border-white/8 bg-white/2 overflow-x-auto shrink-0">
      {purses.map(t => <PurseTile key={t.id} t={t} big={big} className={`${big ? 'min-w-56' : 'min-w-40'} shrink-0`} onClick={() => onView(t)} />)}
    </div>
  );
}

// Desktop (md+): a vertical column of purses flanking the stage
function PurseColumn({ side, purses, big, onView }: { side: 'left' | 'right'; purses: LivePurse[]; big: boolean; onView: (t: LivePurse) => void }) {
  if (purses.length === 0) return null;
  return (
    <aside className={`hidden md:flex ${big ? 'w-72 lg:w-80' : 'w-56 lg:w-64'} shrink-0 flex-col gap-2.5 p-3 overflow-y-auto bg-white/2 border-white/8 ${side === 'left' ? 'border-r' : 'border-l'}`}>
      {purses.map(t => <PurseTile key={t.id} t={t} big={big} className="w-full" onClick={() => onView(t)} />)}
    </aside>
  );
}

// Organizer-only: share a sale to the league's WhatsApp group, with a
// clipboard fallback for other messengers. Price 0 means no recorded sale in
// the live feed (e.g. a pre-assigned icon player), so sharing is disabled.
function SoldShareActions({ playerName, price, teamName }: { playerName: string; price: number; teamName: string }) {
  const disabled = !(price > 0) || !teamName;
  const message = disabled ? '' : buildPlayerSoldMessage({ playerName, soldPrice: price, teamName });
  return (
    <span className="inline-flex items-center gap-1">
      <button
        disabled={disabled}
        onClick={() => window.open(whatsappShareLink(message), '_blank', 'noopener')}
        title={disabled ? 'No sale price recorded' : 'Share to WhatsApp'}
        aria-label={`Share ${playerName}'s sale to WhatsApp`}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
      <button
        disabled={disabled}
        onClick={() => { copyToClipboard(message).then((ok) => { if (ok) toast.success('Sale message copied'); else toast.error('Could not copy'); }); }}
        title={disabled ? 'No sale price recorded' : 'Copy message (for Telegram/SMS)'}
        aria-label={`Copy ${playerName}'s sale message`}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Copy className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// Per-team breakdown — players, prices and purse summary in a table.
// Organizers additionally get per-sale WhatsApp share actions (`canShare`).
function TeamSquadModal({ t, canShare, big, onClose }: { t: LivePurse; canShare: boolean; big: boolean; onClose: () => void }) {
  const bal = t.budget != null ? t.budget - t.spent : null;
  const full = t.maxPlayers != null && t.count >= t.maxPlayers;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-[oklch(0.13_0.02_260)] border border-white/12 rounded-2xl w-full ${big ? 'max-w-2xl' : 'max-w-md'} max-h-[85vh] flex flex-col shadow-2xl text-white`}
        style={{ animation: 'cardDropIn .35s cubic-bezier(.34,1.56,.64,1) both' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
            <h3 className={`font-bold truncate ${big ? 'text-2xl' : 'text-lg'}`}>{t.name}</h3>
            <span className={`tabular-nums shrink-0 ${big ? 'text-base text-white/60' : 'text-xs text-white/40'}`}>{t.count}{t.maxPlayers != null && `/${t.maxPlayers}`}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white shrink-0 text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-2 flex-1">
          {t.players.length === 0 ? (
            <p className={`text-center py-10 ${big ? 'text-lg text-white/60' : 'text-sm text-white/40'}`}>No players bought yet.</p>
          ) : (
            <table className={`w-full ${big ? 'text-lg' : 'text-sm'}`}>
              <thead>
                <tr className={`uppercase tracking-widest border-b border-white/10 ${big ? 'text-xs text-white/55' : 'text-[10px] text-white/30'}`}>
                  <th className="py-2 pr-2 text-left font-bold w-6">#</th>
                  <th className="py-2 text-left font-bold">Player</th>
                  <th className="py-2 pl-2 text-right font-bold">Price</th>
                  {canShare && <th className="py-2 pl-2 text-right font-bold">Share</th>}
                </tr>
              </thead>
              <tbody>
                {t.players.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className={`py-2 pr-2 text-left tabular-nums ${big ? 'text-white/55' : 'text-white/35'}`}>{i + 1}</td>
                    <td className={`py-2 text-left font-medium truncate ${big ? 'text-white' : 'text-white/85'}`}>{p.name}</td>
                    <td className={`py-2 pl-2 text-right tabular-nums ${big ? 'text-white/90' : 'text-white/70'}`}>{fmt(p.price)}</td>
                    {canShare && (
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        <SoldShareActions playerName={p.name} price={p.price} teamName={t.name} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 px-5 py-4 border-t border-white/10 text-center">
          <div><p className={`uppercase tracking-wide mb-0.5 ${big ? 'text-xs text-white/55' : 'text-[10px] text-white/35'}`}>Spent</p><p className={`font-bold tabular-nums ${big ? 'text-xl text-white' : 'text-sm text-white/80'}`}>{fmt(t.spent)}</p></div>
          <div><p className={`uppercase tracking-wide mb-0.5 ${big ? 'text-xs text-white/55' : 'text-[10px] text-white/35'}`}>Balance</p><p className={`font-bold text-green-400 tabular-nums ${big ? 'text-xl' : 'text-sm'}`}>{bal != null ? fmt(bal) : '—'}</p></div>
          <div><p className={`uppercase tracking-wide mb-0.5 ${big ? 'text-xs text-white/55' : 'text-[10px] text-white/35'}`}>Max/player</p><p className={`font-bold text-amber-300 tabular-nums ${big ? 'text-xl' : 'text-sm'}`}>{t.maxBid == null ? '—' : full ? 'Full' : fmt(t.maxBid)}</p></div>
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [live, setLive] = useState<LiveAuctionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1.2);
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  // Projector mode — bigger, higher-contrast chrome for the big screen in the
  // hall. Off by default so phone spectators keep the compact layout.
  const [big, setBig] = useState(false);
  // Organizers (creator or co-organizer) watching along get share actions on
  // every sale; for everyone else the page stays a pure spectator view
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch(`/api/leagues/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((league) => setCanManage(league?.canManage === true))
      .catch(() => { /* stay a spectator */ });
  }, [id]);

  // `?projector=1` lets the machine driving the projector open straight into
  // it; otherwise remember the last choice for this league.
  useEffect(() => {
    let on = false;
    try {
      const q = new URLSearchParams(window.location.search).get('projector');
      on = q != null ? q !== '0' : localStorage.getItem(`watch_projector_${id}`) === '1';
    } catch { /* private mode — stay compact */ }
    // The preference lives in the URL and localStorage, so it can only be
    // read after mount; skip the render entirely in the common (off) case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (on) setBig(true);
  }, [id]);

  const toggleBig = useCallback(() => {
    const next = !big;
    setBig(next);
    try { localStorage.setItem(`watch_projector_${id}`, next ? '1' : '0'); } catch { /* private mode */ }
    // A projector wants the browser chrome gone too — best-effort, and the
    // key press or click is the user gesture the API requires.
    try {
      if (next) void document.documentElement.requestFullscreen().catch(() => { /* blocked */ });
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* blocked */ });
    } catch { /* unsupported */ }
  }, [big, id]);

  // `P` toggles projector mode — whoever is driving the projector machine
  // often can't reach its mouse mid-auction.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'p' && e.key !== 'P') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      toggleBig();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleBig]);

  // Poll the live state — best-effort, every 1.5s
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/leagues/${id}/auction/live`, { cache: 'no-store' });
        if (!res.ok || !active) return;
        const { state } = await res.json();
        if (active) { setLive(state ?? null); setLoaded(true); }
      } catch { /* keep last known state */ }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { active = false; clearInterval(iv); };
  }, [id]);

  const phase = live?.phase;
  const purses = live?.purses ?? [];

  // Split the purses so half flank each side of the stage on desktop
  const purseHalf = Math.ceil(purses.length / 2);
  const leftPurses = purses.slice(0, purseHalf);
  const rightPurses = purses.slice(purseHalf);
  // Look the team up by id each render so the modal stays live as sales come in
  const viewPurse = viewTeamId ? purses.find(p => p.id === viewTeamId) ?? null : null;
  const onViewTeam = (t: LivePurse) => setViewTeamId(t.id);

  // Fit the player card to the viewport, reserving room for the side purse columns on desktop
  useEffect(() => {
    function upd() {
      const cols = window.innerWidth >= 768 && purses.length > 0 ? (purses.length > 1 ? 2 : 1) : 0;
      const col = big ? COL_W.big : COL_W.normal;
      const sideW = cols * (window.innerWidth >= 1024 ? col.lg : col.base);
      // Projector mode usually runs full-screen with no browser chrome, so
      // less vertical room has to be held back for header and sold banner.
      const h = window.innerHeight - (big ? 240 : 280), w = window.innerWidth - 64 - sideW;
      setScale(Math.max(0.5, Math.min(h / CARD_H, w / CARD_W, big ? 3.2 : 2.6)));
    }
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [purses.length, big]);

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.085_0.014_260)] text-white overflow-hidden">
      <style>{`
        @keyframes cardDropIn{from{opacity:0;transform:scale(.82) translateY(-24px);filter:blur(10px)}to{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}
        @keyframes soldStamp{0%{opacity:0;transform:scale(2.4) rotate(-18deg)}55%{opacity:1;transform:scale(.86) rotate(-12deg)}100%{transform:scale(1) rotate(-12deg)}}
        @keyframes bannerUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-6px);opacity:1}}
        @keyframes orb{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-20px) scale(1.1)}}
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-b border-white/8 bg-white/3 backdrop-blur-xl shrink-0">
        <div className="min-w-0">
          <h1 className={`font-black truncate ${big ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'}`}>{live?.league.name ?? 'Live Auction'}</h1>
          {live?.league.conductedBy && <p className={`truncate ${big ? 'text-sm sm:text-lg text-white/65' : 'text-[11px] sm:text-xs text-white/40'}`}>Conducted by {live.league.conductedBy}</p>}
        </div>
        <div className={`flex items-center gap-3 sm:gap-5 font-semibold shrink-0 ${big ? 'text-lg sm:text-2xl' : 'text-sm'}`}>
          {live && (
            <>
              <span className="text-green-400 tabular-nums hidden sm:inline">{live.progress.sold} Sold</span>
              <span className={`tabular-nums hidden sm:inline ${big ? 'text-white/70' : 'text-white/40'}`}>{live.progress.left} Left</span>
              {live.progress.round > 1 && <span className={`text-indigo-400 uppercase tracking-widest ${big ? 'text-lg' : 'text-xs'}`}>Rnd {live.progress.round}</span>}
            </>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold uppercase tracking-wider ${big ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-[11px]'}`}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/70 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Live
          </span>
          <button
            onClick={toggleBig}
            aria-pressed={big}
            title={`${big ? 'Exit' : 'Enter'} projector mode — bigger, higher-contrast text for a big screen (shortcut: P)`}
            aria-label={big ? 'Exit projector mode' : 'Enter projector mode'}
            className={`inline-flex items-center gap-1.5 rounded-xl border transition-colors ${big ? 'px-3.5 py-2 text-base border-green-400/40 bg-green-500/15 text-green-300' : 'px-2.5 py-1.5 text-xs border-white/12 bg-white/5 text-white/50 hover:text-white hover:border-white/25'}`}>
            <Presentation className={big ? 'w-5 h-5' : 'w-4 h-4'} />
            <span className="hidden sm:inline">Projector</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
      {/* Desktop: half the team purses on the left of the stage */}
      <PurseColumn side="left" purses={leftPurses} big={big} onView={onViewTeam} />

      {/* Stage */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4">
        {/* Ambient glow — dropped in projector mode, where big soft gradients
            band badly and eat what little contrast the projector has. */}
        {!big && (
          <>
            <div className="absolute -top-32 left-1/4 w-[40vw] h-[40vw] max-w-150 max-h-150 rounded-full bg-green-500/5 blur-[130px] pointer-events-none" style={{ animation: 'orb 12s ease-in-out infinite' }} />
            <div className="absolute bottom-0 right-1/4 w-[35vw] h-[35vw] max-w-125 max-h-125 rounded-full bg-emerald-400/5 blur-[110px] pointer-events-none" style={{ animation: 'orb 14s ease-in-out 3s infinite' }} />
          </>
        )}

        {!loaded ? (
          <p className={`animate-pulse relative z-10 ${big ? 'text-2xl text-white/70' : 'text-lg text-white/40'}`}>Connecting to the auction…</p>
        ) : !live || phase === 'lobby' ? (
          <WaitScreen big={big} title="Waiting for the auction to begin" subtitle="The big moments are about to start 🏏" />
        ) : phase === 'idle' ? (
          <WaitScreen big={big} title="Up next…" subtitle={live.progress.left > 0 ? `${live.progress.left} players still in the pool` : 'Final calls'} />
        ) : phase === 'picking' ? (
          <PickingScreen big={big} />
        ) : phase === 'done' ? (
          <DoneScreen live={live} leagueId={id} big={big} />
        ) : live.current ? (
          <div className="relative z-10 flex flex-col items-center gap-5">
            {phase === 'sold' && <Confetti key={live.v} />}
            <div className="relative" style={{ width: Math.round(CARD_W * scale), height: Math.round(CARD_H * scale), overflow: 'hidden', animation: 'cardDropIn .55s cubic-bezier(.34,1.56,.64,1) both' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <PlayerCard player={live.current} templateId={live.league.templateId} leagueName={live.league.name} conductedBy={live.league.conductedBy} logoUrl={live.league.logoUrl} pdfMode />
              </div>
              {phase === 'sold' && (
                <div className={`absolute top-3 right-3 z-40 rounded-xl bg-green-500 text-white font-black tracking-wider shadow-2xl ${big ? 'px-6 py-3 text-3xl sm:text-5xl' : 'px-4 py-2 text-xl sm:text-2xl'}`}
                  style={{ animation: 'soldStamp .6s cubic-bezier(.34,1.56,.64,1) both' }}>
                  SOLD
                </div>
              )}
              {phase === 'unsold' && (
                <div className={`absolute top-3 right-3 z-40 rounded-xl bg-amber-500 text-black font-black tracking-wider shadow-2xl ${big ? 'px-6 py-3 text-3xl sm:text-5xl' : 'px-4 py-2 text-xl sm:text-2xl'}`}
                  style={{ animation: 'soldStamp .6s cubic-bezier(.34,1.56,.64,1) both' }}>
                  UNSOLD
                </div>
              )}
            </div>
            {/* {phase === 'showing' && (
              <p className="text-white/35 text-xs sm:text-sm uppercase tracking-[4px] font-bold relative z-10">On the block</p>
            )} */}
            {phase === 'sold' && live.lastSold && (
              <div className="relative z-40 flex flex-col items-center gap-2.5" style={{ animation: 'bannerUp .5s .15s cubic-bezier(.22,1,.36,1) both' }}>
                <div className={`flex items-center gap-3 rounded-2xl border backdrop-blur ${big ? 'px-9 py-4 bg-white/12 border-white/25' : 'px-6 py-3 bg-white/8 border-white/15'}`}>
                  <span className={`${big ? 'w-5 h-5' : 'w-3 h-3'} rounded-full shrink-0`} style={{ background: live.lastSold.teamColor }} />
                  <span className={`font-bold ${big ? 'text-2xl sm:text-4xl' : 'text-base sm:text-xl'}`}>{live.lastSold.teamName}</span>
                  <span className={big ? 'text-white/50' : 'text-white/30'}>·</span>
                  <span className={`font-black text-green-400 tabular-nums ${big ? 'text-3xl sm:text-5xl' : 'text-base sm:text-2xl'}`}>{fmt(live.lastSold.price)}</span>
                </div>
                {/* Organizers following along can announce the sale straight from here */}
                {canManage && (
                  <button
                    onClick={() => window.open(whatsappShareLink(buildPlayerSoldMessage({
                      playerName: live.lastSold!.player.name,
                      soldPrice: live.lastSold!.price,
                      teamName: live.lastSold!.teamName,
                    })), '_blank', 'noopener')}
                    className={`inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-500/25 transition-colors ${big ? 'px-5 py-2.5 text-lg' : 'px-4 py-2 text-sm'}`}>
                    <MessageCircle className={big ? 'w-5 h-5' : 'w-4 h-4'} />
                    Share to WhatsApp
                  </button>
                )}
              </div>
            )}
            {phase === 'unsold' && (
              <div className={`relative z-40 flex items-center gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur ${big ? 'px-9 py-4' : 'px-6 py-3'}`} style={{ animation: 'bannerUp .5s .15s cubic-bezier(.22,1,.36,1) both' }}>
                <span className={`font-black text-amber-400 tracking-wide ${big ? 'text-2xl sm:text-4xl' : 'text-base sm:text-xl'}`}>UNSOLD</span>
                <span className={big ? 'text-white/40' : 'text-white/25'}>·</span>
                <span className={big ? 'text-lg sm:text-2xl text-white/75' : 'text-sm sm:text-base text-white/50'}>No bid — may re-enter a later round</span>
              </div>
            )}
          </div>
        ) : (
          <WaitScreen big={big} title="Up next…" subtitle="" />
        )}
      </main>

      {/* Desktop: the other half of the team purses on the right of the stage */}
      <PurseColumn side="right" purses={rightPurses} big={big} onView={onViewTeam} />
      </div>

      {/* Mobile: team purses as a horizontal strip below the stage */}
      {purses.length > 0 && <PurseStrip purses={purses} big={big} onView={onViewTeam} />}

      {viewPurse && <TeamSquadModal t={viewPurse} canShare={canManage} big={big} onClose={() => setViewTeamId(null)} />}
    </div>
  );
}

function WaitScreen({ title, subtitle, big }: { title: string; subtitle: string; big: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-green-400/20 rounded-full blur-3xl scale-[2.5] animate-pulse pointer-events-none" />
        <span className="relative text-[80px] sm:text-[120px] leading-none select-none" style={{ animation: 'dotBounce 2.4s ease-in-out infinite' }}>🏏</span>
      </div>
      <div>
        <h2 className={`font-black tracking-tight ${big ? 'text-4xl sm:text-6xl' : 'text-2xl sm:text-4xl'}`}>{title}</h2>
        {subtitle && <p className={`mt-2 ${big ? 'text-xl sm:text-3xl text-white/70' : 'text-sm sm:text-lg text-white/40'}`}>{subtitle}</p>}
      </div>
    </div>
  );
}

function PickingScreen({ big }: { big: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-7">
      <p className={`uppercase font-bold ${big ? 'text-lg sm:text-2xl tracking-[8px] text-white/70' : 'text-xs sm:text-sm tracking-[5px] text-white/35'}`}>Selecting next player</p>
      <div className="w-[min(86vw,520px)] rounded-3xl border-2 border-indigo-500/40 bg-linear-to-b from-[rgba(12,10,30,.98)] to-[rgba(20,10,40,.98)] px-10 py-16 text-center relative overflow-hidden"
        style={{ boxShadow: '0 0 56px rgba(124,58,237,.32)' }}>
        <div className="text-5xl sm:text-7xl select-none" style={{ animation: 'dotBounce 1.1s ease-in-out infinite' }}>🎲</div>
      </div>
      <div className="flex gap-2.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-violet-400/70" style={{ animation: `dotBounce .9s ease-in-out ${i * 0.3}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function DoneScreen({ live, leagueId, big }: { live: LiveAuctionState; leagueId: string; big: boolean }) {
  const topTeam = [...live.purses].sort((a, b) => b.spent - a.spent)[0];
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 text-center">
      <Confetti key={`done-${live.v}`} />
      <div className="text-7xl sm:text-8xl select-none" style={{ animation: 'dotBounce 2.4s ease-in-out infinite' }}>🏆</div>
      <div>
        <h2 className={`font-black text-gradient-gold ${big ? 'text-5xl sm:text-7xl' : 'text-3xl sm:text-5xl'}`}>Auction Complete!</h2>
        <p className={`mt-2 ${big ? 'text-2xl sm:text-3xl text-white/80' : 'text-base sm:text-xl text-white/50'}`}>{live.progress.sold} of {live.progress.total} players sold</p>
        {topTeam && topTeam.spent > 0 && (
          <p className={`mt-3 ${big ? 'text-lg sm:text-xl text-white/70' : 'text-sm text-white/40'}`}>Biggest spender · <span className="text-white/90 font-semibold">{topTeam.name}</span> ({fmt(topTeam.spent)})</p>
        )}
      </div>
      <a href={`/leagues/${leagueId}/wrapped`}
        className={`inline-flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black transition-colors shadow-xl shadow-amber-500/25 ${big ? 'px-8 py-4 text-lg sm:text-xl' : 'px-6 py-3 text-sm sm:text-base'}`}>
        ✨ View the Auction Wrapped
      </a>
    </div>
  );
}
