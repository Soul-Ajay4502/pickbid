'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import type { LeagueWithPlayers, Player } from '@/lib/types';
import { toast } from 'sonner';
import { Shuffle } from 'lucide-react';

type Phase = 'loading' | 'lobby' | 'idle' | 'picking' | 'showing' | 'done';

export default function AuctionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  const [pool, setPool] = useState<Player[]>([]);
  const [unsoldQueue, setUnsoldQueue] = useState<Player[]>([]);
  const [soldPlayers, setSoldPlayers] = useState<Player[]>([]);
  const [current, setCurrent] = useState<Player | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [round, setRound] = useState(1);
  const [scale, setScale] = useState(1.4);

  // Slot machine
  const [spinName, setSpinName] = useState('');
  const [spinKey, setSpinKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${id}`);
      if (!res.ok) { router.push('/'); return; }
      const json: LeagueWithPlayers = await res.json();

      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(`creator_league_${id}`);
        if (!token || token !== json.creatorToken) {
          toast.error('Only the league creator can conduct an auction');
          router.push(`/leagues/${id}`);
          return;
        }
      }

      if (json.players.length === 0) {
        toast.error('Add players to the league before starting an auction');
        router.push(`/leagues/${id}`);
        return;
      }

      setLeague(json);
      setPhase('lobby');
    } catch {
      toast.error('Failed to load league');
      router.push(`/leagues/${id}`);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);

  useEffect(() => {
    function updateScale() {
      const h = window.innerHeight - 220;
      const w = window.innerWidth - 80;
      setScale(Math.min(h / CARD_H, w / CARD_W, 2.4));
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Clean up any pending slot timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function startAuction() {
    if (!league) return;
    setPool([...league.players]);
    setUnsoldQueue([]);
    setSoldPlayers([]);
    setCurrent(null);
    setRound(1);
    setPhase('idle');
  }

  function runSlotAnimation(allNames: string[], pickedName: string, onDone: () => void) {
    const others = allNames.filter(n => n !== pickedName);
    const namePool = others.length > 0 ? others : [pickedName];

    // 50-slot sequence; always lands on pickedName
    const seq = Array.from({ length: 50 }, (_, i) =>
      i === 49 ? pickedName : namePool[Math.floor(Math.random() * namePool.length)]
    );

    let delay = 38;
    let i = 0;

    function step() {
      if (delay > 520 || i >= seq.length) {
        setSpinName(pickedName);
        setSpinKey(k => k + 1);
        timerRef.current = setTimeout(onDone, 680);
        return;
      }
      setSpinName(seq[i]);
      setSpinKey(k => k + 1);
      i++;
      delay *= 1.3;
      timerRef.current = setTimeout(step, delay);
    }
    step();
  }

  function pickNext() {
    let pickFrom = pool;

    if (pickFrom.length === 0) {
      if (unsoldQueue.length === 0) { setPhase('done'); return; }
      pickFrom = [...unsoldQueue];
      const nextRound = round + 1;
      setRound(nextRound);
      setUnsoldQueue([]);
      toast.info(`Round ${nextRound} — ${pickFrom.length} unsold player${pickFrom.length !== 1 ? 's' : ''} re-entering`);
    }

    const idx = Math.floor(Math.random() * pickFrom.length);
    const picked = pickFrom[idx];
    setPool(pickFrom.filter((_, i) => i !== idx));
    setPhase('picking');

    runSlotAnimation(pickFrom.map(p => p.name), picked.name, () => {
      setCurrent(picked);
      setPhase('showing');
    });
  }

  function markSold() {
    if (!current) return;
    const newSold = [...soldPlayers, current];
    setSoldPlayers(newSold);
    setCurrent(null);
    setPhase(newSold.length === league!.players.length ? 'done' : 'idle');
  }

  function markUnsold() {
    if (!current) return;
    setUnsoldQueue(prev => [...prev, current!]);
    setCurrent(null);
    setPhase('idle');
  }

  if (loading || !league) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-white/40 animate-pulse text-lg">Loading auction...</div>
      </div>
    );
  }

  const totalPlayers = league.players.length;
  const soldCount = soldPlayers.length;

  // ── Lobby ────────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950 text-white">
        <div className="border-b border-white/10 px-6 py-4">
          <Button variant="ghost" onClick={() => router.push(`/leagues/${id}`)}
            className="text-white/50 hover:text-white hover:bg-white/10">
            ← Back to League
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="text-8xl">🏏</div>
          <div>
            <h1 className="text-4xl font-bold mb-2">{league.name}</h1>
            <p className="text-white/40 text-lg">Player Auction · {totalPlayers} players</p>
            <p className="text-white/30 mt-1">Conducted by {league.conductedBy}</p>
          </div>
          <AuctionCTA onClick={startAuction}>Start Auction</AuctionCTA>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950 text-white">
        <div className="border-b border-white/10 px-6 py-4">
          <Button variant="ghost" onClick={() => router.push(`/leagues/${id}`)}
            className="text-white/50 hover:text-white hover:bg-white/10">
            ← Back to League
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="text-8xl">🏆</div>
          <h2 className="text-4xl font-bold">Auction Complete!</h2>
          <p className="text-white/50 text-xl">{soldCount} of {totalPlayers} players sold</p>

          {soldPlayers.length > 0 && (
            <div className="w-full max-w-2xl text-left">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-4 text-center">Sold Players</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {soldPlayers.map((p, i) => (
                  <div key={p.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div className="text-white/30 text-xs mb-1">#{i + 1}</div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-white/40 text-xs mt-0.5">{p.role}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <Button variant="outline" onClick={startAuction}
              className="border-white/20 text-white hover:bg-white/10">
              Restart Auction
            </Button>
            <Button onClick={() => router.push(`/leagues/${id}`)}
              className="bg-green-600 hover:bg-green-500">
              Back to League
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main auction (idle / picking / showing) ───────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes slotSlideUp {
          from { transform: translateY(32px) scale(0.92); opacity: 0; filter: blur(6px); }
          to   { transform: translateY(0)    scale(1);    opacity: 1; filter: blur(0);   }
        }
        @keyframes ctaGlow {
          0%, 100% { box-shadow: 0 0 28px 4px rgba(99,102,241,0.55), 0 10px 36px rgba(99,102,241,0.35); }
          50%       { box-shadow: 0 0 56px 10px rgba(168,85,247,0.7), 0 10px 56px rgba(99,102,241,0.5); }
        }
        @keyframes panelGlow {
          0%, 100% { border-color: rgba(99,102,241,0.4); box-shadow: 0 0 32px rgba(99,102,241,0.18); }
          50%       { border-color: rgba(168,85,247,0.7); box-shadow: 0 0 56px rgba(168,85,247,0.32); }
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0);   opacity: 0.35; }
          50%       { transform: translateY(-5px); opacity: 1;    }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-gray-950 text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-white/10 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/leagues/${id}`)}
            className="text-white/40 hover:text-white hover:bg-white/10">
            ← League
          </Button>
          <div className="flex items-center gap-5 text-sm font-medium">
            <span className="text-green-400">{soldCount} Sold</span>
            <span className="text-white/20">|</span>
            <span className="text-white/50">{pool.length + unsoldQueue.length} Left</span>
            {unsoldQueue.length > 0 && (
              <><span className="text-white/20">|</span>
                <span className="text-amber-400">{unsoldQueue.length} Unsold</span></>
            )}
            {round > 1 && (
              <><span className="text-white/20">|</span>
                <span className="text-blue-400 text-xs uppercase tracking-widest">Round {round}</span></>
            )}
          </div>
          <div className="text-white/25 text-sm tabular-nums">{soldCount}/{totalPlayers}</div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-auto">

          {/* ── Idle ── */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center gap-5">
              {pool.length === 0 && unsoldQueue.length > 0 && (
                <p className="text-amber-400/70 text-sm">
                  All players shown — {unsoldQueue.length} unsold player{unsoldQueue.length !== 1 ? 's' : ''} will re-enter
                </p>
              )}

              {/* CTA button */}
              <button
                onClick={pickNext}
                style={{
                  position: 'relative',
                  padding: '28px 80px',
                  borderRadius: 24,
                  border: '2px solid rgba(168,85,247,0.5)',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 50%, #4338ca 100%)',
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  animation: 'ctaGlow 2.2s ease-in-out infinite',
                  transition: 'transform 0.1s ease, filter 0.1s ease',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Shuffle size={30} />
                Pick Next Player
              </button>

              <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
                {pool.length + unsoldQueue.length} player{pool.length + unsoldQueue.length !== 1 ? 's' : ''} in pool
              </p>
            </div>
          )}

          {/* ── Picking: slot machine ── */}
          {phase === 'picking' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 520 }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase' }}>
                Selecting Player
              </p>

              {/* Slot panel */}
              <div style={{
                width: '100%',
                borderRadius: 22,
                border: '2px solid rgba(99,102,241,0.4)',
                background: 'linear-gradient(160deg, rgba(12,10,30,0.98) 0%, rgba(20,10,40,0.98) 100%)',
                padding: '48px 40px',
                textAlign: 'center',
                overflow: 'hidden',
                position: 'relative',
                animation: 'panelGlow 1.1s ease-in-out infinite',
              }}>
                {/* Top vignette */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 52,
                  background: 'linear-gradient(to bottom, rgba(12,10,30,1), transparent)',
                  pointerEvents: 'none',
                }} />
                {/* Bottom vignette */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
                  background: 'linear-gradient(to top, rgba(20,10,40,1), transparent)',
                  pointerEvents: 'none',
                }} />

                {/* The cycling name */}
                <div
                  key={spinKey}
                  style={{
                    animation: 'slotSlideUp 0.13s cubic-bezier(0.22,1,0.36,1)',
                    fontSize: 42,
                    fontWeight: 900,
                    color: '#fff',
                    lineHeight: 1.15,
                    textShadow: '0 0 48px rgba(168,85,247,0.8), 0 2px 12px rgba(0,0,0,0.8)',
                    letterSpacing: -0.5,
                  }}
                >
                  {spinName}
                </div>
              </div>

              {/* Bouncing dots */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(168,85,247,0.7)',
                    animation: `dotBounce 0.9s ease-in-out ${i * 0.3}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Showing: player card ── */}
          {phase === 'showing' && current && (
            <>
              <div style={{
                width: Math.round(CARD_W * scale),
                height: Math.round(CARD_H * scale),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
                  <PlayerCard
                    player={current}
                    templateId={league.templateId}
                    leagueName={league.name}
                    conductedBy={league.conductedBy}
                    logoUrl={league.logoUrl}
                    pdfMode
                  />
                </div>
              </div>

              <div className="flex gap-5 shrink-0">
                <Button size="lg" onClick={markUnsold}
                  className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-amber-500/20">
                  Unsold
                </Button>
                <Button size="lg" onClick={markSold}
                  className="bg-green-600 hover:bg-green-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-green-500/20">
                  Sold ✓
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Standalone CTA used on the lobby screen ───────────────────────────────────
function AuctionCTA({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes lobbyCta {
          0%, 100% { box-shadow: 0 0 28px 4px rgba(22,163,74,0.5), 0 10px 36px rgba(22,163,74,0.3); }
          50%       { box-shadow: 0 0 52px 10px rgba(22,163,74,0.7), 0 10px 52px rgba(22,163,74,0.45); }
        }
      `}</style>
      <button
        onClick={onClick}
        style={{
          padding: '24px 64px',
          borderRadius: 22,
          border: '2px solid rgba(34,197,94,0.45)',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #15803d 0%, #16a34a 50%, #15803d 100%)',
          color: '#fff',
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: 0.4,
          animation: 'lobbyCta 2.2s ease-in-out infinite',
          transition: 'transform 0.1s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {children}
      </button>
    </>
  );
}
