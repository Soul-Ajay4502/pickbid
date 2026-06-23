'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Wallet, Users, Star, Briefcase, Shield, Copy } from 'lucide-react';
import { toast } from 'sonner';
import PlayerFullView from '@/components/PlayerFullView';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatIndianPhone, localPhoneDigits, copyToClipboard } from '@/lib/utils';
import type { LeagueWithPlayers, Player, Team, TeamOfficial } from '@/lib/types';

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Crop a Cloudinary upload to a small square avatar instead of the full image. */
function thumb(url: string) {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_64,h_64,c_fill,g_auto/');
  }
  return url;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function stat(n: number | null | undefined) {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Squad order: icon players first, then by winning bid, then by name. */
function squadOrder(a: Player, b: Player) {
  if (!!a.isIcon !== !!b.isIcon) return a.isIcon ? -1 : 1;
  const pa = a.soldPrice ?? 0, pb = b.soldPrice ?? 0;
  if (pa !== pb) return pb - pa;
  return a.name.localeCompare(b.name);
}

export default function TeamDetailPage() {
  const router = useRouter();
  const { id, teamId } = useParams<{ id: string; teamId: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  // Player whose full view is shown in the modal (null = closed)
  const [cardPlayer, setCardPlayer] = useState<Player | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/leagues/${id}`);
    if (!res.ok) { router.push('/'); return; }
    const json: LeagueWithPlayers = await res.json();
    // Public leagues are viewable by anyone; private ones stay creator-only
    if (!json.isCreator && !json.isPublic) { router.push(`/leagues/${id}`); return; }
    // A team that doesn't belong to this league has nothing to show
    if (!json.teams.some((t) => t.id === teamId)) { router.push(`/leagues/${id}/teams`); return; }
    setData(json);
    setLoading(false);
  }, [id, teamId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const view = useMemo(() => {
    if (!data) return null;
    const team = data.teams.find((t) => t.id === teamId) as Team | undefined;
    if (!team) return null;
    const squad = data.players.filter((p) => p.teamId === team.id).sort(squadOrder);
    const officials = data.officials.filter((o) => o.teamId === team.id);
    const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const remaining = team.budget - spent;
    const pct = team.budget > 0 ? Math.min(100, Math.round((spent / team.budget) * 100)) : 0;
    const icons = squad.filter((p) => p.isIcon).length;
    return { team, squad, officials, spent, remaining, pct, icons };
  }, [data, teamId]);

  if (loading || !data || !view) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-8 w-56 bg-muted rounded-lg mb-3 shimmer" />
        <div className="h-24 rounded-2xl bg-muted mb-6 shimmer" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-12 rounded-xl bg-muted shimmer" />)}
        </div>
      </div>
    );
  }

  const { team, squad, officials, spent, remaining, pct, icons } = view;

  // Contact numbers are stripped server-side for non-creators, so the column
  // and bulk-copy only make sense for the organiser.
  const canSeePhones = data.isCreator;
  const phoneEntries = squad
    .map((p) => ({ name: p.name, phone: formatIndianPhone(localPhoneDigits(p.contactNumber)) }))
    .filter((e) => e.phone);

  async function copyPhone(phone: string) {
    if (await copyToClipboard(phone)) toast.success('Phone number copied');
    else toast.error('Could not copy to clipboard');
  }

  async function copyAllPhones() {
    if (phoneEntries.length === 0) { toast.error('No phone numbers to copy'); return; }
    const text = phoneEntries.map((e) => `${e.name}: ${e.phone}`).join('\n');
    if (await copyToClipboard(text)) toast.success(`Copied ${phoneEntries.length} phone number${phoneEntries.length === 1 ? '' : 's'}`);
    else toast.error('Could not copy to clipboard');
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-7">
        <button onClick={() => router.push(`/leagues/${id}/teams`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Teams
        </button>
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full shrink-0" style={{ background: team.colorHex, boxShadow: `0 0 12px ${team.colorHex}80` }} />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">{team.name}</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">{data.name} · Conducted by {data.conductedBy}</p>
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Users className="w-3.5 h-3.5" /><span className="text-[10.5px] font-semibold uppercase tracking-wide">Squad</span>
          </div>
          <p className="text-2xl font-black tabular-nums leading-none">{squad.length}<span className="text-muted-foreground/50 text-lg">/{team.maxPlayers}</span></p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Star className="w-3.5 h-3.5" /><span className="text-[10.5px] font-semibold uppercase tracking-wide">Icons</span>
          </div>
          <p className="text-2xl font-black tabular-nums leading-none">{icons}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Wallet className="w-3.5 h-3.5" /><span className="text-[10.5px] font-semibold uppercase tracking-wide">Spent</span>
          </div>
          <p className="text-2xl font-black tabular-nums leading-none">{fmt(spent)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
            <Wallet className="w-3.5 h-3.5" /><span className="text-[10.5px] font-semibold uppercase tracking-wide">Remaining</span>
          </div>
          <p className={`text-2xl font-black tabular-nums leading-none ${remaining < 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{fmt(remaining)}</p>
        </div>
      </div>

      {/* Budget bar */}
      <div className="mb-8 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{fmt(spent)} spent of {fmt(team.budget)}</span>
          <span>{pct}% used</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--destructive)' : team.colorHex }} />
        </div>
      </div>

      {/* Officials */}
      {officials.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
            <Briefcase className="w-3.5 h-3.5" /> Team Officials
          </p>
          <div className="flex flex-wrap gap-2">
            {officials.map((o: TeamOfficial) => (
              <div key={o.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                {o.photo
                  ? <span className="w-8 h-8 rounded-full bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${o.photo})` }} />
                  : <span className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0"><Briefcase className="w-3.5 h-3.5" /></span>}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{o.role}{o.contactNumber ? ` · ${o.contactNumber}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Squad
        </p>
        {canSeePhones && phoneEntries.length > 0 && (
          <button onClick={copyAllPhones} className="toolbar-btn" title="Copy every player's name and phone number">
            <Copy className="w-3.5 h-3.5" />Copy all numbers
          </button>
        )}
      </div>
      {squad.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-muted-foreground text-sm">No players in this team yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                  <th className="py-3 pl-4 pr-2 text-left font-semibold">#</th>
                  <th className="px-2 py-3 text-left font-semibold">Player</th>
                  <th className="px-2 py-3 text-left font-semibold">Role</th>
                  <th className="px-2 py-3 text-left font-semibold">Batting</th>
                  <th className="px-2 py-3 text-left font-semibold">Bowling</th>
                  <th className="px-2 py-3 text-center font-semibold" title="Matches">Mat</th>
                  <th className="px-2 py-3 text-center font-semibold" title="Runs">Runs</th>
                  <th className="px-2 py-3 text-center font-semibold" title="Wickets">Wkts</th>
                  <th className="px-2 py-3 text-center font-semibold" title="Average">Avg</th>
                  <th className="px-2 py-3 text-center font-semibold" title="Strike Rate">SR</th>
                  {canSeePhones && <th className="px-2 py-3 text-left font-semibold">Phone</th>}
                  <th className="px-2 py-3 pr-4 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((player: Player, i) => (
                  <tr key={player.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-3 pl-4 pr-2 text-muted-foreground/60 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-3">
                      <button onClick={() => setCardPlayer(player)} title="View full card"
                        className="flex items-center gap-2.5 text-left group/name">
                        {player.photo
                          ? <span className="w-8 h-8 rounded-full bg-cover bg-center shrink-0 border border-border" style={{ backgroundImage: `url(${thumb(player.photo)})` }} />
                          : <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-bold shrink-0">{initials(player.name)}</span>}
                        <span className="font-medium text-foreground flex items-center gap-1.5 group-hover/name:text-primary transition-colors">
                          {player.name}
                          {player.isIcon && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <Star className="w-2.5 h-2.5 fill-current" />Icon
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {player.role}{player.isWicketKeeper && player.role !== 'Wicket-Keeper Batter' ? ' (WK)' : ''}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{player.battingType}</td>
                    <td className="px-2 py-3 text-muted-foreground">{player.bowlingType}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{stat(player.statsMatches)}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{stat(player.statsRuns)}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{stat(player.statsWickets)}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{stat(player.statsAverage)}</td>
                    <td className="px-2 py-3 text-center tabular-nums text-muted-foreground">{stat(player.statsSR)}</td>
                    {canSeePhones && (
                      <td className="px-2 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                        {player.contactNumber
                          ? <button onClick={() => copyPhone(formatIndianPhone(localPhoneDigits(player.contactNumber)))}
                              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors" title="Copy phone number">
                              <Copy className="w-3 h-3 opacity-60" />{formatIndianPhone(localPhoneDigits(player.contactNumber))}
                            </button>
                          : '—'}
                      </td>
                    )}
                    <td className="px-2 py-3 pr-4 text-right tabular-nums font-semibold text-green-600 dark:text-green-400">
                      {player.isIcon && !player.soldPrice ? '—' : fmt(player.soldPrice ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full player view */}
      <Dialog open={!!cardPlayer} onOpenChange={(open) => { if (!open) setCardPlayer(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 max-h-[92vh] overflow-y-auto bg-transparent ring-0 shadow-none">
          <DialogTitle className="sr-only">{cardPlayer?.name ?? 'Player'} details</DialogTitle>
          {cardPlayer && (
            <PlayerFullView
              player={cardPlayer}
              team={{ name: team.name, colorHex: team.colorHex }}
              leagueName={data.name}
              conductedBy={data.conductedBy}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
