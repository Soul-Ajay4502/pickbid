'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import PlayerCard, { CARD_W, CARD_H } from '@/components/PlayerCard';
import Confetti from '@/components/Confetti';
import type { LeagueWithPlayers, Player, PlayerRole, Team, LiveAuctionState, LivePurse } from '@/lib/types';
import { toast } from 'sonner';
import { copyToClipboard, formatINR, buildPlayerSoldMessage, whatsappShareLink } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { Shuffle, Wallet, X, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RotateCcw, Share2, Copy, Sparkles, MessageCircle } from 'lucide-react';

type Phase = 'loading' | 'lobby' | 'idle' | 'picking' | 'showing' | 'sold-modal' | 'done';

// A sold/unsold call sits here for GRACE_MS before it's actually persisted —
// gives the auctioneer a window to undo a mis-click before it locks in.
type PendingAction =
  | { type: 'sold'; player: Player; teamId: string; teamName: string; teamColor: string; price: number }
  | { type: 'unsold'; player: Player };

const GRACE_MS = 5000;

const fmt = formatINR;

/**
 * Per-team auction purse maths.
 * Max bid follows the standard auction rule: a team must keep at least the
 * base price in reserve for every squad slot it still has to fill after
 * winning the current player.
 */
/**
 * Picks the next player out of the remaining pool. With a role pick
 * preference set, the first listed role that still has players left wins the
 * whole draw (uniformly at random among just that role); once every listed
 * role is exhausted, any roles left off the list are drawn from together,
 * still uniformly at random. No preference falls back to a pure random draw
 * across the whole pool.
 */
