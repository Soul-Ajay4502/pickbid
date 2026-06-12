'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Trophy, Minus } from 'lucide-react';
import type { LeagueWithPlayers, Team, Match } from '@/lib/types';

interface Standing {
  team: Team;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
}

function calcStandings(teams: Team[], matches: Match[]): Standing[] {
  const map: Record<string, Standing> = {};
  teams.forEach(t => { map[t.id] = { team: t, played: 0, won: 0, lost: 0, tied: 0, points: 0 }; });

  matches.forEach(m => {
    if (!m.team1Score && !m.team2Score && !m.winnerTeamId) return; // unplayed
    const t1 = map[m.team1Id], t2 = map[m.team2Id];
    if (!t1 || !t2) return;
    t1.played++; t2.played++;
    if (!m.winnerTeamId) { // no-result / tie
      t1.tied++; t2.tied++; t1.points++; t2.points++;
    } else if (m.winnerTeamId === m.team1Id) {
      t1.won++; t1.points += 2; t2.lost++;
    } else {
      t2.won++; t2.points += 2; t1.lost++;
    }
  });

  return Object.values(map).sort((a, b) => b.points - a.points || b.won - a.won);
}

export default function MatchesPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ team1Id: '', team2Id: '', team1Score: '', team2Score: '', winnerTeamId: '', matchDate: '' });

  const fetchAll = useCallback(async () => {
    const [lr, mr] = await Promise.all([
      fetch(`/api/leagues/${id}`),
      fetch(`/api/leagues/${id}/matches`),
    ]);
    if (!lr.ok) { router.push('/'); return; }
    const league: LeagueWithPlayers = await lr.json();
    const matchList: Match[] = mr.ok ? await mr.json() : [];
    setData(league);
    setMatches(matchList);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.team1Id || !form.team2Id || form.team1Id === form.team2Id) {
      toast.error('Select two different teams');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/leagues/${id}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team1Id: form.team1Id,
          team2Id: form.team2Id,
          team1Score: form.team1Score || null,
          team2Score: form.team2Score || null,
          winnerTeamId: form.winnerTeamId || null,
          matchDate: form.matchDate || null,
        }),
      });
      if (!res.ok) throw new Error();
      const match: Match = await res.json();
      setMatches(prev => [match, ...prev]);
      setForm({ team1Id: '', team2Id: '', team1Score: '', team2Score: '', winnerTeamId: '', matchDate: '' });
      toast.success('Match added');
    } catch { toast.error('Failed to add match'); }
    finally { setAdding(false); }
  }

  async function handleDelete(matchId: string) {
    const res = await fetch(`/api/leagues/${id}/matches`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId }),
    });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    setMatches(prev => prev.filter(m => m.id !== matchId));
    toast.success('Match removed');
  }

  if (loading || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">{[1,2,3].map(n=><div key={n} className="h-14 rounded-xl bg-muted shimmer"/>)}</div>
      </div>
    );
  }

  const teams = data.teams ?? [];
  const standings = calcStandings(teams, matches);
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const isCreator = data.isCreator;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <div className="mb-7">
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/>Back to League
        </button>
        <h1 className="text-2xl font-black text-gradient-green tracking-tight">Matches & Standings</h1>
        <p className="text-muted-foreground text-sm mt-1">{data.name}</p>
      </div>

      {teams.length === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 mb-8 text-sm text-amber-600 dark:text-amber-400">
          Set up teams first to track match results.{' '}
          <button onClick={() => router.push(`/leagues/${id}/teams`)} className="underline underline-offset-2">Create teams →</button>
        </div>
      )}

      {/* Points Table */}
      {standings.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">Points Table</p>
              <p className="text-xs text-muted-foreground">Win 2 pts · Tie / no result 1 pt</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">#</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">P</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">W</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">L</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">T</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const isLeader = i === 0 && s.played > 0;
                  return (
                    <tr key={s.team.id} className={`border-b border-border/50 transition-colors hover:bg-muted/40 ${isLeader ? 'bg-primary/5' : ''}`}>
                      <td className={`px-4 py-3 text-center tabular-nums text-xs font-bold ${isLeader ? 'text-amber-500' : 'text-muted-foreground/60'}`}>
                        {i + 1}
                      </td>
                      <td className="px-2 py-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.team.colorHex, boxShadow: `0 0 8px ${s.team.colorHex}70` }}/>
                          {s.team.name}
                          {isLeader && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0"/>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{s.played}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-green-600 dark:text-green-400 font-semibold">{s.won}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{s.lost}</td>
                      <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{s.tied}</td>
                      <td className="px-3 py-3 text-center tabular-nums font-bold text-foreground">{s.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="space-y-2.5 mb-8">
        <div className="section-label mb-3">Results</div>
        {matches.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No matches recorded yet.</p>}
        {matches.map((m, mi) => {
          const t1 = teamById[m.team1Id], t2 = teamById[m.team2Id];
          if (!t1 || !t2) return null;
          return (
            <div key={m.id} className="card-premium p-4 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: `${Math.min(mi, 8) * 0.04}s` }}>
              <div className="flex-1 flex items-center gap-3">
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: t1.colorHex }}/>
                    <span className={`font-semibold text-sm ${m.winnerTeamId===t1.id?'text-foreground':'text-muted-foreground'}`}>{t1.name}</span>
                    {m.winnerTeamId===t1.id&&<Trophy className="w-3.5 h-3.5 text-amber-500"/>}
                  </div>
                  {m.team1Score && <p className="text-xs text-muted-foreground font-mono">{m.team1Score}</p>}
                </div>
                <div className="text-xs text-muted-foreground font-bold"><Minus className="w-3 h-3"/></div>
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {m.winnerTeamId===t2.id&&<Trophy className="w-3.5 h-3.5 text-amber-500"/>}
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: t2.colorHex }}/>
                    <span className={`font-semibold text-sm ${m.winnerTeamId===t2.id?'text-foreground':'text-muted-foreground'}`}>{t2.name}</span>
                  </div>
                  {m.team2Score && <p className="text-xs text-muted-foreground font-mono">{m.team2Score}</p>}
                </div>
              </div>
              <div className="shrink-0 text-right space-y-1">
                {m.matchDate && <p className="text-xs text-muted-foreground">{new Date(m.matchDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>}
                {!m.winnerTeamId && !m.team1Score && <p className="text-xs text-amber-500">Upcoming</p>}
                {!m.winnerTeamId && (m.team1Score || m.team2Score) && <p className="text-xs text-muted-foreground">No result</p>}
              </div>
              {isCreator && (
                <button onClick={() => handleDelete(m.id)} title="Delete match"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add match form (creator only) */}
      {isCreator && teams.length >= 2 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
          <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-green-600 dark:text-green-400"/>
            </div>
            <div>
              <p className="text-sm font-semibold">Add Match</p>
              <p className="text-xs text-muted-foreground">Record a result or schedule an upcoming game</p>
            </div>
          </div>
          <form onSubmit={handleAdd} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team 1</label>
                <select value={form.team1Id} onChange={e=>setForm(f=>({...f,team1Id:e.target.value}))} required
                  className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select team</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team 2</label>
                <select value={form.team2Id} onChange={e=>setForm(f=>({...f,team2Id:e.target.value}))} required
                  className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Select team</option>
                  {teams.filter(t=>t.id!==form.team1Id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score 1</label>
                <input value={form.team1Score} onChange={e=>setForm(f=>({...f,team1Score:e.target.value}))} placeholder="185/6 (20)" className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score 2</label>
                <input value={form.team2Score} onChange={e=>setForm(f=>({...f,team2Score:e.target.value}))} placeholder="172/8 (20)" className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Winner</label>
                <select value={form.winnerTeamId} onChange={e=>setForm(f=>({...f,winnerTeamId:e.target.value}))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">No result / upcoming</option>
                  {[form.team1Id,form.team2Id].filter(Boolean).map(tid=>{
                    const t=teams.find(x=>x.id===tid);
                    return t?<option key={tid} value={tid}>{t.name}</option>:null;
                  })}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
                <input type="date" value={form.matchDate} onChange={e=>setForm(f=>({...f,matchDate:e.target.value}))} className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
              </div>
            </div>
            <button type="submit" disabled={adding} className="btn-premium w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm">
              <Plus className="w-4 h-4"/>Add Match
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
