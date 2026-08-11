'use client';

// Squad pack-opening reveal — a FIFA-Ultimate-Team-style ceremony for a team's
// auction haul. The squad comes out of a glowing team pack one card at a time,
// cheapest to priciest so the marquee buy lands last (icons close the show),
// each card flipping from its back with a holographic treatment scaled to how
// big the winning bid was relative to the rest of the league.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { X, ChevronRight, Sparkles, RotateCcw, Users } from 'lucide-react';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import HoloCard from '@/components/HoloCard';
import { rarityOf, revealOrder, winningBids, RARITY_META, type Rarity } from '@/lib/recap';
import type { LeagueWithPlayers, Player, Team } from '@/lib/types';

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function thumb(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_96,h_96,c_fill,g_auto/');
  }
  return url;
}

const CONFETTI_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ef4444', '#fcd34d', '#34d399'];

/** Pure deterministic pseudo-random in [0,1) — avoids impure Math.random in render */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
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
          animation: `revealConfetti ${p.dur}s cubic-bezier(.3,.6,.5,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}

function RarityChip({ rarity }: { rarity: Rarity }) {
  const meta = RARITY_META[rarity];
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-[2px]"
      style={{ color: meta.color, background: `rgba(${meta.rgb},0.12)`, border: `1px solid rgba(${meta.rgb},0.4)` }}>
      {(rarity === 'legendary' || rarity === 'icon') && <Sparkles className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

type Phase = 'loading' | 'pack' | 'burst' | 'reveal' | 'summary';

export default function SquadRevealPage() {
  const router = useRouter();
  const { id, teamId } = useParams<{ id: string; teamId: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/leagues/${id}`);
        if (!res.ok) { router.push('/'); return; }
        const json: LeagueWithPlayers = await res.json();
        // Same visibility rule as the team page: public leagues are open, private stay creator-only
        if (!json.canManage && !json.isPublic) { router.push(`/leagues/${id}`); return; }
        if (!json.teams.some((t) => t.id === teamId)) { router.push(`/leagues/${id}/teams`); return; }
        setData(json);
        setPhase('pack');
      } catch { router.push(`/leagues/${id}`); }
    })();
  }, [id, teamId, router]);

  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  const team: Team | null = useMemo(() => data?.teams.find((t) => t.id === teamId) ?? null, [data, teamId]);
  const order = useMemo(() => (data ? revealOrder(data.players.filter((p) => p.teamId === teamId)) : []), [data, teamId]);
  const bids = useMemo(() => (data ? winningBids(data.players) : []), [data]);
  const spent = useMemo(() => order.reduce((s, p) => s + (p.soldPrice ?? 0), 0), [order]);

  // Fit the card to the stage, leaving room for the banner and controls
  useEffect(() => {
    function upd() {
      const h = window.innerHeight - 300, w = window.innerWidth - 48;
      setScale(Math.max(0.55, Math.min(h / CARD_H, w / CARD_W, 1.5)));
    }
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const openPack = useCallback(() => {
    setPhase('burst');
    burstTimer.current = setTimeout(() => { setIdx(0); setPhase('reveal'); }, 620);
  }, []);

  const advance = useCallback(() => {
    setIdx((i) => {
      if (i + 1 >= order.length) { setPhase('summary'); return i; }
      return i + 1;
    });
  }, [order.length]);

  function onStageClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-noadvance]')) return;
    if (phase === 'pack') openPack();
    else if (phase === 'reveal') advance();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        if (phase === 'pack') openPack();
        else if (phase === 'reveal') advance();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, openPack, advance]);

  if (phase === 'loading' || !data || !team) {
    return (
      <div className="h-screen flex items-center justify-center bg-[oklch(0.085_0.014_260)]">
        <p className="text-white/40 animate-pulse text-lg">Preparing the pack…</p>
      </div>
    );
  }

  if (order.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-6 bg-[oklch(0.085_0.014_260)] text-white text-center px-6">
        <span className="text-7xl select-none">📦</span>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{team.name}&apos;s pack is empty</h1>
          <p className="text-white/45 mt-2 max-w-sm">No players in this squad yet — the reveal unlocks once the team buys players in the auction.</p>
        </div>
        <button onClick={() => router.push(`/leagues/${id}/teams/${teamId}`)}
          className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors">
          Back to Team
        </button>
      </div>
    );
  }

  const current = order[idx];
  const rarity = current ? rarityOf(current, bids) : 'common';
  const meta = RARITY_META[rarity];
  const W = Math.round(CARD_W * scale), H = Math.round(CARD_H * scale);
  const celebrate = rarity === 'legendary' || rarity === 'icon';

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.085_0.014_260)] text-white overflow-hidden select-none" onClick={onStageClick}>
      <style>{`
        @keyframes revealConfetti{0%{transform:translateY(-10vh) rotate(0);opacity:1}100%{transform:translateY(115vh) rotate(720deg);opacity:.95}}
        @keyframes packFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes packShine{0%{transform:translateX(-160%) skewX(-18deg)}60%,100%{transform:translateX(240%) skewX(-18deg)}}
        @keyframes packGlow{0%,100%{opacity:.45}50%{opacity:.9}}
        @keyframes packBurst{0%{transform:scale(1);opacity:1}100%{transform:scale(1.9);opacity:0;filter:blur(14px)}}
        @keyframes burstFlash{0%{opacity:0}35%{opacity:.9}100%{opacity:0}}
        @keyframes cardEnter{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cardFlip{from{transform:rotateY(180deg)}to{transform:rotateY(0)}}
        @keyframes raysSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes revealUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes revealPop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 relative z-40">
        <button data-noadvance onClick={() => router.push(`/leagues/${id}/teams/${teamId}`)} aria-label="Back to team"
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0 text-sm font-bold">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.colorHex }} />
          <span className="truncate">{team.name}</span>
          {phase === 'reveal' && <span className="text-white/35 tabular-nums shrink-0">· {idx + 1}/{order.length}</span>}
        </div>
        {phase === 'reveal' ? (
          <button data-noadvance onClick={() => setPhase('summary')}
            className="text-xs text-white/40 hover:text-white font-semibold transition-colors shrink-0">
            Skip →
          </button>
        ) : <div className="w-9 shrink-0" />}
      </div>

      {/* Stage */}
      <div className="flex-1 relative min-h-0 flex flex-col items-center justify-center cursor-pointer">
        <div className="absolute -top-24 left-1/4 w-[42vw] h-[42vw] max-w-140 max-h-140 rounded-full blur-[130px] pointer-events-none"
          style={{ background: `${team.colorHex}1f` }} />
        <div className="absolute bottom-0 right-1/5 w-[36vw] h-[36vw] max-w-120 max-h-120 rounded-full blur-[110px] pointer-events-none"
          style={{ background: `${team.colorHex}14` }} />

        {(phase === 'pack' || phase === 'burst') && (
          <PackScreen team={team} logoUrl={data.logoUrl} count={order.length} bursting={phase === 'burst'} />
        )}

        {phase === 'reveal' && current && (
          <div key={current.id} className="relative z-10 flex flex-col items-center gap-5">
            {celebrate && <Confetti />}

            {/* Rays behind the big pulls */}
            {(rarity === 'epic' || celebrate) && (
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ width: W * 1.9, height: W * 1.9 }}>
                <div className="w-full h-full rounded-full" style={{
                  background: `repeating-conic-gradient(rgba(${meta.rgb},0.14) 0deg 10deg, transparent 10deg 26deg)`,
                  filter: 'blur(2px)',
                  maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
                  animation: 'raysSpin 16s linear infinite',
                }} />
              </div>
            )}

            {/* Entry + flip live on ancestors; the scaled card inside never carries an animation */}
            <div style={{ animation: 'cardEnter .45s cubic-bezier(.22,1,.36,1) both' }}>
              <div style={{ width: W, height: H, perspective: 1200 }}>
                <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', animation: 'cardFlip .8s .3s cubic-bezier(.4,0,.2,1) both' }}>
                  {/* Back face */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <CardBack team={team} logoUrl={data.logoUrl} width={W} height={H} radius={16 * scale} />
                  </div>
                  {/* Front face */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                    <HoloCard rarity={rarity} width={W} height={H} radius={16 * scale}>
                      <div style={{ width: W, height: H, overflow: 'hidden', borderRadius: 16 * scale }}>
                        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                          <PlayerCard player={current} templateId={data.templateId} leagueName={data.name}
                            conductedBy={data.conductedBy} logoUrl={data.logoUrl} pdfMode />
                        </div>
                      </div>
                    </HoloCard>
                  </div>
                </div>
              </div>
            </div>

            {/* Rarity + price banner */}
            <div className="relative z-40 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/8 border border-white/15 backdrop-blur"
              style={{ animation: 'revealUp .5s 1s cubic-bezier(.22,1,.36,1) both' }}>
              <RarityChip rarity={rarity} />
              <span className="text-white/25">·</span>
              {current.isIcon && !(current.soldPrice && current.soldPrice > 0) ? (
                <span className="font-black text-amber-300">Pre-assigned Star</span>
              ) : (
                <span className="font-black text-xl text-green-400 tabular-nums">{fmt(current.soldPrice ?? 0)}</span>
              )}
            </div>

            <button data-noadvance onClick={advance}
              className="relative z-40 inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white/85 bg-white/8 hover:bg-white/15 border border-white/15 transition-colors"
              style={{ animation: 'revealUp .5s 1.2s cubic-bezier(.22,1,.36,1) both' }}>
              {idx + 1 >= order.length ? 'Finish' : 'Next card'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'summary' && (
          <SummaryScreen
            team={team} order={order} bids={bids} spent={spent}
            onReplay={() => { setIdx(0); setPhase('pack'); }}
            onTeam={() => router.push(`/leagues/${id}/teams/${teamId}`)}
            onWrapped={() => router.push(`/leagues/${id}/wrapped`)}
          />
        )}
      </div>
    </div>
  );
}

// ── Pack ─────────────────────────────────────────────────────────────────────

function PackScreen({ team, logoUrl, count, bursting }: { team: Team; logoUrl: string; count: number; bursting: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-8">
      {/* Flash when the pack rips */}
      {bursting && (
        <div className="fixed inset-0 z-50 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${team.colorHex}90 0%, transparent 65%)`, animation: 'burstFlash .62s ease-out both' }} />
      )}
      <div style={{ animation: bursting ? 'packBurst .62s cubic-bezier(.4,0,1,1) both' : 'packFloat 3.2s ease-in-out infinite' }}>
        <div className="relative w-60 h-84 rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{
            background: `linear-gradient(165deg, ${team.colorHex} -60%, #0a0f1c 55%, ${team.colorHex}30 130%)`,
            border: `2px solid ${team.colorHex}80`,
            boxShadow: `0 0 70px ${team.colorHex}40, 0 30px 60px rgba(0,0,0,.6)`,
          }}>
          <div className="absolute inset-0 pointer-events-none" style={{ animation: 'packGlow 2.6s ease-in-out infinite', background: `radial-gradient(circle at 50% 0%, ${team.colorHex}35, transparent 60%)` }} />
          {/* Shine sweep */}
          <div className="absolute inset-y-0 w-24 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)', animation: 'packShine 2.8s ease-in-out infinite' }} />
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-16 h-16 rounded-xl object-contain relative" />
          ) : (
            <span className="text-6xl relative select-none">🏏</span>
          )}
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[4px] font-bold text-white/50">Official Squad Pack</p>
            <p className="text-2xl font-black tracking-tight mt-1.5 leading-tight">{team.name}</p>
          </div>
          <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/10 border border-white/20 text-white/80">
            {count} card{count === 1 ? '' : 's'} inside
          </span>
        </div>
      </div>
      {!bursting && (
        <p className="text-white/35 text-[12px] uppercase tracking-[4px] font-bold" style={{ animation: 'packGlow 2.2s ease-in-out infinite' }}>
          Tap to open
        </p>
      )}
    </div>
  );
}