function selectFromPool(from: Player[], pickPreference: PlayerRole[] | null | undefined): Player {
  let candidates = from;
  if (pickPreference && pickPreference.length > 0) {
    const bucket = pickPreference.map(role => from.filter(p => p.role === role)).find(b => b.length > 0);
    if (bucket) candidates = bucket;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function teamStats(team: Team, roster: Player[], basePrice: number) {
  const squad = roster.filter(p => p.teamId === team.id);
  const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  const balance = team.budget - spent;
  const maxPlayers = team.maxPlayers ?? 11;
  const slotsLeft = Math.max(0, maxPlayers - squad.length);
  const maxBid = slotsLeft === 0 ? 0 : Math.max(0, balance - (slotsLeft - 1) * basePrice);
  return { bought: squad.length, maxPlayers, spent, balance, slotsLeft, maxBid };
}

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
  const [spinName, setSpinName] = useState('');
  const [spinKey, setSpinKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spentByTeam, setSpentByTeam] = useState<Record<string, number>>({});
  const [soldTeamId, setSoldTeamId] = useState('');
  const [soldPrice, setSoldPrice] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(0);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resetting, setResetting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewTeam, setViewTeam] = useState<Team | null>(null);
  const liveSeq = useRef(0);
  // Confetti burst on each committed sale — the counter keys the remount so
  // back-to-back sales replay it; 0 means no confetti on screen
  const [confettiBurst, setConfettiBurst] = useState(0);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Base price per player — used for the max-bid rule; persisted per league
  const [basePrice, setBasePrice] = useState(0);
  // Purse sidebar visibility — persisted per league
  const [purseOpen, setPurseOpen] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`auction_base_${id}`) || '100';
      if (v) setBasePrice(parseInt(v) || 0);
      setPurseOpen(localStorage.getItem(`auction_purse_${id}`) !== '0');
    } catch { /* private mode */ }
  }, [id]);
  function togglePurse() {
    setPurseOpen(v => {
      try { localStorage.setItem(`auction_purse_${id}`, v ? '0' : '1'); } catch { /* private mode */ }
      return !v;
    });
  }
  function changeBasePrice(v: string) {
    const n = Math.max(0, parseInt(v) || 0);
    setBasePrice(n);
    try { localStorage.setItem(`auction_base_${id}`, String(n)); } catch { /* private mode */ }
  }

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${id}`);
      if (!res.ok) { router.push('/'); return; }
      const json: LeagueWithPlayers = await res.json();
      if (!json.canManage) { toast.error('Only the league organizers can run auctions'); router.push(`/leagues/${id}`); return; }
      if (json.players.length === 0) { toast.error('Add players first'); router.push(`/leagues/${id}`); return; }
      setLeague(json);
      const s: Record<string, number> = {};
      json.players.forEach(p => { if (p.teamId && p.soldPrice) s[p.teamId] = (s[p.teamId] ?? 0) + p.soldPrice; });
      setSpentByTeam(s);
      setPhase('lobby');
    } catch { toast.error('Failed to load'); router.push(`/leagues/${id}`); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchLeague(); }, [fetchLeague]);
  useEffect(() => {
    function upd() {
      // Reserve room for the team-purse sidebars on desktop (split left + right)
      const nTeams = league?.teams?.length ?? 0;
      const cols = window.innerWidth >= 768 && nTeams > 0 ? (nTeams > 1 ? 2 : 1) : 0;
      const sidebar = cols * (purseOpen ? 240 : 44);
      const h = window.innerHeight - 220, w = window.innerWidth - 80 - sidebar;
      setScale(Math.min(h / CARD_H, w / CARD_W, 2.4));
    }
    upd(); window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd);
  }, [league, purseOpen]);
  // Note: the grace *timeout* itself is intentionally left running on unmount
  // (e.g. the auctioneer navigates away) so a pending sold/unsold call still
  // commits and persists — only its countdown-display interval is cleared.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
  }, []);

  // ── Live broadcast ───────────────────────────────────────────────────────
  // Push the current auction state to the server on each transition so the
  // shareable spectator/big-screen view (/leagues/[id]/watch) mirrors it.
  const postLive = useCallback((state: LiveAuctionState) => {
    fetch(`/api/leagues/${id}/auction/live`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
    }).catch(() => { /* spectator sync is best-effort — never block the auction */ });
  }, [id]);

  const buildLive = useCallback((opts: {
    phase: LiveAuctionState['phase'];
    current?: Player | null;
    lastSold?: LiveAuctionState['lastSold'];
    roster: Player[]; pool: Player[]; unsold: Player[]; round: number;
  }): LiveAuctionState => {
    liveSeq.current += 1;
    const lg = league!;
    const purses: LivePurse[] = (lg.teams ?? []).map(t => {
      const squad = opts.roster.filter(p => p.teamId === t.id);
      const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
      const maxPlayers = t.maxPlayers ?? 11;
      const slotsLeft = Math.max(0, maxPlayers - squad.length);
      const maxBid = slotsLeft === 0 ? 0 : Math.max(0, (t.budget - spent) - (slotsLeft - 1) * basePrice);
      return {
        id: t.id, name: t.name, color: t.colorHex, budget: t.budget,
        spent, count: squad.length, maxPlayers: t.maxPlayers, maxBid,
        players: squad.map(p => ({ name: p.name, price: p.soldPrice ?? 0 })),
      };
    });
    return {
      v: liveSeq.current,
      phase: opts.phase,
      updatedAt: Date.now(),
      league: { name: lg.name, conductedBy: lg.conductedBy, logoUrl: lg.logoUrl, templateId: lg.templateId },
      current: opts.current ?? null,
      lastSold: opts.lastSold ?? null,
      progress: { sold: opts.roster.length, total: lg.players.length, unsold: opts.unsold.length, left: opts.pool.length + opts.unsold.length, round: opts.round },
      purses,
    };
  }, [league, basePrice]);

  function startAuction() {
    if (!league) return;
    const p = league.players.filter(x => !x.teamId && !x.isUnsold);
    const u = league.players.filter(x => !!x.isUnsold);
    const s = league.players.filter(x => !!x.teamId);
    setPool(p); setUnsoldQueue(u); setSoldPlayers(s);
    setCurrent(null); setRound(1); setPhase('idle');
    postLive(buildLive({ phase: 'idle', roster: s, pool: p, unsold: u, round: 1 }));
  }

  // Wipe auction results (sold players + unsold flags) and drop back to the
  // lobby. Pre-assigned icon players keep their team — they aren't auctioned.
  async function resetAuction() {
    if (!confirm('Reset the auction? Every sold player goes back into the pool and unsold flags are cleared. Pre-assigned icon players stay on their teams. This cannot be undone.')) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/leagues/${id}/auction/reset`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const { reset } = await res.json();
      toast.success(`Auction reset — ${reset} player${reset === 1 ? '' : 's'} returned to the pool`);
      await fetchLeague();
    } catch { toast.error('Failed to reset auction'); }
    finally { setResetting(false); }
  }

  function runSlot(names: string[], picked: string, onDone: () => void) {
    const others = names.filter(n => n !== picked), pool2 = others.length > 0 ? others : [picked];
    const seq = Array.from({ length: 50 }, (_, i) => i === 49 ? picked : pool2[Math.floor(Math.random() * pool2.length)]);
    let delay = 38, i = 0;
    function step() {
      if (delay > 520 || i >= seq.length) { setSpinName(picked); setSpinKey(k => k + 1); timerRef.current = setTimeout(onDone, 680); return; }
      setSpinName(seq[i]); setSpinKey(k => k + 1); i++; delay *= 1.3; timerRef.current = setTimeout(step, delay);
    }
    step();
  }

  function pickNext() {
    let from = pool;
    let r = round;
    let unsoldNow = unsoldQueue;
    if (from.length === 0) {
      if (unsoldQueue.length === 0) {
        setPhase('done');
        postLive(buildLive({ phase: 'done', roster: soldPlayers, pool: [], unsold: [], round }));
        return;
      }
      from = [...unsoldQueue]; r = round + 1; setRound(r); setUnsoldQueue([]); unsoldNow = [];
      toast.info(`Round ${r} — ${from.length} unsold re-entering`);
    }
    const picked = selectFromPool(from, league?.pickPreference);
    const newPool = from.filter(p => p.id !== picked.id);
    setPool(newPool); setPhase('picking');
    postLive(buildLive({ phase: 'picking', current: null, roster: soldPlayers, pool: newPool, unsold: unsoldNow, round: r }));
    runSlot(from.map(p => p.name), picked.name, () => {
      setCurrent(picked); setPhase('showing');
      postLive(buildLive({ phase: 'showing', current: picked, roster: soldPlayers, pool: newPool, unsold: unsoldNow, round: r }));
    });
  }

  // Commits a sold/unsold call once its grace window has fully elapsed —
  // this is the only place either result is actually persisted or broadcast.
  async function commitAction(action: PendingAction) {
    setPendingAction(null);
    if (action.type === 'sold') {
      const { player, teamId, teamName, teamColor, price } = action;
      try {
        const res = await fetch(`/api/leagues/${id}/players/${player.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, soldPrice: price, isUnsold: false }) });
        if (!res.ok) throw new Error();
        const soldP: Player = { ...player, teamId, soldPrice: price };
        const ns = [...soldPlayers, soldP];
        const doneNow = ns.length === league!.players.length;
        setSpentByTeam(prev => ({ ...prev, [teamId]: (prev[teamId] ?? 0) + price }));
        setSoldPlayers(ns); setCurrent(null);
        setPhase(doneNow ? 'done' : 'idle');
        // Keep the "SOLD" celebration live for spectators until the next pick
        postLive(buildLive({
          phase: doneNow ? 'done' : 'sold',
          current: soldP,
          lastSold: { player: soldP, teamName, teamColor, price },
          roster: ns, pool, unsold: unsoldQueue, round,
        }));
        // Celebrate on the control screen too, same as spectators see
        setConfettiBurst(k => k + 1);
        if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = setTimeout(() => setConfettiBurst(0), 4500);
        // Announce the sale to the league's WhatsApp group straight from the
        // confirmation toast; the squad modal offers a resend later.
        const shareMessage = buildPlayerSoldMessage({ playerName: player.name, soldPrice: price, teamName });
        toast.success('Player sold!', {
          duration: 12000,
          action: {
            label: 'Share to WhatsApp',
            onClick: () => window.open(whatsappShareLink(shareMessage), '_blank', 'noopener'),
          },
        });
      } catch { toast.error('Failed to record sale'); }
    } else {
      const player = action.player;
      await fetch(`/api/leagues/${id}/players/${player.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isUnsold: true, teamId: null, soldPrice: null }) });
      const nu = [...unsoldQueue, player];
      setUnsoldQueue(nu); setCurrent(null); setPhase('idle');
      // Keep the "UNSOLD" moment live for spectators until the next pick
      postLive(buildLive({ phase: 'unsold', current: player, roster: soldPlayers, pool, unsold: nu, round }));
      toast.info(`${player.name} went unsold`);
    }
  }

  // Starts the 5s panic-button window: nothing is written to the server or
  // broadcast to spectators until it elapses — an Undo click within the
  // window cancels commitAction entirely, with zero side effects.
  function startGrace(action: PendingAction) {
    setPendingAction(action);
    setGraceSecondsLeft(Math.round(GRACE_MS / 1000));
    graceIntervalRef.current = setInterval(() => setGraceSecondsLeft(s => Math.max(0, s - 1)), 1000);
    graceTimerRef.current = setTimeout(() => {
      if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
      commitAction(action);
    }, GRACE_MS);
  }

  function undoGrace() {
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    setPendingAction(null);
    toast.info('Undone — back to the block');
  }

  function confirmSold() {
    if (!current || !soldTeamId) return;
    const price = parseInt(soldPrice) || 0;
    // Enforce squad-size and max-bid rules when real teams exist
    const team = (league?.teams ?? []).find(t => t.id === soldTeamId);
    if (team) {
      const st = teamStats(team, soldPlayers, basePrice);
      if (st.slotsLeft === 0) { toast.error(`${team.name} squad is already full (${st.maxPlayers} players)`); return; }
      if (price > st.maxBid) { toast.error(`Exceeds ${team.name}'s max bid of ${fmt(st.maxBid)}`); return; }
    }
    const action: PendingAction = { type: 'sold', player: current, teamId: soldTeamId, teamName: team?.name ?? soldTeamId, teamColor: team?.colorHex ?? '#22c55e', price };
    setSoldTeamId(''); setSoldPrice('');
    setPhase('showing');
    startGrace(action);
  }

  function markUnsold() {
    if (!current) return;
    startGrace({ type: 'unsold', player: current });
  }

  if (loading || !league) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-foreground/40 animate-pulse text-lg">Loading auction…</div>
    </div>
  );

  const teams: Team[] = league.teams ?? [], totalPlayers = league.players.length, soldCount = soldPlayers.length;
  // Split the purse list so half the teams sit on each side of the card (desktop only)
  const purseHalf = Math.ceil(teams.length / 2);
  const leftTeams = teams.slice(0, purseHalf);
  const rightTeams = teams.slice(purseHalf);
  // Auction has results to clear when a non-icon player is on a team or marked unsold
  const hasAuctionData = league.players.some(p => (p.teamId && !p.isIcon) || p.isUnsold);
  const watchUrl = typeof window !== 'undefined' ? `${window.location.origin}/leagues/${id}/watch` : '';

  if (phase === 'lobby') return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      <div className="absolute -top-24 left-1/3 w-150 h-150 rounded-full bg-green-500/6 blur-[130px] animate-orb pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-125 h-125 rounded-full bg-emerald-400/5 blur-[110px] animate-orb pointer-events-none" style={{ animationDelay: '5s' }} />
      <div className="border-b border-foreground/8 px-6 py-4 relative z-10 backdrop-blur-xl bg-foreground/2 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push(`/leagues/${id}`)} className="text-foreground/50 hover:text-foreground hover:bg-foreground/10">← Back to League</Button>
        <div className="flex items-center gap-3">
          {!league.isCreator && <CoOrganizerBadge />}
          <ShareLiveButton onClick={() => setShareOpen(true)} />
        </div>
      </div>
      <ShareLiveModal open={shareOpen} onClose={() => setShareOpen(false)} url={watchUrl} />
      {viewTeam && <TeamSquadModal team={viewTeam} roster={league.players} basePrice={basePrice} onClose={() => setViewTeam(null)} />}
      <div className="flex-1 flex flex-col items-center justify-center gap-10 p-8 text-center relative z-10">
        <div className="relative animate-float">
          <div className="absolute inset-0 bg-green-400/20 rounded-full blur-3xl scale-[2.5] animate-glow-pulse pointer-events-none" />
          <span className="relative text-[96px] sm:text-[120px] leading-none select-none drop-shadow-2xl">🏏</span>
        </div>
        <div style={{ animation: 'fadeInUp .55s .1s cubic-bezier(.22,1,.36,1) both' }}>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">{league.name}</h1>
          <p className="text-foreground/40 text-lg">Player Auction · {totalPlayers} players</p>
          {teams.length > 0 && <p className="text-foreground/30 mt-1 text-sm">{teams.length} teams · Budget tracking on</p>}
          {teams.length === 0 && <button onClick={() => router.push(`/leagues/${id}/teams`)} className="mt-3 text-sm text-amber-600 dark:text-amber-400/80 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300">Set up teams →</button>}
        </div>

        {/* Team purses */}
        {teams.length > 0 && (
          <div className="w-full max-w-3xl" style={{ animation: 'fadeInUp .55s .18s cubic-bezier(.22,1,.36,1) both' }}>
            <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
              <p className="text-foreground/35 text-[11px] uppercase tracking-[3px] font-bold">Team Purses</p>
              <label className="flex items-center gap-2 text-xs text-foreground/40">
                Base price / player
                <input
                  type="number" min="0" value={basePrice || ''} placeholder="0"
                  onChange={e => changeBasePrice(e.target.value)}
                  className="w-28 h-8 px-2 rounded-lg border border-foreground/15 bg-foreground/8 text-foreground text-xs text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-green-500/40"
                />
                {basePrice > 0 && <span className="text-green-600 dark:text-green-400/70 tabular-nums">{fmt(basePrice)}</span>}
              </label>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-foreground/4 overflow-x-auto backdrop-blur">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 text-[10px] uppercase tracking-widest text-foreground/30">
                    <th className="px-4 py-2.5 text-left font-bold">Team</th>
                    <th className="px-3 py-2.5 text-right font-bold">Budget</th>
                    <th className="px-3 py-2.5 text-right font-bold">Balance</th>
                    <th className="px-3 py-2.5 text-center font-bold">Players</th>
                    <th className="px-4 py-2.5 text-right font-bold">Max Bid</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => {
                    const st = teamStats(t, league.players, basePrice);
                    return (
                      <tr key={t.id} className="border-b border-foreground/5 last:border-0">
                        <td className="px-4 py-2.5 text-left">
                          <button onClick={() => setViewTeam(t)} className="flex items-center gap-2 hover:text-foreground transition-colors group/team">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.colorHex }} />
                            <span className="font-semibold text-foreground/80 group-hover/team:text-foreground group-hover/team:underline underline-offset-2">{t.name}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground/45">{fmt(t.budget)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400 font-semibold">{fmt(st.balance)}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-foreground/55">{st.bought}/{st.maxPlayers}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-600 dark:text-amber-300">{st.slotsLeft === 0 ? 'Full' : fmt(st.maxBid)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-foreground/20 text-[11px] mt-2">Max bid = balance − (remaining slots − 1) × base price</p>
          </div>
        )}

        <div style={{ animation: 'fadeInUp .55s .25s cubic-bezier(.22,1,.36,1) both' }} className="flex flex-col items-center gap-4">
          <AuctionCTA onClick={startAuction}>{hasAuctionData ? 'Resume Auction' : 'Start Auction'}</AuctionCTA>
          {hasAuctionData && (
            <button onClick={resetAuction} disabled={resetting}
              className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-red-500 dark:hover:text-red-300 disabled:opacity-50 transition-colors">
              {resetting
                ? <span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-white rounded-full animate-spin" />
                : <RotateCcw className="w-3.5 h-3.5" />}
              Reset auction data
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (phase === 'done') return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {confettiBurst > 0 && <Confetti key={confettiBurst} fixed />}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-150 rounded-full bg-amber-500/4 blur-[120px] pointer-events-none" />
      <div className="border-b border-foreground/8 px-6 py-4">
        <Button variant="ghost" onClick={() => router.push(`/leagues/${id}`)} className="text-foreground/50 hover:text-foreground hover:bg-foreground/10">← Back to League</Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center overflow-auto">
        <div className="animate-trophy text-8xl select-none">🏆</div>
        <div style={{ animation: 'fadeInUp .55s .1s cubic-bezier(.22,1,.36,1) both' }}>
          <h2 className="text-4xl font-bold text-gradient-gold">Auction Complete!</h2>
          <p className="text-foreground/50 text-xl mt-2">{soldCount} of {totalPlayers} players sold</p>
        </div>
        {teams.length > 0 && (
          <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 gap-3" style={{ animation: 'fadeInUp .55s .2s cubic-bezier(.22,1,.36,1) both' }}>
            {teams.map(t => {
              const spent = spentByTeam[t.id] ?? 0, tPlayers = soldPlayers.filter(p => p.teamId === t.id);
              return (<div key={t.id} className="bg-foreground/5 border border-foreground/10 rounded-xl p-3 text-left">
                <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: t.colorHex }} /><span className="font-semibold text-sm">{t.name}</span></div>
                <p className="text-xs text-foreground/40">{tPlayers.length} players · {fmt(spent)}</p>
                <p className="text-xs text-foreground/25 mt-0.5">{fmt(t.budget - spent)} left</p>
              </div>);
            })}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-4" style={{ animation: 'fadeInUp .55s .35s cubic-bezier(.22,1,.36,1) both' }}>
          <Button onClick={() => router.push(`/leagues/${id}/wrapped`)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-500/25">
            <Sparkles className="w-4 h-4 mr-2" />Auction Wrapped
          </Button>
          <Button variant="outline" onClick={resetAuction} disabled={resetting} className="border-foreground/20 text-foreground hover:bg-foreground/10">
            {resetting
              ? <span className="w-4 h-4 border-2 border-foreground/30 border-t-white rounded-full animate-spin mr-2" />
              : <RotateCcw className="w-4 h-4 mr-2" />}
            Reset Auction
          </Button>
          <Button onClick={() => router.push(`/leagues/${id}`)} className="bg-green-600 hover:bg-green-500 text-white btn-glow-green">Back to League</Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes slotSlideUp{from{transform:translateY(32px) scale(.92);opacity:0;filter:blur(6px)}to{transform:translateY(0) scale(1);opacity:1;filter:blur(0)}}
        @keyframes ctaGlow{0%,100%{box-shadow:0 0 28px 4px rgba(99,102,241,.55),0 10px 36px rgba(99,102,241,.35)}50%{box-shadow:0 0 56px 10px rgba(168,85,247,.7),0 10px 56px rgba(99,102,241,.5)}}
        @keyframes panelGlow{0%,100%{border-color:rgba(99,102,241,.4);box-shadow:0 0 32px rgba(99,102,241,.18)}50%{border-color:rgba(168,85,247,.7);box-shadow:0 0 56px rgba(168,85,247,.32)}}
        @keyframes dotBounce{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-5px);opacity:1}}
        @keyframes cardDropIn{from{opacity:0;transform:scale(.82) translateY(-24px);filter:blur(10px)}to{opacity:1;transform:scale(1) translateY(0);filter:blur(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lobbyCta{0%,100%{box-shadow:0 0 28px 4px rgba(22,163,74,.5),0 10px 36px rgba(22,163,74,.3)}50%{box-shadow:0 0 52px 10px rgba(22,163,74,.7),0 10px 52px rgba(22,163,74,.45)}}
        @keyframes graceShrink{from{width:100%}to{width:0%}}
      `}</style>
      <div className="h-screen flex flex-col bg-background text-foreground">
        {confettiBurst > 0 && <Confetti key={confettiBurst} fixed />}
        <div className="flex items-center justify-between px-5 py-3 bg-foreground/3 border-b border-foreground/8 shrink-0 backdrop-blur-xl">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/leagues/${id}`)} className="text-foreground/40 hover:text-foreground hover:bg-foreground/10">← League</Button>
          <div className="flex items-center gap-4 text-xs sm:text-sm font-semibold">
            <span className="text-green-600 dark:text-green-400 tabular-nums">{soldCount} Sold</span><span className="text-foreground/15">|</span>
            <span className="text-foreground/45 tabular-nums">{pool.length + unsoldQueue.length} Left</span>
            {unsoldQueue.length > 0 && <><span className="text-foreground/15">|</span><span className="text-amber-600 dark:text-amber-400 tabular-nums">{unsoldQueue.length} Unsold</span></>}
            {round > 1 && <><span className="text-foreground/15">|</span><span className="text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-widest font-bold">Rnd {round}</span></>}
          </div>
          <div className="flex items-center gap-3">
            {!league.isCreator && <CoOrganizerBadge />}
            <ShareLiveButton onClick={() => setShareOpen(true)} />
            <div className="text-foreground/20 text-xs tabular-nums font-mono">{soldCount}/{totalPlayers}</div>
          </div>
        </div>
        <ShareLiveModal open={shareOpen} onClose={() => setShareOpen(false)} url={watchUrl} />
        {viewTeam && <TeamSquadModal team={viewTeam} roster={soldPlayers} basePrice={basePrice} onClose={() => setViewTeam(null)} />}
        {/* Mobile: horizontal purse strip */}
        {teams.length > 0 && (
          <div className="md:hidden flex gap-2.5 px-4 py-2.5 border-b border-foreground/5 bg-foreground/2 overflow-x-auto shrink-0">
            {teams.map(t => (
              <div key={t.id} className="min-w-44 shrink-0">
                <PurseCard team={t} roster={soldPlayers} basePrice={basePrice} onView={() => setViewTeam(t)} />
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 flex min-h-0">
          {/* Desktop: half the team purses sit on the left of the card (collapsible) */}
          {leftTeams.length > 0 && (purseOpen
            ? <PurseSidebar side="left" teams={leftTeams} roster={soldPlayers} basePrice={basePrice} onToggle={togglePurse} onView={setViewTeam} />
            : <PurseRail side="left" teams={leftTeams} roster={soldPlayers} basePrice={basePrice} onToggle={togglePurse} onView={setViewTeam} />
          )}
          <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 overflow-auto">
            {phase === 'idle' && (
              <div className="flex flex-col items-center gap-5">
                {pool.length === 0 && unsoldQueue.length > 0 && <p className="text-amber-600 dark:text-amber-400/70 text-sm">All shown — {unsoldQueue.length} unsold re-entering</p>}
                <button onClick={pickNext} style={{ position: 'relative', padding: '28px 80px', borderRadius: 24, border: '2px solid rgba(168,85,247,.5)', cursor: 'pointer', background: 'linear-gradient(135deg,#4338ca 0%,#7c3aed 50%,#4338ca 100%)', color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: .4, display: 'flex', alignItems: 'center', gap: 16, animation: 'ctaGlow 2.2s ease-in-out infinite', transition: 'transform .1s ease', userSelect: 'none', WebkitUserSelect: 'none' }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(.95)' }} onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
                  <Shuffle size={30} />Pick Next Player
                </button>
                <p style={{ color: 'var(--muted-foreground)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>{pool.length + unsoldQueue.length} in pool</p>
              </div>
            )}
            {phase === 'picking' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 520 }}>
                <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase' }}>Selecting Player</p>
                <div style={{ width: '100%', borderRadius: 22, border: '2px solid rgba(99,102,241,.4)', background: 'linear-gradient(160deg,rgba(12,10,30,.98) 0%,rgba(20,10,40,.98) 100%)', padding: '48px 40px', textAlign: 'center', overflow: 'hidden', position: 'relative', animation: 'panelGlow 1.1s ease-in-out infinite' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, background: 'linear-gradient(to bottom,rgba(12,10,30,1),transparent)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 52, background: 'linear-gradient(to top,rgba(20,10,40,1),transparent)', pointerEvents: 'none' }} />
                  <div key={spinKey} style={{ animation: 'slotSlideUp .13s cubic-bezier(.22,1,.36,1)', fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1.15, textShadow: '0 0 48px rgba(168,85,247,.8),0 2px 12px rgba(0,0,0,.8)', letterSpacing: -.5 }}>{spinName}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(168,85,247,.7)', animation: `dotBounce .9s ease-in-out ${i * .3}s infinite` }} />)}</div>
              </div>
            )}
            {(phase === 'showing' || phase === 'sold-modal') && current && (
              <>
                <div key={current.id} style={{ width: Math.round(CARD_W * scale), height: Math.round(CARD_H * scale), position: 'relative', overflow: 'hidden', flexShrink: 0, animation: 'cardDropIn .55s cubic-bezier(.34,1.56,.64,1) both' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <PlayerCard player={current} templateId={league.templateId} leagueName={league.name} conductedBy={league.conductedBy} logoUrl={league.logoUrl} pdfMode />
                  </div>
                </div>
                {phase === 'showing' && (pendingAction ? (
                  <div className="flex flex-col items-center gap-3 shrink-0" style={{ animation: 'fadeInUp .3s cubic-bezier(.22,1,.36,1) both' }}>
                    <p className={`text-xl font-bold ${pendingAction.type === 'sold' ? 'text-green-500' : 'text-amber-500'}`}>
                      {pendingAction.type === 'sold' ? `Sold to ${pendingAction.teamName} for ${fmt(pendingAction.price)}` : `${pendingAction.player.name} marked Unsold`}
                    </p>
                    <button onClick={undoGrace}
                      className="relative overflow-hidden flex items-center gap-2 px-10 py-5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-lg font-bold shadow-xl shadow-red-500/25 transition-transform">
                      <span key={pendingAction.player.id} className="absolute inset-y-0 left-0 bg-white/20 pointer-events-none" style={{ animation: `graceShrink ${GRACE_MS}ms linear forwards` }} />
                      <RotateCcw className="w-5 h-5 relative" /><span className="relative">Undo ({graceSecondsLeft}s)</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-5 shrink-0" style={{ animation: 'fadeInUp .45s .3s cubic-bezier(.22,1,.36,1) both' }}>
                    <Button size="lg" onClick={markUnsold} className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-amber-500/20">Unsold</Button>
                    <Button size="lg" onClick={() => setPhase('sold-modal')} className="bg-green-600 hover:bg-green-500 active:scale-95 text-white px-10 py-6 text-lg rounded-xl font-bold min-w-40 transition-transform shadow-xl shadow-green-500/20">Sold ✓</Button>
                  </div>
                ))}
                {phase === 'sold-modal' && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-popover border border-foreground/12 rounded-2xl p-6 w-full max-w-sm space-y-5 animate-scale-in shadow-2xl">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg text-foreground">Record Sale — {current.name}</h3>
                        <button onClick={() => setPhase('showing')} className="text-foreground/40 hover:text-foreground"><X className="w-5 h-5" /></button>
                      </div>
                      {teams.length > 0 ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wide">Sold To</label>
                          <div className="grid grid-cols-2 gap-2">
                            {teams.map(t => {
                              const st = teamStats(t, soldPlayers, basePrice);
                              const full = st.slotsLeft === 0;
                              return (
                                <button key={t.id} onClick={() => setSoldTeamId(t.id)} disabled={full}
                                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left disabled:opacity-35 disabled:cursor-not-allowed"
                                  style={{ borderColor: soldTeamId === t.id ? t.colorHex : 'var(--border)', background: soldTeamId === t.id ? `${t.colorHex}20` : 'transparent', color: soldTeamId === t.id ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.colorHex }} />
                                  <span className="truncate flex-1">{t.name}</span>
                                  <span className="text-[10px] opacity-60 text-right leading-tight tabular-nums">
                                    {full ? 'Full' : `Max ${fmt(st.maxBid)}`}<br />{st.bought}/{st.maxPlayers}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wide">Team Name</label>
                          <input value={soldTeamId} onChange={e => setSoldTeamId(e.target.value)} placeholder="Enter team name" className="w-full h-10 px-3 rounded-xl border border-foreground/15 bg-foreground/8 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wide flex items-center gap-1"><Wallet className="w-3 h-3" />Sale Price</label>
                        <input type="number" min="0" value={soldPrice} onChange={e => setSoldPrice(e.target.value)} placeholder="e.g. 1500000" className="w-full h-10 px-3 rounded-xl border border-foreground/15 bg-foreground/8 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                        {(() => {
                          if (!soldPrice) return null;
                          const price = parseInt(soldPrice) || 0;
                          const team = teams.find(t => t.id === soldTeamId);
                          const over = team ? price > teamStats(team, soldPlayers, basePrice).maxBid : false;
                          return (
                            <p className={`text-xs ${over ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-foreground/40'}`}>
                              {fmt(price)}{over && ` — exceeds ${team!.name}'s max bid`}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setPhase('showing')} className="flex-1 py-2.5 rounded-xl border border-foreground/15 text-foreground/60 hover:text-foreground hover:border-foreground/30 transition-colors text-sm font-medium">Cancel</button>
                        <button onClick={confirmSold} disabled={!soldTeamId}
                          className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                          Confirm Sold
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Desktop: the other half of the team purses sit on the right of the card */}
          {rightTeams.length > 0 && (purseOpen
            ? <PurseSidebar side="right" teams={rightTeams} roster={soldPlayers} basePrice={basePrice} onToggle={togglePurse} onView={setViewTeam} />
            : <PurseRail side="right" teams={rightTeams} roster={soldPlayers} basePrice={basePrice} onToggle={togglePurse} onView={setViewTeam} />
          )}
        </div>
      </div>
    </>
  );
}

function PurseSidebar({ side, teams, roster, basePrice, onToggle, onView }: {
  side: 'left' | 'right'; teams: Team[]; roster: Player[]; basePrice: number; onToggle: () => void; onView: (t: Team) => void;
}) {
  if (teams.length === 0) return null;
  const Icon = side === 'left' ? PanelLeftClose : PanelRightClose;
  return (
    <aside className={`hidden md:flex w-60 shrink-0 flex-col gap-2 p-3 bg-foreground/2 overflow-y-auto animate-slide-in-right border-foreground/5 ${side === 'left' ? 'border-r' : 'border-l'}`}>
      <div className="flex items-center justify-between px-1 pb-0.5">
        <p className="text-[10px] uppercase tracking-[2.5px] text-foreground/30 font-bold">Team Purses</p>
        <button onClick={onToggle} title="Collapse purses" aria-label="Collapse team purses"
          className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/35 hover:text-foreground hover:bg-foreground/10 transition-colors">
          <Icon className="w-3.5 h-3.5" />
        </button>
      </div>
      {teams.map(t => (
        <PurseCard key={t.id} team={t} roster={roster} basePrice={basePrice} onView={() => onView(t)} />
      ))}
    </aside>
  );
}

function PurseRail({ side, teams, roster, basePrice, onToggle, onView }: {
  side: 'left' | 'right'; teams: Team[]; roster: Player[]; basePrice: number; onToggle: () => void; onView: (t: Team) => void;
}) {
  if (teams.length === 0) return null;
  const Icon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
  return (
    <aside className={`hidden md:flex w-11 shrink-0 flex-col items-center gap-2.5 py-3 bg-foreground/2 border-foreground/5 ${side === 'left' ? 'border-r' : 'border-l'}`}>
      <button onClick={onToggle} title="Show team purses" aria-label="Show team purses"
        className="w-7 h-7 flex items-center justify-center rounded-md text-foreground/35 hover:text-foreground hover:bg-foreground/10 transition-colors">
        <Icon className="w-4 h-4" />
      </button>
      <div className="flex flex-col gap-2 mt-1">
        {teams.map(t => {
          const st = teamStats(t, roster, basePrice);
          return (
            <button key={t.id} onClick={() => onView(t)}
              title={`${t.name} · Bal ${fmt(st.balance)} · ${st.bought}/${st.maxPlayers}`}
              className={`w-2.5 h-2.5 rounded-full transition-transform hover:scale-125 ${st.slotsLeft === 0 ? 'ring-2 ring-green-400/40' : ''}`}
              style={{ background: t.colorHex }} />
          );
        })}
      </div>
    </aside>
  );
}

function PurseCard({ team, roster, basePrice, onView }: { team: Team; roster: Player[]; basePrice: number; onView?: () => void }) {
  const st = teamStats(team, roster, basePrice);
  const pct = Math.min(100, Math.round((st.spent / team.budget) * 100));
  const full = st.slotsLeft === 0;
  return (
    <div
      onClick={onView}
      role={onView ? 'button' : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(); } } : undefined}
      className={`rounded-xl border px-3 py-2 transition-colors ${onView ? 'cursor-pointer hover:border-foreground/25' : ''} ${full ? 'border-green-500/25 bg-green-500/5' : 'border-foreground/8 bg-foreground/4'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: team.colorHex }} />
        <span className="text-xs font-semibold text-foreground/75 truncate flex-1">{team.name}</span>
        <span className={`text-[10px] tabular-nums font-bold ${full ? 'text-green-600 dark:text-green-400' : 'text-foreground/40'}`}>{st.bought}/{st.maxPlayers}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] tabular-nums whitespace-nowrap">
        <span className="text-foreground/40">Bal <span className="text-green-600 dark:text-green-400 font-semibold">{fmt(st.balance)}</span></span>
        <span className="text-foreground/40">Max <span className={`font-semibold ${full ? 'text-foreground/25' : 'text-amber-600 dark:text-amber-300'}`}>{full ? '—' : fmt(st.maxBid)}</span></span>
      </div>
      <div className="mt-1.5 w-full h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: team.colorHex }} />
      </div>
    </div>
  );
}

// Per-team breakdown — players, prices and purse summary in a table
function TeamSquadModal({ team, roster, basePrice, onClose }: { team: Team; roster: Player[]; basePrice: number; onClose: () => void }) {
  const st = teamStats(team, roster, basePrice);
  const squad = roster.filter(p => p.teamId === team.id);
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-popover border border-foreground/12 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: team.colorHex }} />
            <h3 className="font-bold text-lg text-foreground truncate">{team.name}</h3>
            <span className="text-xs text-foreground/40 tabular-nums shrink-0">{st.bought}/{st.maxPlayers}</span>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-2 flex-1">
          {squad.length === 0 ? (
            <p className="text-sm text-foreground/40 text-center py-10">No players bought yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-foreground/30 border-b border-foreground/10">
                  <th className="py-2 pr-2 text-left font-bold w-6">#</th>
                  <th className="py-2 text-left font-bold">Player</th>
                  <th className="py-2 pl-2 text-right font-bold">Price</th>
                  <th className="py-2 pl-2 text-right font-bold">Share</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p, i) => (
                  <tr key={p.id} className="border-b border-foreground/5 last:border-0">
                    <td className="py-2 pr-2 text-left tabular-nums text-foreground/35">{i + 1}</td>
                    <td className="py-2 text-left font-medium text-foreground/85 truncate">{p.name}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-foreground/70">{fmt(p.soldPrice ?? 0)}</td>
                    <td className="py-2 pl-2 text-right whitespace-nowrap">
                      <SoldShareActions playerName={p.name} soldPrice={p.soldPrice ?? null} teamName={team.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 px-5 py-4 border-t border-foreground/10 text-center">
          <div><p className="text-[10px] uppercase tracking-wide text-foreground/35 mb-0.5">Spent</p><p className="text-sm font-bold text-foreground/80 tabular-nums">{fmt(st.spent)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-foreground/35 mb-0.5">Balance</p><p className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">{fmt(st.balance)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-foreground/35 mb-0.5">Max Bid</p><p className="text-sm font-bold text-amber-600 dark:text-amber-300 tabular-nums">{st.slotsLeft === 0 ? 'Full' : fmt(st.maxBid)}</p></div>
        </div>
      </div>
    </div>
  );
}

function CoOrganizerBadge() {
  return (
    <span className="inline-flex items-center px-2.5 h-6 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25 shrink-0">
      Co-organizer
    </span>
  );
}

// Re-share a past sale from the squad list: WhatsApp deep link plus a
// clipboard fallback for other messengers. Disabled when there's no recorded
// price (e.g. a pre-assigned icon player) — no button beats a broken message.
function SoldShareActions({ playerName, soldPrice, teamName }: { playerName: string; soldPrice: number | null; teamName: string }) {
  const disabled = soldPrice == null || !teamName;
  const message = disabled ? '' : buildPlayerSoldMessage({ playerName, soldPrice: soldPrice!, teamName });
  return (
    <span className="inline-flex items-center gap-1">
      <button
        disabled={disabled}
        onClick={() => window.open(whatsappShareLink(message), '_blank', 'noopener')}
        title={disabled ? 'No sale price recorded' : 'Share to WhatsApp'}
        aria-label={`Share ${playerName}'s sale to WhatsApp`}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-green-600 dark:text-green-400 hover:bg-green-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
      <button
        disabled={disabled}
        onClick={() => { copyToClipboard(message).then((ok) => { if (ok) toast.success('Sale message copied'); else toast.error('Could not copy'); }); }}
        title={disabled ? 'No sale price recorded' : 'Copy message (for Telegram/SMS)'}
        aria-label={`Copy ${playerName}'s sale message`}
        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Copy className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function AuctionCTA({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '24px 64px', borderRadius: 22, border: '2px solid rgba(34,197,94,.45)', cursor: 'pointer', background: 'linear-gradient(135deg,#15803d 0%,#16a34a 50%,#15803d 100%)', color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: .4, animation: 'lobbyCta 2.2s ease-in-out infinite', transition: 'transform .1s ease', userSelect: 'none', WebkitUserSelect: 'none' }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(.96)' }} onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
      {children}
    </button>
  );
}

function ShareLiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold text-foreground/70 hover:text-foreground bg-foreground/8 hover:bg-foreground/15 border border-foreground/10 transition-colors shrink-0">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/70 animate-ping" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <Share2 className="w-3.5 h-3.5" /><span className="text-xs hidden sm:inline">Share Live</span>
    </button>
  );
}

function ShareLiveModal({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-popover border border-foreground/12 rounded-2xl p-6 w-full max-w-sm space-y-4 animate-scale-in shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground">Share Live View</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-foreground/50 text-sm">Anyone with this link follows the auction live — point a projector at it, or share it with the room to watch on their phones.</p>
        <div className="flex justify-center py-1">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={url} size={176} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={url} onFocus={e => e.currentTarget.select()}
            className="flex-1 h-10 px-3 rounded-xl border border-foreground/15 bg-foreground/8 text-foreground text-xs truncate focus:outline-none" />
          <button onClick={() => { copyToClipboard(url).then((ok) => { if (ok) toast.success('Watch link copied'); else toast.error('Could not copy link'); }); }}
            className="h-10 px-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 shrink-0">
            <Copy className="w-3.5 h-3.5" />Copy
          </button>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="block text-center text-sm text-green-600 dark:text-green-400 hover:underline underline-offset-2">Open big-screen view →</a>
      </div>
    </div>
  );
}
