'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import Confetti from '@/components/Confetti';
import { buildPlayerSoldMessage, whatsappShareLink, copyToClipboard } from '@/lib/utils';
import type { LiveAuctionState, LivePurse } from '@/lib/types';

function fmt(n: number): string {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function PurseTile({ t, className = '', onClick }: { t: LivePurse; className?: string; onClick?: () => void }) {
  const bal = t.budget != null ? t.budget - t.spent : null;
  const full = t.maxPlayers != null && t.count >= t.maxPlayers;
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`rounded-xl border px-3 py-2 ${onClick ? 'cursor-pointer hover:border-white/25 transition-colors' : ''} ${full ? 'border-green-500/25 bg-green-500/5' : 'border-white/8 bg-white/4'} ${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
        <span className="text-xs font-semibold text-white/75 truncate flex-1">{t.name}</span>
        <span className={`text-[10px] tabular-nums font-bold ${full ? 'text-green-400' : 'text-white/40'}`}>
          {t.count}{t.maxPlayers != null && `/${t.maxPlayers}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums whitespace-nowrap">
        <span className="text-white/40">Spent <span className="text-white/70 font-semibold">{fmt(t.spent)}</span></span>
        {bal != null && <span className="text-white/40">Bal <span className="text-green-400 font-semibold">{fmt(bal)}</span></span>}
      </div>
      {t.maxBid != null && (
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] tabular-nums whitespace-nowrap">
          <span className="text-white/40">Max/player</span>
          <span className={`font-semibold ${full ? 'text-white/30' : 'text-amber-300'}`}>{full ? '—' : fmt(t.maxBid)}</span>
        </div>
      )}
    </div>
  );
}

// Mobile: a horizontal strip of all purses below the stage
function PurseStrip({ purses, onView }: { purses: LivePurse[]; onView: (t: LivePurse) => void }) {
  return (
    <div className="md:hidden flex gap-2.5 px-4 py-3 border-t border-white/8 bg-white/2 overflow-x-auto shrink-0">
      {purses.map(t => <PurseTile key={t.id} t={t} className="min-w-40 shrink-0" onClick={() => onView(t)} />)}
    </div>
  );
}

