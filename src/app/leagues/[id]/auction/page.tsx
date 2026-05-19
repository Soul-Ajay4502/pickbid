'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import type { LeagueWithPlayers, Player } from '@/lib/types';
import { toast } from 'sonner';

type Phase = 'loading' | 'lobby' | 'idle' | 'picking' | 'showing' | 'done';

export default function AuctionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  // Auction state
  const [pool, setPool] = useState<Player[]>([]);
  const [unsoldQueue, setUnsoldQueue] = useState<Player[]>([]);
  const [soldPlayers, setSoldPlayers] = useState<Player[]>([]);
  const [current, setCurrent] = useState<Player | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [round, setRound] = useState(1);
  const [scale, setScale] = useState(1.4);

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

  function startAuction() {
    if (!league) return;
    setPool([...league.players]);
    setUnsoldQueue([]);
    setSoldPlayers([]);
    setCurrent(null);
    setRound(1);
    setPhase('idle');
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

    setPhase('picking');
    const captured = pickFrom;
    setTimeout(() => {
      const idx = Math.floor(Math.random() * captured.length);
      const picked = captured[idx];
      setPool(captured.filter((_, i) => i !== idx));
      setCurrent(picked);
      setPhase('showing');
    }, 900);
  }

  function markSold() {
    if (!current) return;
    const newSold = [...soldPlayers, current];
    setSoldPlayers(newSold);
    setCurrent(null);
    if (newSold.length === league!.players.length) {
      setPhase('done');
    } else {
      setPhase('idle');
    }
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
          <Button
            variant="ghost"
            onClick={() => router.push(`/leagues/${id}`)}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
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
          <Button
            size="lg"
            onClick={startAuction}
            className="bg-green-600 hover:bg-green-500 text-white px-14 py-7 text-2xl rounded-2xl font-bold shadow-2xl shadow-green-500/20 transition-transform active:scale-95"
          >
            Start Auction
          </Button>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-950 text-white">
        <div className="border-b border-white/10 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/leagues/${id}`)}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            ← Back to League
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="text-8xl">🏆</div>
          <h2 className="text-4xl font-bold">Auction Complete!</h2>
          <p className="text-white/50 text-xl">
            {soldCount} of {totalPlayers} players sold
          </p>

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
            <Button
              variant="outline"
              onClick={startAuction}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Restart Auction
            </Button>
            <Button
              onClick={() => router.push(`/leagues/${id}`)}
              className="bg-green-600 hover:bg-green-500"
            >
              Back to League
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main auction (idle / picking / showing) ───────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-white/10 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/leagues/${id}`)}
          className="text-white/40 hover:text-white hover:bg-white/10"
        >
          ← League
        </Button>

        <div className="flex items-center gap-5 text-sm font-medium">
          <span className="text-green-400">{soldCount} Sold</span>
          <span className="text-white/20">|</span>
          <span className="text-white/50">{pool.length + unsoldQueue.length} Left</span>
          {unsoldQueue.length > 0 && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-amber-400">{unsoldQueue.length} Unsold</span>
            </>
          )}
          {round > 1 && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-blue-400 text-xs uppercase tracking-widest">Round {round}</span>
            </>
          )}
        </div>

        <div className="text-white/25 text-sm tabular-nums">{soldCount}/{totalPlayers}</div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-auto">

        {/* ── Idle: pick button ── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            {pool.length === 0 && unsoldQueue.length > 0 && (
              <p className="text-amber-400/70 text-sm">
                All players shown — {unsoldQueue.length} unsold player{unsoldQueue.length !== 1 ? 's' : ''} will re-enter
              </p>
            )}
            <Button
              size="lg"
              onClick={pickNext}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-16 py-7 text-2xl rounded-2xl font-bold shadow-2xl shadow-blue-500/25 transition-transform"
            >
              Pick Next Player
            </Button>
          </div>
        )}

        {/* ── Picking: spinner ── */}
        {phase === 'picking' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-white/40 text-lg animate-pulse">Selecting player...</p>
          </div>
        )}

        {/* ── Showing: player card + action buttons ── */}
        {phase === 'showing' && current && (
          <>
            {/* Scaled card wrapper — outer div reserves layout space, inner scales visually */}
            <div
              style={{
                width: Math.round(CARD_W * scale),
                height: Math.round(CARD_H * scale),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
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

            {/* Sold / Unsold */}
            <div className="flex gap-5 shrink-0">
              <Button
                size="lg"
                onClick={markUnsold}
                className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-amber-500/20"
              >
                Unsold
              </Button>
              <Button
                size="lg"
                onClick={markSold}
                className="bg-green-600 hover:bg-green-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-green-500/20"
              >
                Sold ✓
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
