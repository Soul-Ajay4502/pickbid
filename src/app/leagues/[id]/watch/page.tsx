'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import type { LiveAuctionState, LivePurse } from '@/lib/types';

function fmt(n: number): string {
  if (!n) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const CONFETTI_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ef4444', '#fcd34d', '#34d399'];

/** Pure deterministic pseudo-random in [0,1) — avoids impure Math.random in render */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: rand(i + 1) * 100,
      delay: rand(i + 2.3) * 0.5,
      dur: 2.2 + rand(i + 5.1) * 1.8,
      color: CONFETTI_COLORS[Math.floor(rand(i + 7.7) * CONFETTI_COLORS.length)],
      size: 7 + rand(i + 9.2) * 8,
      rot: rand(i + 11.4) * 360,
    })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', top: '-5vh', left: `${p.left}%`, width: p.size, height: p.size * 0.6,
          background: p.color, borderRadius: 2, transform: `rotate(${p.rot}deg)`,
          animation: `confettiFall ${p.dur}s cubic-bezier(.3,.6,.5,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

function PurseStrip({ purses }: { purses: LivePurse[] }) {
  return (
    <div className="flex gap-2.5 px-4 py-3 border-t border-white/8 bg-white/2 overflow-x-auto shrink-0">
      {purses.map(t => {
        const bal = t.budget != null ? t.budget - t.spent : null;
        const full = t.maxPlayers != null && t.count >= t.maxPlayers;
        return (
          <div key={t.id} className={`min-w-40 shrink-0 rounded-xl border px-3 py-2 ${full ? 'border-green-500/25 bg-green-500/5' : 'border-white/8 bg-white/4'}`}>
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
          </div>
        );
      })}
    </div>
  );
}

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [live, setLive] = useState<LiveAuctionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1.2);

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

  // Fit the player card to the viewport
  useEffect(() => {
    function upd() {
      const h = window.innerHeight - 280, w = window.innerWidth - 64;
      setScale(Math.max(0.5, Math.min(h / CARD_H, w / CARD_W, 2.6)));
    }
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const phase = live?.phase;
  const purses = live?.purses ?? [];

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.085_0.014_260)] text-white overflow-hidden">
      <style>{`
        @keyframes confettiFall { 0%{transform:translateY(-10vh) rotate(0);opacity:1} 100%{transform:translateY(115vh) rotate(720deg);opacity:.95} }
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
          <DoneScreen live={live} />
        ) : live.current ? (
          <div className="relative z-10 flex flex-col items-center gap-5">
            {phase === 'sold' && <Confetti key={live.v} />}
            <div className="relative" style={{ width: Math.round(CARD_W * scale), height: Math.round(CARD_H * scale) }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', animation: 'cardDropIn .55s cubic-bezier(.34,1.56,.64,1) both' }}>
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
              <div className="relative z-40 flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/8 border border-white/15 backdrop-blur" style={{ animation: 'bannerUp .5s .15s cubic-bezier(.22,1,.36,1) both' }}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: live.lastSold.teamColor }} />
                <span className="text-base sm:text-xl font-bold">{live.lastSold.teamName}</span>
                <span className="text-white/30">·</span>
                <span className="text-base sm:text-2xl font-black text-green-400 tabular-nums">{fmt(live.lastSold.price)}</span>
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

      {/* Team purses */}
      {purses.length > 0 && <PurseStrip purses={purses} />}
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

function DoneScreen({ live }: { live: LiveAuctionState }) {
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
    </div>
  );
}