// Desktop (md+): a vertical column of purses flanking the stage
function PurseColumn({ side, purses, onView }: { side: 'left' | 'right'; purses: LivePurse[]; onView: (t: LivePurse) => void }) {
  if (purses.length === 0) return null;
  return (
    <aside className={`hidden md:flex w-56 lg:w-64 shrink-0 flex-col gap-2.5 p-3 overflow-y-auto bg-white/2 border-white/8 ${side === 'left' ? 'border-r' : 'border-l'}`}>
      {purses.map(t => <PurseTile key={t.id} t={t} className="w-full" onClick={() => onView(t)} />)}
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
function TeamSquadModal({ t, canShare, onClose }: { t: LivePurse; canShare: boolean; onClose: () => void }) {
  const bal = t.budget != null ? t.budget - t.spent : null;
  const full = t.maxPlayers != null && t.count >= t.maxPlayers;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[oklch(0.13_0.02_260)] border border-white/12 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl text-white"
        style={{ animation: 'cardDropIn .35s cubic-bezier(.34,1.56,.64,1) both' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
            <h3 className="font-bold text-lg truncate">{t.name}</h3>
            <span className="text-xs text-white/40 tabular-nums shrink-0">{t.count}{t.maxPlayers != null && `/${t.maxPlayers}`}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white shrink-0 text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-2 flex-1">
          {t.players.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-10">No players bought yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-white/30 border-b border-white/10">
                  <th className="py-2 pr-2 text-left font-bold w-6">#</th>
                  <th className="py-2 text-left font-bold">Player</th>
                  <th className="py-2 pl-2 text-right font-bold">Price</th>
                  {canShare && <th className="py-2 pl-2 text-right font-bold">Share</th>}
                </tr>
              </thead>
              <tbody>
                {t.players.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-2 text-left tabular-nums text-white/35">{i + 1}</td>
                    <td className="py-2 text-left font-medium text-white/85 truncate">{p.name}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-white/70">{fmt(p.price)}</td>
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
          <div><p className="text-[10px] uppercase tracking-wide text-white/35 mb-0.5">Spent</p><p className="text-sm font-bold text-white/80 tabular-nums">{fmt(t.spent)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-white/35 mb-0.5">Balance</p><p className="text-sm font-bold text-green-400 tabular-nums">{bal != null ? fmt(bal) : '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-white/35 mb-0.5">Max/player</p><p className="text-sm font-bold text-amber-300 tabular-nums">{t.maxBid == null ? '—' : full ? 'Full' : fmt(t.maxBid)}</p></div>
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
  // Organizers (creator or co-organizer) watching along get share actions on
  // every sale; for everyone else the page stays a pure spectator view
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    fetch(`/api/leagues/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((league) => setCanManage(league?.canManage === true))
      .catch(() => { /* stay a spectator */ });
  }, [id]);

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
      const sideW = cols * (window.innerWidth >= 1024 ? 256 : 224);
      const h = window.innerHeight - 280, w = window.innerWidth - 64 - sideW;
      setScale(Math.max(0.5, Math.min(h / CARD_H, w / CARD_W, 2.6)));
    }
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [purses.length]);

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
          <h1 className="text-base sm:text-xl font-black truncate">{live?.league.name ?? 'Live Auction'}</h1>
          {live?.league.conductedBy && <p className="text-[11px] sm:text-xs text-white/40 truncate">Conducted by {live.league.conductedBy}</p>}
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-sm font-semibold shrink-0">
          {live && (
            <>
              <span className="text-green-400 tabular-nums hidden sm:inline">{live.progress.sold} Sold</span>
              <span className="text-white/40 tabular-nums hidden sm:inline">{live.progress.left} Left</span>
              {live.progress.round > 1 && <span className="text-indigo-400 text-xs uppercase tracking-widest">Rnd {live.progress.round}</span>}
            </>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/70 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Live
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
      {/* Desktop: half the team purses on the left of the stage */}
      <PurseColumn side="left" purses={leftPurses} onView={onViewTeam} />

      {/* Stage */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4">
        <div className="absolute -top-32 left-1/4 w-[40vw] h-[40vw] max-w-150 max-h-150 rounded-full bg-green-500/5 blur-[130px] pointer-events-none" style={{ animation: 'orb 12s ease-in-out infinite' }} />
        <div className="absolute bottom-0 right-1/4 w-[35vw] h-[35vw] max-w-125 max-h-125 rounded-full bg-emerald-400/5 blur-[110px] pointer-events-none" style={{ animation: 'orb 14s ease-in-out 3s infinite' }} />

        {!loaded ? (
          <p className="text-white/40 animate-pulse text-lg relative z-10">Connecting to the auction…</p>
        ) : !live || phase === 'lobby' ? (
          <WaitScreen title="Waiting for the auction to begin" subtitle="The big moments are about to start 🏏" />
        ) : phase === 'idle' ? (
          <WaitScreen title="Up next…" subtitle={live.progress.left > 0 ? `${live.progress.left} players still in the pool` : 'Final calls'} />
        ) : phase === 'picking' ? (
          <PickingScreen />
        ) : phase === 'done' ? (
          <DoneScreen live={live} leagueId={id} />
        ) : live.current ? (
          <div className="relative z-10 flex flex-col items-center gap-5">
            {phase === 'sold' && <Confetti key={live.v} />}
            <div className="relative" style={{ width: Math.round(CARD_W * scale), height: Math.round(CARD_H * scale), overflow: 'hidden', animation: 'cardDropIn .55s cubic-bezier(.34,1.56,.64,1) both' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <PlayerCard player={live.current} templateId={live.league.templateId} leagueName={live.league.name} conductedBy={live.league.conductedBy} logoUrl={live.league.logoUrl} pdfMode />
              </div>
              {phase === 'sold' && (
                <div className="absolute top-3 right-3 z-40 px-4 py-2 rounded-xl bg-green-500 text-white font-black text-xl sm:text-2xl tracking-wider shadow-2xl"
                  style={{ animation: 'soldStamp .6s cubic-bezier(.34,1.56,.64,1) both' }}>
                  SOLD
                </div>
              )}
              {phase === 'unsold' && (
                <div className="absolute top-3 right-3 z-40 px-4 py-2 rounded-xl bg-amber-500 text-black font-black text-xl sm:text-2xl tracking-wider shadow-2xl"
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
                <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/8 border border-white/15 backdrop-blur">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: live.lastSold.teamColor }} />
                  <span className="text-base sm:text-xl font-bold">{live.lastSold.teamName}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-base sm:text-2xl font-black text-green-400 tabular-nums">{fmt(live.lastSold.price)}</span>
                </div>
                {/* Organizers following along can announce the sale straight from here */}
                {canManage && (
                  <button
                    onClick={() => window.open(whatsappShareLink(buildPlayerSoldMessage({
                      playerName: live.lastSold!.player.name,
                      soldPrice: live.lastSold!.price,
                      teamName: live.lastSold!.teamName,
                    })), '_blank', 'noopener')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-lg shadow-green-500/25 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    Share to WhatsApp
                  </button>
                )}
              </div>
            )}
            {phase === 'unsold' && (
              <div className="relative z-40 flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur" style={{ animation: 'bannerUp .5s .15s cubic-bezier(.22,1,.36,1) both' }}>
                <span className="text-base sm:text-xl font-black text-amber-400 tracking-wide">UNSOLD</span>
                <span className="text-white/25">·</span>
                <span className="text-sm sm:text-base text-white/50">No bid — may re-enter a later round</span>
              </div>
            )}
          </div>
        ) : (
          <WaitScreen title="Up next…" subtitle="" />
        )}
      </main>

      {/* Desktop: the other half of the team purses on the right of the stage */}
      <PurseColumn side="right" purses={rightPurses} onView={onViewTeam} />
      </div>

      {/* Mobile: team purses as a horizontal strip below the stage */}
      {purses.length > 0 && <PurseStrip purses={purses} onView={onViewTeam} />}

      {viewPurse && <TeamSquadModal t={viewPurse} canShare={canManage} onClose={() => setViewTeamId(null)} />}
    </div>
  );
}

function WaitScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 bg-green-400/20 rounded-full blur-3xl scale-[2.5] animate-pulse pointer-events-none" />
        <span className="relative text-[80px] sm:text-[120px] leading-none select-none" style={{ animation: 'dotBounce 2.4s ease-in-out infinite' }}>🏏</span>
      </div>
      <div>
        <h2 className="text-2xl sm:text-4xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="text-white/40 text-sm sm:text-lg mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

function PickingScreen() {
  return (
    <div className="relative z-10 flex flex-col items-center gap-7">
      <p className="text-white/35 text-xs sm:text-sm uppercase tracking-[5px] font-bold">Selecting next player</p>
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

function DoneScreen({ live, leagueId }: { live: LiveAuctionState; leagueId: string }) {
  const topTeam = [...live.purses].sort((a, b) => b.spent - a.spent)[0];
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 text-center">
      <Confetti key={`done-${live.v}`} />
      <div className="text-7xl sm:text-8xl select-none" style={{ animation: 'dotBounce 2.4s ease-in-out infinite' }}>🏆</div>
      <div>
        <h2 className="text-3xl sm:text-5xl font-black text-gradient-gold">Auction Complete!</h2>
        <p className="text-white/50 text-base sm:text-xl mt-2">{live.progress.sold} of {live.progress.total} players sold</p>
        {topTeam && topTeam.spent > 0 && (
          <p className="text-white/40 text-sm mt-3">Biggest spender · <span className="text-white/80 font-semibold">{topTeam.name}</span> ({fmt(topTeam.spent)})</p>
        )}
      </div>
      <a href={`/leagues/${leagueId}/wrapped`}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm sm:text-base transition-colors shadow-xl shadow-amber-500/25">
        ✨ View the Auction Wrapped
      </a>
    </div>
  );
}
