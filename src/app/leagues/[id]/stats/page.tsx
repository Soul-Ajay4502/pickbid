'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, Crown } from 'lucide-react';
import type { BattingRow, BowlingRow, FieldingRow, LeagueStats } from '@/lib/scoring';
import type { LeagueNavSummary } from '@/lib/types';
import { cloudinaryImage, cn } from '@/lib/utils';
import { useLeagueRevision } from '@/components/league/LeagueChrome';

interface StatsPayload extends LeagueStats {
  leagueName: string;
  teams: { id: string; name: string; colorHex: string }[];
  photos: Record<string, string>;
}

type Board = 'batting' | 'bowling' | 'fielding';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Avatar({ name, photo, color, size = 40 }: { name: string; photo?: string; color: string; size?: number }) {
  return (
    <span className="relative rounded-full overflow-hidden shrink-0 flex items-center justify-center font-black text-white/90"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>
      {initials(name)}
      {photo && (
        <span className="absolute inset-0 bg-cover bg-top"
          style={{ backgroundImage: `url(${cloudinaryImage(photo, { w: size * 2, h: size * 2 })})` }} />
      )}
    </span>
  );
}

/** The cap holder for a board: most runs, most wickets, most dismissals. */
function CapCard({ title, accent, name, teamName, color, photo, value, detail }: {
  title: string; accent: string; name: string; teamName: string; color: string; photo?: string; value: string; detail: string;
}) {
  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-4', accent)}>
      <Avatar name={name} photo={photo} color={color} size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1"><Crown className="w-3.5 h-3.5" />{title}</p>
        <p className="text-lg font-black truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{teamName} · {detail}</p>
      </div>
      <p className="text-3xl font-black tabular-nums shrink-0">{value}</p>
    </div>
  );
}

