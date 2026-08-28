'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatINR } from '@/lib/utils';
import type { AdminOverview, AdminLeagueRow, AdminUserRow, AdminTrendPoint } from '@/lib/types';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
  ShieldCheck, LogOut, RefreshCw, Trophy, Users, IdCard, Wallet, Shield, Gavel,
  Globe, Lock, DoorClosed, DoorOpen, Award, RotateCcw, RadioTower, Trash2, Search, Star,
} from 'lucide-react';

/**
 * Series colors for the growth facets. Validated with the data-viz palette
 * checker against this app's own surfaces (light #f7f9fb, dark #010205), all
 * pairs, both modes: lightness band, chroma floor, CVD separation and
 * normal-vision separation all pass. Light mode warns on aqua's 2.67:1 contrast,
 * which the relief rule covers — each facet carries a visible total and a
 * labelled peak, and every underlying number is also in the tables below.
 */
const SERIES = {
  leagues: { light: '#1baf7a', dark: '#199e70' },
  players: { light: '#2a78d6', dark: '#3987e5' },
};

type AdminPayload = { overview: AdminOverview; leagues: AdminLeagueRow[]; users: AdminUserRow[] };
type Tab = 'analytics' | 'leagues' | 'users';

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function fullDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Bar with only its top corners rounded, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// ── Growth facet ────────────────────────────────────────────────────────────
// One series per facet with its own y-scale. Leagues and player cards differ by
// an order of magnitude, so they are deliberately small multiples rather than
// two series sharing an axis — a second y-scale on one chart would make the
// slopes lie.
function GrowthFacet({
  title, points, values, color, unit,
}: {
  title: string;
  points: AdminTrendPoint[];
  values: number[];
  color: { light: string; dark: string };
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 900, H = 108, AXIS = 20, GAP = 2;
  const slot = W / values.length;
  const barW = Math.max(1, slot - GAP);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);
  const peak = values.indexOf(Math.max(...values));

  return (
    <section className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        {/* Direct label — the relief the contrast check requires, and the
            headline the chart is actually there to support. */}
        <p className="text-sm text-muted-foreground">
          <span className="text-lg font-bold text-foreground">{total}</span> in 30 days
        </p>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H + AXIS}`} width="100%" height={H + AXIS}
          role="img" aria-label={`${title}: ${total} over the last 30 days`}
          className="overflow-visible"
          onMouseLeave={() => setHover(null)}
        >
          {/* Solid hairline baseline — never dashed */}
          <line x1={0} y1={H} x2={W} y2={H} stroke="currentColor" strokeWidth={1} className="text-foreground/15" />

          {values.map((v, i) => {
            const h = v === 0 ? 0 : Math.max(3, (v / max) * (H - 12));
            const x = i * slot;
            return (
              <g key={points[i].date}>
                {h > 0 && (
                  <path
                    d={barPath(x, H - h, barW, h)}
                    className="fill-[var(--series)] dark:fill-[var(--series-dark)]"
                    style={{ '--series': color.light, '--series-dark': color.dark } as React.CSSProperties}
                    opacity={hover === null || hover === i ? 1 : 0.4}
                  />
                )}
                {/* Full-height hit area — wider than the mark, includes the gap */}
                <rect
                  x={x} y={0} width={slot} height={H + AXIS} fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}

          {/* Selective labels only: the two ends of the window, plus the peak */}
          <text x={0} y={H + 14} className="fill-foreground/35" fontSize={11}>{shortDate(points[0].date)}</text>
          <text x={W} y={H + 14} textAnchor="end" className="fill-foreground/35" fontSize={11}>
            {shortDate(points[points.length - 1].date)}
          </text>
          {total > 0 && (
            // The peak bar is by definition the full plot height, so its label
            // always sits in the 12px headroom left above it.
            <text
              x={Math.min(W - 30, Math.max(20, peak * slot + barW / 2))} y={6}
              textAnchor="middle" fontSize={11} className="fill-foreground/55 font-semibold"
            >
              {max}
            </text>
          )}
        </svg>

        {hover !== null && (() => {
          // Float the tooltip inside the plot rather than above the card, and
          // flip it to the inside of whichever edge it is near so a hover on
          // day 1 or day 30 can't hang off the card.
          const pct = ((hover + 0.5) / values.length) * 100;
          const anchor = pct < 15 ? 'left-0' : pct > 85 ? 'right-0' : '-translate-x-1/2';
          return (
            <div
              className={`pointer-events-none absolute top-0 z-10 rounded-lg border border-foreground/15 bg-background px-2.5 py-1.5 shadow-lg whitespace-nowrap ${anchor}`}
              style={anchor === '-translate-x-1/2' ? { left: `${pct}%` } : undefined}
            >
              <p className="text-[11px] text-muted-foreground">{shortDate(points[hover].date)}</p>
              <p className="text-sm font-semibold tabular-nums">{values[hover]} {unit}</p>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, sub }: {
  icon: typeof Trophy; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {/* Proportional figures on hero values — tabular-nums only in tables */}
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Toggle({ on, onLabel, offLabel, onIcon: OnIcon, offIcon: OffIcon, onClick, busy }: {
  on: boolean; onLabel: string; offLabel: string;
  onIcon: typeof Globe; offIcon: typeof Lock;
  onClick: () => void; busy: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={busy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
        on
          ? 'border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400'
          : 'border-foreground/15 bg-foreground/5 text-muted-foreground hover:text-foreground'
      }`}
    >
      {on ? <OnIcon className="w-3 h-3" /> : <OffIcon className="w-3 h-3" />}
      {on ? onLabel : offLabel}
    </button>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('analytics');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  // League awaiting delete confirmation (null = dialog closed)
  const [leagueToDelete, setLeagueToDelete] = useState<AdminLeagueRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  /** Every league control funnels through here so one refresh keeps totals honest. */
  const act = useCallback(async (
    league: AdminLeagueRow,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusyId(league.id);
    try {
      const res = await fetch(`/api/admin/leagues/${league.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(successMessage);
      await load();
    } catch {
      toast.error('Action failed');
    } finally {
      setBusyId('');
    }
  }, [load]);

  async function removeLeague(league: AdminLeagueRow) {
    setBusyId(league.id);
    try {
      const res = await fetch(`/api/admin/leagues/${league.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(`"${league.name}" deleted`);
      setLeagueToDelete(null);
      await load();
    } catch {
      // Dialog stays open so the delete can be retried without re-confirming.
      toast.error('Delete failed');
    } finally {
      setBusyId('');
    }
  }

  const leagues = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.leagues;
    return data.leagues.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      l.conductedBy.toLowerCase().includes(q) ||
      l.creatorEmail.toLowerCase().includes(q)
    );
  }, [data, query]);

  const users = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.users;
    return data.users.filter((u) =>
      u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }, [data, query]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading console…</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-muted-foreground">Couldn&apos;t load admin data.</p>
        <button onClick={load} className="text-sm underline underline-offset-2">Retry</button>
      </div>
    );
  }

  const { overview } = data;
  const t = overview.totals;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-foreground/8 bg-background/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-green-500 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black tracking-tight leading-none truncate">Owner Console</h1>
              <p className="text-[11px] text-muted-foreground">Platform-wide analytics &amp; controls</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-foreground/15 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-foreground/15 text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-5 flex gap-1">
          {([
            ['analytics', 'Analytics'],
            ['leagues', `Leagues (${data.leagues.length})`],
            ['users', `Users (${data.users.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key} onClick={() => setTab(key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-green-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-6 space-y-6">
        {tab === 'analytics' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={Trophy} label="Leagues" value={t.leagues} sub={`${t.publicLeagues} public · ${overview.recent.leagues30d} new in 30d`} />
              <Stat icon={Users} label="Users" value={t.users} />
              <Stat icon={IdCard} label="Player cards" value={t.players} sub={`${overview.recent.players30d} new in 30d`} />
              <Stat icon={Wallet} label="Auction value" value={formatINR(t.auctionValue)} sub={`${t.playersSold} players sold`} />
              <Stat icon={Shield} label="Teams" value={t.teams} />
              <Stat icon={Gavel} label="Auctions run" value={t.auctionsRun} sub="leagues with at least one sale" />
              <Stat icon={Trophy} label="Matches" value={t.matches} />
              <Stat icon={Star} label="Sponsors" value={t.sponsors} />
            </div>

            <div className="grid gap-3">
              <GrowthFacet
                title="New leagues per day"
                points={overview.trend}
                values={overview.trend.map((p) => p.leagues)}
                color={SERIES.leagues}
                unit="leagues"
              />
              <GrowthFacet
                title="New player cards per day"
                points={overview.trend}
                values={overview.trend.map((p) => p.players)}
                color={SERIES.players}
                unit="cards"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              <section className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
                <h3 className="text-sm font-semibold text-foreground/80 mb-4">Player roles across the platform</h3>
                {overview.roleSplit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No player cards yet.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {overview.roleSplit.map((r) => {
                      const max = overview.roleSplit[0].count || 1;
                      return (
                        <li key={r.role} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
                          <span className="text-sm text-foreground/70 truncate">{r.role}</span>
                          <span className="h-2 rounded-full bg-foreground/8 overflow-hidden">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${(r.count / max) * 100}%`, background: SERIES.leagues.light }}
                            />
                          </span>
                          <span className="text-sm text-right tabular-nums text-foreground/60">{r.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
                <h3 className="text-sm font-semibold text-foreground/80 mb-4">Biggest sales anywhere</h3>
                {overview.topBids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed sales yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {overview.topBids.map((b, i) => (
                      <li key={b.playerId} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.teamColor }} />
                        <span className="flex-1 min-w-0 truncate">
                          {b.playerName}
                          {b.isIcon && <Star className="inline w-3 h-3 ml-1 text-amber-500 fill-amber-500" />}
                          <span className="text-muted-foreground"> · {b.leagueName}</span>
                        </span>
                        <span className="tabular-nums font-semibold shrink-0">{formatINR(b.soldPrice)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}

        {(tab === 'leagues' || tab === 'users') && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'leagues' ? 'Search by league, organizer or creator email…' : 'Search by name or email…'}
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-foreground/15 bg-foreground/5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
            />
          </div>
        )}

        {tab === 'leagues' && (
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 overflow-x-auto">
            <table className="w-full text-sm min-w-250">
              <thead>
                <tr className="border-b border-foreground/10 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left font-bold">League</th>
                  <th className="px-3 py-3 text-right font-bold">Players</th>
                  <th className="px-3 py-3 text-right font-bold">Teams</th>
                  <th className="px-3 py-3 text-right font-bold">Sold</th>
                  <th className="px-3 py-3 text-right font-bold">Value</th>
                  <th className="px-3 py-3 text-left font-bold">Created</th>
                  <th className="px-4 py-3 text-left font-bold">Controls</th>
                </tr>
              </thead>
              <tbody>
                {leagues.map((l) => (
                  <tr key={l.id} className="border-b border-foreground/5 last:border-0 align-top">
                    <td className="px-4 py-3">
                      <a
                        href={`/leagues/${l.id}`} target="_blank" rel="noopener noreferrer"
                        className="font-semibold hover:underline underline-offset-2"
                      >
                        {l.name}
                      </a>
                      <p className="text-xs text-muted-foreground">{l.conductedBy}</p>
                      <p className="text-xs text-muted-foreground/70">{l.creatorEmail}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {l.playerCount}
                      <span className="text-muted-foreground/60">/{l.totalPlayers}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{l.teamCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{l.soldCount}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">
                      {l.auctionValue > 0 ? formatINR(l.auctionValue) : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{fullDate(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Toggle
                          on={l.isPublic} onLabel="Public" offLabel="Private"
                          onIcon={Globe} offIcon={Lock} busy={busyId === l.id}
                          onClick={() => act(l, { isPublic: !l.isPublic }, l.isPublic ? 'League set to private' : 'League published')}
                        />
                        <Toggle
                          on={!l.registrationClosed} onLabel="Registration open" offLabel="Registration closed"
                          onIcon={DoorOpen} offIcon={DoorClosed} busy={busyId === l.id}
                          onClick={() => act(l, { registrationClosed: !l.registrationClosed }, l.registrationClosed ? 'Registration reopened' : 'Registration closed')}
                        />
                        <Toggle
                          on={Boolean(l.certificatesReleasedAt)} onLabel="Certificates live" offLabel="Certificates held"
                          onIcon={Award} offIcon={Award} busy={busyId === l.id}
                          onClick={() => act(
                            l,
                            { certificatesReleased: !l.certificatesReleasedAt },
                            l.certificatesReleasedAt ? 'Certificates withdrawn' : 'Certificates released'
                          )}
                        />
                        {l.hasLiveAuction && (
                          <button
                            onClick={() => act(l, { action: 'clear-live' }, 'Live broadcast cleared')}
                            disabled={busyId === l.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 disabled:opacity-50"
                          >
                            <RadioTower className="w-3 h-3" />Clear live
                          </button>
                        )}
                        {l.soldCount > 0 && (
                          <button
                            onClick={() => {
                              if (confirm(`Reset the auction for "${l.name}"? All ${l.soldCount} sales are cleared.`)) {
                                act(l, { action: 'reset-auction' }, 'Auction reset');
                              }
                            }}
                            disabled={busyId === l.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-foreground/15 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />Reset auction
                          </button>
                        )}
                        <button
                          onClick={() => setLeagueToDelete(l)} disabled={busyId === l.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {leagues.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No leagues match that search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 overflow-x-auto">
            <table className="w-full text-sm min-w-150">
              <thead>
                <tr className="border-b border-foreground/10 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left font-bold">User</th>
                  <th className="px-3 py-3 text-right font-bold">Leagues created</th>
                  <th className="px-3 py-3 text-right font-bold">Player cards</th>
                  <th className="px-3 py-3 text-left font-bold">Profile</th>
                  <th className="px-4 py-3 text-left font-bold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{u.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{u.leaguesCreated}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{u.playerCards}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {u.profileCompleted ? 'Complete' : 'Incomplete'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fullDate(u.updatedAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users match that search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Permanent league delete — a custom dialog rather than window.confirm so
          the console can show progress and stay inert until the API answers */}
      <ConfirmDialog
        open={!!leagueToDelete}
        title="Delete this league permanently?"
        description={leagueToDelete ? (
          <>
            <strong className="text-foreground">{leagueToDelete.name}</strong> — {leagueToDelete.playerCount} player
            card{leagueToDelete.playerCount === 1 ? '' : 's'}, {leagueToDelete.teamCount} team{leagueToDelete.teamCount === 1 ? '' : 's'} and all
            its matches, officials, sponsors and ledger entries go with it. This cannot be undone.
          </>
        ) : undefined}
        confirmLabel="Delete league"
        pendingLabel="Deleting…"
        onConfirm={() => { if (leagueToDelete) return removeLeague(leagueToDelete); }}
        onClose={() => setLeagueToDelete(null)}
      />
    </div>
  );
}