/** The face-down side of every card in the pack. */
function CardBack({ team, logoUrl, width, height, radius }: { team: Team; logoUrl: string; width: number; height: number; radius: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius, overflow: 'hidden', position: 'relative',
      background: `linear-gradient(160deg, #0a0f1c 0%, ${team.colorHex}22 60%, #0a0f1c 100%)`,
      border: `3px solid ${team.colorHex}70`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      boxShadow: '0 24px 60px rgba(0,0,0,.55)',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35,
        background: `repeating-linear-gradient(-45deg, transparent 0 18px, ${team.colorHex}14 18px 36px)`,
      }} />
      <div style={{ position: 'absolute', inset: 10, borderRadius: radius * 0.6, border: `1px solid ${team.colorHex}40`, pointerEvents: 'none' }} />
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, position: 'relative', opacity: 0.9 }} />
      ) : (
        <span style={{ fontSize: 56, position: 'relative' }} className="select-none">🏏</span>
      )}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 800, color: 'rgba(255,255,255,.55)' }}>PickBid</p>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Player Card</p>
      </div>
    </div>
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

function SummaryScreen({ team, order, bids, spent, onReplay, onTeam, onWrapped }: {
  team: Team; order: Player[]; bids: number[]; spent: number;
  onReplay: () => void; onTeam: () => void; onWrapped: () => void;
}) {
  // Priciest first reads better as a roster recap
  const roster = useMemo(() => [...order].reverse(), [order]);
  return (
    <div className="relative z-10 w-full h-full overflow-y-auto">
      <Confetti />
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col items-center gap-5">
        <div className="text-center" style={{ animation: 'revealPop .5s cubic-bezier(.34,1.56,.64,1) both' }}>
          <span className="text-6xl select-none">🎉</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-3">Squad complete!</h2>
          <p className="text-white/45 mt-1.5">
            {order.length} player{order.length === 1 ? '' : 's'}{spent > 0 && <> · <span className="text-green-400 font-bold">{fmt(spent)}</span> spent</>}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2" data-noadvance>
          {roster.map((p, i) => {
            const r = rarityOf(p, bids);
            const meta = RARITY_META[r];
            return (
              <div key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white/5 border text-left"
                style={{ borderColor: `rgba(${meta.rgb},0.35)`, animation: `revealUp .45s ${0.15 + i * 0.07}s cubic-bezier(.22,1,.36,1) both` }}>
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(p.photo)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: `2px solid ${meta.color}` }} />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0" style={{ border: `2px solid ${meta.color}` }}>🏏</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-[11px] text-white/40 truncate">{p.role}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[1.5px] shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                <span className="font-bold tabular-nums text-sm shrink-0 w-20 text-right text-green-400">
                  {p.isIcon && !(p.soldPrice && p.soldPrice > 0) ? '⭐' : fmt(p.soldPrice ?? 0)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pb-4" data-noadvance
          style={{ animation: 'revealUp .5s .4s cubic-bezier(.22,1,.36,1) both' }}>
          <button onClick={onReplay}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-white/80 text-sm font-semibold transition-colors">
            <RotateCcw className="w-4 h-4" />Open again
          </button>
          <button onClick={onTeam}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: team.colorHex }}>
            <Users className="w-4 h-4" />Back to Team
          </button>
          <button onClick={onWrapped}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors">
            <Sparkles className="w-4 h-4" />Auction Wrapped
          </button>
        </div>
      </div>
    </div>
  );
}