export default function LeagueStatsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const revision = useLeagueRevision();
  const [data, setData] = useState<StatsPayload | null>(null);
  const [board, setBoard] = useState<Board>('batting');

  useEffect(() => {
    let active = true;
    (async () => {
      const [nr, sr] = await Promise.all([fetch(`/api/leagues/${id}/nav`), fetch(`/api/leagues/${id}/stats`)]);
      if (!active) return;
      if (!nr.ok || !sr.ok) { router.push('/'); return; }
      const nav = (await nr.json()) as LeagueNavSummary;
      // Open on public leagues, organizers-only on private ones — as the leaderboard
      if (!nav.canManage && !nav.isPublic) { router.push(`/leagues/${id}`); return; }
      const stats = (await sr.json()) as StatsPayload;
      if (active) setData(stats);
    })().catch(() => { /* leave the skeleton; the rail still works */ });
    return () => { active = false; };
  }, [id, router, revision]);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-3">
        <div className="h-8 w-56 bg-muted rounded-lg shimmer" />
        <div className="grid sm:grid-cols-3 gap-3">{[1, 2, 3].map((n) => <div key={n} className="h-24 rounded-2xl bg-muted shimmer" />)}</div>
        {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-12 rounded-xl bg-muted shimmer" />)}
      </div>
    );
  }

  const team = (teamId: string) => data.teams.find((t) => t.id === teamId) ?? { id: teamId, name: '—', colorHex: '#64748b' };
  const topBat: BattingRow | undefined = data.batting[0];
  const topBowl: BowlingRow | undefined = data.bowling[0];
  const topField: FieldingRow | undefined = data.fielding[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-7 animate-fade-in-up">
        <Link href={`/leagues/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />Back to League
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-gradient-green tracking-tight flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-primary" />Player Stats
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.leagueName} · from {data.matches} match{data.matches === 1 ? '' : 'es'} scored ball by ball
        </p>
      </div>

      {data.matches === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No stats yet — they fill up as matches are scored live from the Matches screen.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {topBat && (
              <CapCard title="Orange cap" accent="border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300"
                name={topBat.name} teamName={team(topBat.teamId).name} color={team(topBat.teamId).colorHex} photo={data.photos[topBat.id]}
                value={String(topBat.runs)} detail={`${topBat.innings} inns · SR ${topBat.strikeRate ?? '—'}`} />
            )}
            {topBowl && (
              <CapCard title="Purple cap" accent="border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300"
                name={topBowl.name} teamName={team(topBowl.teamId).name} color={team(topBowl.teamId).colorHex} photo={data.photos[topBowl.id]}
                value={String(topBowl.wickets)} detail={`${topBowl.overs} ov · Econ ${topBowl.economy ?? '—'}`} />
            )}
            {topField && (
              <CapCard title="Best fielder" accent="border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300"
                name={topField.name} teamName={team(topField.teamId).name} color={team(topField.teamId).colorHex} photo={data.photos[topField.id]}
                value={String(topField.dismissals)} detail={`${topField.catches} ct · ${topField.runOuts} ro · ${topField.stumpings} st`} />
            )}
          </div>

          <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 mb-4" aria-label="Stats boards">
            {(['batting', 'bowling', 'fielding'] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBoard(b)} aria-current={board === b ? 'page' : undefined}
                className={cn('flex-1 h-9 rounded-lg text-sm font-semibold capitalize transition-colors',
                  board === b ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {b}
              </button>
            ))}
          </nav>

          <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-2 text-left font-semibold w-8">#</th>
                  <th className="py-2.5 px-2 text-left font-semibold">Player</th>
                  {board === 'batting' && ['Inns', 'Runs', 'HS', 'Avg', 'SR', '4s', '6s', '50s'].map((h) => <th key={h} className="py-2.5 px-2 text-right font-semibold">{h}</th>)}
                  {board === 'bowling' && ['Inns', 'Overs', 'Wkts', 'Runs', 'Best', 'Econ', 'Avg', 'Mdns'].map((h) => <th key={h} className="py-2.5 px-2 text-right font-semibold">{h}</th>)}
                  {board === 'fielding' && ['Catches', 'Run outs', 'Stumpings', 'Total'].map((h) => <th key={h} className="py-2.5 px-2 text-right font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {board === 'batting' && data.batting.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pl-4 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 px-2"><PlayerCell name={r.name} team={team(r.teamId)} photo={data.photos[r.id]} /></td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.innings}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-black">{r.runs}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.highest}{r.highestNotOut ? '*' : ''}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.average ?? '—'}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.strikeRate ?? '—'}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.fours}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.sixes}</td>
                    <td className="py-2.5 px-2 pr-4 text-right tabular-nums text-muted-foreground">{r.fifties + r.hundreds}</td>
                  </tr>
                ))}
                {board === 'bowling' && data.bowling.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pl-4 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 px-2"><PlayerCell name={r.name} team={team(r.teamId)} photo={data.photos[r.id]} /></td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.innings}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.overs}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-black">{r.wickets}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.runs}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.best ? `${r.best.wickets}/${r.best.runs}` : '—'}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.economy ?? '—'}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">{r.average ?? '—'}</td>
                    <td className="py-2.5 px-2 pr-4 text-right tabular-nums text-muted-foreground">{r.maidens}</td>
                  </tr>
                ))}
                {board === 'fielding' && data.fielding.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pl-4 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 px-2"><PlayerCell name={r.name} team={team(r.teamId)} photo={data.photos[r.id]} /></td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.catches}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.runOuts}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{r.stumpings}</td>
                    <td className="py-2.5 px-2 pr-4 text-right tabular-nums font-black">{r.dismissals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {((board === 'batting' && data.batting.length === 0) || (board === 'bowling' && data.bowling.length === 0) || (board === 'fielding' && data.fielding.length === 0)) && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PlayerCell({ name, team, photo }: { name: string; team: { name: string; colorHex: string }; photo?: string }) {
  return (
    <span className="flex items-center gap-2.5 min-w-40">
      <Avatar name={name} photo={photo} color={team.colorHex} size={32} />
      <span className="min-w-0">
        <span className="block font-semibold truncate">{name}</span>
        <span className="block text-xs text-muted-foreground truncate">{team.name}</span>
      </span>
    </span>
  );
}
