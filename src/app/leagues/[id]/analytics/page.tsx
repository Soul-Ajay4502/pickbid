'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft, BarChart2, Trophy, Wallet, Users, Star, Zap, Shield, Gavel,
  Coins, TrendingUp, TrendingDown, Crown, Activity, Percent, Target,
} from 'lucide-react';
import type { LeagueWithPlayers, Player, Team, Match } from '@/lib/types';

/* ── Formatting helpers ─────────────────────────────────────────────────── */
function fmt(n: number): string {
  if (!n) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function fmtFull(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
const ROLE_SHORT: Record<string, string> = {
  'Batter': 'BAT', 'Bowler': 'BOWL', 'All-Rounder': 'AR', 'Wicket-Keeper Batter': 'WK',
};
const ROLES = ['Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper Batter'] as const;

/* ── Analytics computation ──────────────────────────────────────────────── */
interface TeamMeta { name: string; color: string; budget: number | null; maxPlayers: number | null; }
interface TeamStat {
  key: string; meta: TeamMeta; squad: Player[]; count: number; bought: number;
  spent: number; remaining: number | null; utilization: number | null; avg: number;
  maxBuy: Player | null; icons: number; roleCounts: Record<string, number>; slotsLeft: number | null;
}
interface Leader { player: Player; value: number; }
interface Standing { team: Team; played: number; won: number; lost: number; tied: number; points: number; }

function roleBreakdown(list: Player[]): Record<string, number> {
  const r: Record<string, number> = { 'Batter': 0, 'Bowler': 0, 'All-Rounder': 0, 'Wicket-Keeper Batter': 0 };
  list.forEach(p => { if (r[p.role] != null) r[p.role]++; });
  return r;
}
function leaderboard(players: Player[], key: keyof Player): Leader[] {
  return players
    .filter(p => p[key] != null)
    .map(p => ({ player: p, value: Number(p[key]) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}
function calcStandings(teams: Team[], matches: Match[]): Standing[] {
  const map: Record<string, Standing> = {};
  teams.forEach(t => { map[t.id] = { team: t, played: 0, won: 0, lost: 0, tied: 0, points: 0 }; });
  matches.forEach(m => {
    if (!m.team1Score && !m.team2Score && !m.winnerTeamId) return;
    const t1 = map[m.team1Id], t2 = map[m.team2Id];
    if (!t1 || !t2) return;
    t1.played++; t2.played++;
    if (!m.winnerTeamId) { t1.tied++; t2.tied++; t1.points++; t2.points++; }
    else if (m.winnerTeamId === m.team1Id) { t1.won++; t1.points += 2; t2.lost++; }
    else { t2.won++; t2.points += 2; t1.lost++; }
  });
  return Object.values(map).sort((a, b) => b.points - a.points || b.won - a.won);
}

function computeAnalytics(data: LeagueWithPlayers, matches: Match[]) {
  const players = data.players;
  const teams = data.teams ?? [];
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  // Sold (with a real winning bid) — icons have a team but no price
  const withPrice = players.filter(p => p.teamId && (p.soldPrice ?? 0) > 0);
  const prices = withPrice.map(p => p.soldPrice!).sort((a, b) => a - b);
  const totalSpend = prices.reduce((s, n) => s + n, 0);
  const highest = prices.length ? prices[prices.length - 1] : 0;
  const lowest = prices.length ? prices[0] : 0;
  const avg = prices.length ? totalSpend / prices.length : 0;
  const median = prices.length
    ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)
    : 0;

  const onTeam = players.filter(p => p.teamId);
  const icons = players.filter(p => p.isIcon);
  const unsold = players.filter(p => p.isUnsold);
  const notAuctioned = players.filter(p => !p.teamId && !p.isUnsold);
  const totalBudget = teams.reduce((s, t) => s + t.budget, 0);

  // Top / bargain bids
  const byPriceDesc = [...withPrice].sort((a, b) => b.soldPrice! - a.soldPrice!);
  const top5 = byPriceDesc.slice(0, 5);
  const bottom5 = [...byPriceDesc].reverse().slice(0, 5);

  // Team grouping — include every real team, plus ad-hoc team names typed in
  // the auction (teamId that doesn't match a Team row).
  const realIds = new Set(teams.map(t => t.id));
  const adHocIds = [...new Set(onTeam.map(p => p.teamId!).filter(tid => !realIds.has(tid)))];
  const keys = [...teams.map(t => t.id), ...adHocIds];
  const teamMeta: Record<string, TeamMeta> = {};
  keys.forEach(k => {
    const t = teamById[k];
    teamMeta[k] = {
      name: t?.name ?? k, color: t?.colorHex ?? '#64748b',
      budget: t?.budget ?? null, maxPlayers: t?.maxPlayers ?? null,
    };
  });

  const teamStats: TeamStat[] = keys.map(k => {
    const meta = teamMeta[k];
    const squad = players.filter(p => p.teamId === k);
    const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const bought = squad.filter(p => (p.soldPrice ?? 0) > 0).length;
    const remaining = meta.budget != null ? meta.budget - spent : null;
    const utilization = meta.budget && meta.budget > 0 ? (spent / meta.budget) * 100 : null;
    const maxBuy = squad.reduce<Player | null>((mx, p) => ((p.soldPrice ?? 0) > (mx?.soldPrice ?? 0) ? p : mx), null);
    return {
      key: k, meta, squad, count: squad.length, bought, spent, remaining, utilization,
      avg: bought ? spent / bought : 0, maxBuy, icons: squad.filter(p => p.isIcon).length,
      roleCounts: roleBreakdown(squad),
      slotsLeft: meta.maxPlayers != null ? Math.max(0, meta.maxPlayers - squad.length) : null,
    };
  }).sort((a, b) => b.spent - a.spent || b.count - a.count);

  // League-wide distributions
  const roleDist = roleBreakdown(players);
  const batDist = {
    'Right-Hand Bat': players.filter(p => p.battingType === 'Right-Hand Bat').length,
    'Left-Hand Bat': players.filter(p => p.battingType === 'Left-Hand Bat').length,
  };
  const wkCount = players.filter(p => p.isWicketKeeper).length;
  const bowlDist: Record<string, number> = {};
  players.forEach(p => { if (p.bowlingType && p.bowlingType !== 'N/A') bowlDist[p.bowlingType] = (bowlDist[p.bowlingType] ?? 0) + 1; });

  // Price histogram — 5 buckets across the range
  const N = 5;
  const buckets = [] as { lo: number; hi: number; count: number }[];
  if (prices.length && highest > 0) {
    const size = highest / N;
    for (let i = 0; i < N; i++) buckets.push({ lo: i * size, hi: (i + 1) * size, count: 0 });
    prices.forEach(p => { buckets[Math.min(N - 1, Math.floor(p / size))].count++; });
  }

  // Performance stats (only if any player has them)
  const hasStats = players.some(p => p.statsRuns != null || p.statsWickets != null || p.statsMatches != null || p.statsAverage != null || p.statsSR != null);
  const topRuns = leaderboard(players, 'statsRuns');
  const topWickets = leaderboard(players, 'statsWickets');
  const topAvg = leaderboard(players, 'statsAverage');
  const topSR = leaderboard(players, 'statsSR');

  // Matches
  const standings = calcStandings(teams, matches);
  const playedMatches = matches.filter(m => m.winnerTeamId || m.team1Score || m.team2Score);
  const leader = standings.find(s => s.played > 0) ?? null;

  return {
    players, teams, teamMeta,
    counts: { total: players.length, onTeam: onTeam.length, sold: withPrice.length, icons: icons.length, unsold: unsold.length, notAuctioned: notAuctioned.length, teams: teams.length },
    money: { totalSpend, totalBudget, highest, lowest, avg, median },
    top5, bottom5, teamStats,
    roleDist, batDist, bowlDist, wkCount,
    buckets,
    hasStats, topRuns, topWickets, topAvg, topSR,
    matches: { played: playedMatches.length, total: matches.length, leader, standings },
  };
}

type Analytics = ReturnType<typeof computeAnalytics>;

/* ── Small UI primitives ────────────────────────────────────────────────── */
function StatTile({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" style={accent ? { color: accent } : undefined} />
        <span className="text-[10.5px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children, delay }: { icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode; delay?: number }) {
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={delay ? { animationDelay: `${delay}s` } : undefined}>
      <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, color, right }: { label: React.ReactNode; value: number; max: number; color: string; right: React.ReactNode }) {
  const pct = max > 0 && value > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium truncate flex items-center gap-1.5">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">{right}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function TeamDot({ color }: { color: string }) {
  return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}70` }} />;
}

function BidList({ items, meta, accent }: { items: Player[]; meta: Record<string, TeamMeta>; accent: string }) {
  return (
    <ol className="divide-y divide-border/60">
      {items.map((p, i) => {
        const m = p.teamId ? meta[p.teamId] : undefined;
        return (
          <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="w-5 text-center text-sm font-black tabular-nums" style={{ color: i === 0 ? accent : undefined, opacity: i === 0 ? 1 : 0.4 }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate flex items-center gap-1.5">
                {p.isIcon && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                {p.name}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                {m && <TeamDot color={m.color} />}
                <span className="truncate">{m?.name ?? '—'}</span>
                <span className="opacity-50">·</span>{ROLE_SHORT[p.role] ?? p.role}
              </p>
            </div>
            <span className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400 shrink-0">{fmt(p.soldPrice ?? 0)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StatLeader({ icon: Icon, title, unit, items, color }: { icon: LucideIcon; title: string; unit: string; items: Leader[]; color: string }) {
  if (items.length === 0) return null;
  const max = items[0].value;
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color }} />{title}
      </p>
      <div className="space-y-2.5">
        {items.map((l) => (
          <Bar key={l.player.id} label={l.player.name} value={l.value} max={max} color={color}
            right={<span className="font-semibold text-foreground">{l.value % 1 === 0 ? l.value : l.value.toFixed(1)}{unit && ` ${unit}`}</span>} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [lr, mr] = await Promise.all([
      fetch(`/api/leagues/${id}`),
      fetch(`/api/leagues/${id}/matches`),
    ]);
    if (!lr.ok) { router.push('/'); return; }
    const league: LeagueWithPlayers = await lr.json();
    // Analytics are open on public leagues; private ones stay creator-only
    if (!league.canManage && !league.isPublic) { router.push(`/leagues/${id}`); return; }
    setData(league);
    setMatches(mr.ok ? await mr.json() : []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const a: Analytics | null = useMemo(() => (data ? computeAnalytics(data, matches) : null), [data, matches]);

  if (loading || !data || !a) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-8 w-56 bg-muted rounded-lg mb-2 shimmer" />
        <div className="h-4 w-40 bg-muted rounded-lg mb-8 shimmer" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <div key={n} className="h-24 rounded-2xl bg-muted shimmer" />)}
        </div>
        <div className="space-y-4">{[1, 2, 3].map(n => <div key={n} className="h-48 rounded-2xl bg-muted shimmer" />)}</div>
      </div>
    );
  }

  const { counts, money, teamStats, top5, bottom5, teamMeta } = a;
  const maxSpend = Math.max(1, ...teamStats.map(t => t.spent));
  const maxRole = Math.max(1, ...ROLES.map(r => a.roleDist[r]));
  const maxBowl = Math.max(1, ...Object.values(a.bowlDist));
  const maxBucket = Math.max(1, ...a.buckets.map(b => b.count));
  const hasAuction = counts.sold > 0 || counts.icons > 0 || teamStats.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-7 animate-fade-in-up">
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />Back to League
        </button>
        <h1 className="text-2xl sm:text-3xl font-black text-gradient-green tracking-tight flex items-center gap-2.5">
          <BarChart2 className="w-6 h-6 text-green-600 dark:text-green-400" />League Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{data.name} · Conducted by {data.conductedBy}</p>
      </div>

      {counts.total === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground animate-fade-in-up">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No players yet — analytics will appear once players are added and the auction runs.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in-up">
            <StatTile icon={Users} label="Players" value={counts.total} sub={`${counts.onTeam} on a team`} />
            <StatTile icon={Gavel} label="Sold" value={counts.sold} sub={`${counts.notAuctioned} not auctioned`} accent="#22c55e" />
            <StatTile icon={Star} label="Icons" value={counts.icons} sub="pre-assigned" accent="#f59e0b" />
            <StatTile icon={TrendingDown} label="Unsold" value={counts.unsold} accent="#f97316" />
            <StatTile icon={Shield} label="Teams" value={counts.teams || teamStats.length} />
            <StatTile icon={Coins} label="Total Spend" value={fmt(money.totalSpend)} sub={money.totalBudget > 0 ? `of ${fmt(money.totalBudget)} budget` : undefined} accent="#22c55e" />
            <StatTile icon={Crown} label="Highest Bid" value={fmt(money.highest)} accent="#f59e0b" />
            <StatTile icon={Activity} label="Avg Bid" value={fmt(money.avg)} sub={`median ${fmt(money.median)}`} />
          </div>

          {/* Top bids + bargains (bargains only when there's enough data to differ) */}
          {a.top5.length > 0 && (
            counts.sold > 5 ? (
              <div className="grid md:grid-cols-2 gap-6">
                <Section icon={Trophy} title="Top 5 Bids" subtitle="Most expensive buys of the auction">
                  <BidList items={top5} meta={teamMeta} accent="#f59e0b" />
                </Section>
                <Section icon={TrendingDown} title="Bargain Buys" subtitle="Lowest winning bids">
                  <BidList items={bottom5} meta={teamMeta} accent="#38bdf8" />
                </Section>
              </div>
            ) : (
              <Section icon={Trophy} title="Top Bids" subtitle="Highest winning bids of the auction">
                <BidList items={top5} meta={teamMeta} accent="#f59e0b" />
              </Section>
            )
          )}

          {/* Spend by team */}
          {teamStats.length > 0 && (
            <Section icon={Wallet} title="Spend by Team" subtitle="Total outlay per squad">
              <div className="space-y-3.5">
                {teamStats.map(t => (
                  <Bar key={t.key} color={t.meta.color} value={t.spent} max={maxSpend}
                    label={<><TeamDot color={t.meta.color} />{t.meta.name}</>}
                    right={<>{fmt(t.spent)}{t.meta.budget != null && <span className="opacity-50"> / {fmt(t.meta.budget)}</span>}</>} />
                ))}
              </div>
            </Section>
          )}

          {/* Team-wise detailed table */}
          {teamStats.length > 0 && (
            <Section icon={Users} title="Team-wise Analytics" subtitle="Squad size, spend, budget and composition">
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 pr-2 text-left font-semibold">Team</th>
                      <th className="px-2 py-2.5 text-center font-semibold">Players</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Spent</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Remaining</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Avg</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Top Buy</th>
                      <th className="px-2 py-2.5 text-center font-semibold">Used</th>
                      <th className="pl-2 py-2.5 text-center font-semibold">BAT / BOWL / AR / WK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map(t => (
                      <tr key={t.key} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2 font-medium">
                            <TeamDot color={t.meta.color} />
                            <span className="truncate">{t.meta.name}</span>
                            {t.icons > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500"><Star className="w-2.5 h-2.5 fill-current" />{t.icons}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">
                          {t.count}{t.meta.maxPlayers != null && <span className="opacity-50">/{t.meta.maxPlayers}</span>}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums font-semibold">{fmt(t.spent)}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-green-600 dark:text-green-400">{t.remaining != null ? fmt(t.remaining) : '—'}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">{t.bought ? fmt(t.avg) : '—'}</td>
                        <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">
                          {t.maxBuy && (t.maxBuy.soldPrice ?? 0) > 0
                            ? <span title={t.maxBuy.name}>{fmt(t.maxBuy.soldPrice ?? 0)}</span>
                            : '—'}
                        </td>
                        <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{t.utilization != null ? `${Math.round(t.utilization)}%` : '—'}</td>
                        <td className="pl-2 py-3 text-center tabular-nums text-xs text-muted-foreground">
                          {t.roleCounts['Batter']} · {t.roleCounts['Bowler']} · {t.roleCounts['All-Rounder']} · {t.roleCounts['Wicket-Keeper Batter']}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Squad composition */}
          <div className="grid md:grid-cols-2 gap-6">
            <Section icon={Target} title="Role Distribution" subtitle={`${counts.total} players · ${a.wkCount} wicket-keepers`}>
              <div className="space-y-3.5">
                {ROLES.map((r, i) => (
                  <Bar key={r} label={r} value={a.roleDist[r]} max={maxRole}
                    color={['#22c55e', '#38bdf8', '#a855f7', '#f59e0b'][i]}
                    right={<span className="font-semibold text-foreground">{a.roleDist[r]}</span>} />
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Right-Hand Bat</span>
                  <span className="font-semibold tabular-nums">{a.batDist['Right-Hand Bat']}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Left-Hand Bat</span>
                  <span className="font-semibold tabular-nums">{a.batDist['Left-Hand Bat']}</span>
                </div>
              </div>
            </Section>

            <Section icon={Zap} title="Bowling Types" subtitle="Across all players">
              {Object.keys(a.bowlDist).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No bowling data.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(a.bowlDist).sort((x, y) => y[1] - x[1]).map(([type, n]) => (
                    <Bar key={type} label={type} value={n} max={maxBowl} color="#10b981"
                      right={<span className="font-semibold text-foreground">{n}</span>} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Price distribution */}
          {a.buckets.length > 0 && (
            <Section icon={BarChart2} title="Price Distribution" subtitle={`Lowest ${fmt(money.lowest)} · Highest ${fmt(money.highest)} · Avg ${fmt(money.avg)} · Median ${fmt(money.median)}`}>
              <div className="flex items-end gap-2 h-40">
                {a.buckets.map((b, i) => {
                  const h = maxBucket > 0 ? Math.max(4, Math.round((b.count / maxBucket) * 100)) : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                      <span className="text-xs font-semibold tabular-nums text-foreground">{b.count || ''}</span>
                      <div className="w-full rounded-t-lg bg-linear-to-t from-green-600 to-emerald-400 transition-all duration-500" style={{ height: `${h}%` }} />
                      <span className="text-[10px] text-muted-foreground tabular-nums text-center leading-tight">{fmt(b.lo)}–{fmt(b.hi)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Performance leaderboards */}
          {a.hasStats && (
            <Section icon={TrendingUp} title="Performance Leaders" subtitle="From player career stats">
              <div className="grid sm:grid-cols-2 gap-4">
                <StatLeader icon={TrendingUp} title="Most Runs" unit="" items={a.topRuns} color="#22c55e" />
                <StatLeader icon={Target} title="Most Wickets" unit="" items={a.topWickets} color="#38bdf8" />
                <StatLeader icon={Activity} title="Best Average" unit="" items={a.topAvg} color="#a855f7" />
                <StatLeader icon={Percent} title="Best Strike Rate" unit="" items={a.topSR} color="#f59e0b" />
              </div>
            </Section>
          )}

          {/* Matches summary */}
          {a.matches.total > 0 && (
            <Section icon={Trophy} title="Matches & Standings" subtitle={`${a.matches.played} of ${a.matches.total} played`}>
              {a.matches.leader && (
                <div className="flex items-center gap-2.5 mb-4 text-sm">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span className="text-muted-foreground">League leader</span>
                  <TeamDot color={a.matches.leader.team.colorHex} />
                  <span className="font-semibold">{a.matches.leader.team.name}</span>
                  <span className="text-muted-foreground tabular-nums">· {a.matches.leader.points} pts</span>
                </div>
              )}
              <div className="space-y-2">
                {a.matches.standings.filter(s => s.played > 0).map((s, i) => (
                  <div key={s.team.id} className="flex items-center gap-3 text-sm">
                    <span className="w-4 text-center text-xs font-bold tabular-nums text-muted-foreground/60">{i + 1}</span>
                    <TeamDot color={s.team.colorHex} />
                    <span className="flex-1 truncate font-medium">{s.team.name}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">{s.played}P · {s.won}W · {s.lost}L · {s.tied}T</span>
                    <span className="w-10 text-right font-bold tabular-nums">{s.points}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push(`/leagues/${id}/matches`)}
                className="mt-4 text-sm text-green-600 dark:text-green-400 hover:underline underline-offset-2">
                View all matches →
              </button>
            </Section>
          )}

          {!hasAuction && (
            <p className="text-center text-sm text-muted-foreground py-2">
              Run the auction to unlock bid, spend and team analytics.
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground/60 pt-2">
            {fmtFull(money.totalSpend)} spent across {counts.sold} sold player{counts.sold !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
