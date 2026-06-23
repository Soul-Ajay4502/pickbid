'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Users, Wallet, Edit2, Check, X, Shield, FileText, ImageDown, Download, Star, Briefcase, ImagePlus } from 'lucide-react';
import { downloadTeamwiseRoster, downloadSquadPosters } from '@/lib/squadPdf';
import { sanitizeFolder, uploadFile, formatIndianPhone } from '@/lib/utils';
import type { LeagueWithPlayers, Team, Player, TeamOfficial } from '@/lib/types';

const TEAM_COLORS = [
  '#22c55e','#3b82f6','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#ec4899','#f97316','#84cc16','#6366f1',
];

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString()}`;
}

export default function TeamsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // new team form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);
  const [newBudget, setNewBudget] = useState('10000000');
  const [newMaxPlayers, setNewMaxPlayers] = useState('11');
  const [adding, setAdding] = useState(false);

  // editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // icon player picker
  const [iconPickerTeam, setIconPickerTeam] = useState<string | null>(null);
  const [iconBusy, setIconBusy] = useState(false);

  // team officials editor (squad-poster only; never affects the auction)
  const [officialTeam, setOfficialTeam] = useState<string | null>(null);
  const [oName, setOName] = useState('');
  const [oRole, setORole] = useState('');
  const [oContact, setOContact] = useState('');
  const [oFile, setOFile] = useState<File | null>(null);
  const [oPreview, setOPreview] = useState('');
  const [oBusy, setOBusy] = useState(false);

  function resetOfficialForm() {
    setOName(''); setORole(''); setOContact(''); setOFile(null); setOPreview('');
  }
  function toggleOfficialEditor(teamId: string) {
    setOfficialTeam(v => (v === teamId ? null : teamId));
    resetOfficialForm();
  }

  async function assignIcon(team: Team, player: Player) {
    if (iconBusy || !data) return;
    const current = data.players.filter(p => p.teamId === team.id).length;
    if (current >= team.maxPlayers) { toast.error(`${team.name} squad is already full`); return; }
    setIconBusy(true);
    try {
      const res = await fetch(`/api/leagues/${id}/players/${player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, isIcon: true, soldPrice: null, isUnsold: false }),
      });
      if (!res.ok) throw new Error();
      const updated: Player = await res.json();
      setData(prev => prev ? { ...prev, players: prev.players.map(p => p.id === updated.id ? updated : p) } : prev);
      setIconPickerTeam(null);
      toast.success(`${player.name} set as icon player for ${team.name}`);
    } catch { toast.error('Failed to set icon player'); }
    finally { setIconBusy(false); }
  }

  async function removeIcon(player: Player) {
    if (iconBusy) return;
    setIconBusy(true);
    try {
      const res = await fetch(`/api/leagues/${id}/players/${player.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: null, isIcon: false }),
      });
      if (!res.ok) throw new Error();
      const updated: Player = await res.json();
      setData(prev => prev ? { ...prev, players: prev.players.map(p => p.id === updated.id ? updated : p) } : prev);
      toast.success(`${player.name} is no longer an icon player`);
    } catch { toast.error('Failed to remove icon player'); }
    finally { setIconBusy(false); }
  }

  async function addOfficial(team: Team) {
    if (oBusy || !data) return;
    if (!oName.trim()) { toast.error('Official name is required'); return; }
    setOBusy(true);
    try {
      let photoUrl = '';
      if (oFile) {
        photoUrl = await uploadFile(oFile, `${sanitizeFolder(data.name)}/officials`);
      }
      const res = await fetch(`/api/leagues/${id}/officials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          name: oName.trim(),
          role: oRole.trim() || 'Official',
          contactNumber: formatIndianPhone(oContact) || null,
          photo: photoUrl,
        }),
      });
      if (!res.ok) throw new Error();
      const created: TeamOfficial = await res.json();
      setData(prev => prev ? { ...prev, officials: [...prev.officials, created] } : prev);
      resetOfficialForm();
      toast.success(`${created.name} added to ${team.name}`);
    } catch { toast.error('Failed to add official'); }
    finally { setOBusy(false); }
  }

  async function removeOfficial(official: TeamOfficial) {
    if (oBusy) return;
    setOBusy(true);
    try {
      const res = await fetch(`/api/leagues/${id}/officials`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officialId: official.id }),
      });
      if (!res.ok) throw new Error();
      setData(prev => prev ? { ...prev, officials: prev.officials.filter(o => o.id !== official.id) } : prev);
      toast.success(`${official.name} removed`);
    } catch { toast.error('Failed to remove official'); }
    finally { setOBusy(false); }
  }

  // PDF exports — holds 'roster' | 'posters' | a teamId while generating
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleExport(kind: 'roster' | 'posters', teamId?: string) {
    if (!data || exporting) return;
    setExporting(teamId ?? kind);
    try {
      if (kind === 'roster') {
        await downloadTeamwiseRoster(data, teams, data.players);
        toast.success('Team-wise roster downloaded');
      } else {
        await downloadSquadPosters(data, teams, data.players, data.officials ?? [], teamId);
        toast.success(teamId ? 'Squad poster downloaded' : 'Squad posters downloaded');
      }
    } catch {
      toast.error('Export failed — please try again');
    } finally {
      setExporting(null);
    }
  }

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/leagues/${id}`);
    if (!res.ok) { router.push('/'); return; }
    const json: LeagueWithPlayers = await res.json();
    // Public leagues are viewable by anyone (read-only); private ones stay creator-only
    if (!json.isCreator && !json.isPublic) { router.push(`/leagues/${id}`); return; }
    setData(json);
    setTeams(json.teams);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/leagues/${id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          colorHex: newColor,
          budget: parseInt(newBudget) || 10000000,
          maxPlayers: parseInt(newMaxPlayers) || 11,
        }),
      });
      if (!res.ok) throw new Error('Failed to add team');
      const team: Team = await res.json();
      setTeams(prev => [...prev, team]);
      setNewName('');
      setNewColor(TEAM_COLORS[teams.length % TEAM_COLORS.length]);
      toast.success('Team added');
    } catch { toast.error('Failed to add team'); }
    finally { setAdding(false); }
  }

  async function handleDelete(teamId: string) {
    if (!confirm('Delete this team? Players assigned to it will be unassigned.')) return;
    const res = await fetch(`/api/leagues/${id}/teams`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    setTeams(prev => prev.filter(t => t.id !== teamId));
    toast.success('Team deleted');
  }

  async function handleSaveEdit(teamId: string) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/leagues/${id}/teams`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, name: editName.trim() }),
    });
    if (!res.ok) { toast.error('Failed to update'); return; }
    const updated: Team = await res.json();
    setTeams(prev => prev.map(t => t.id === teamId ? updated : t));
    setEditId(null);
    toast.success('Team updated');
  }

  if (loading || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">
          {[1,2,3].map(n => <div key={n} className="h-16 rounded-xl bg-muted shimmer" />)}
        </div>
      </div>
    );
  }

  // Non-creators reach this page only for public leagues — they get a read-only
  // view, so every add/edit/delete affordance is hidden behind canEdit.
  const canEdit = data.isCreator;

  // Calculate spending per team
  const spentByTeam: Record<string, number> = {};
  data.players.forEach(p => {
    if (p.teamId && p.soldPrice) {
      spentByTeam[p.teamId] = (spentByTeam[p.teamId] ?? 0) + p.soldPrice;
    }
  });

  const playersByTeam: Record<string, Player[]> = {};
  data.players.forEach(p => {
    if (p.teamId) {
      if (!playersByTeam[p.teamId]) playersByTeam[p.teamId] = [];
      playersByTeam[p.teamId].push(p);
    }
  });

  const officialsByTeam: Record<string, TeamOfficial[]> = {};
  (data.officials ?? []).forEach(o => {
    if (!officialsByTeam[o.teamId]) officialsByTeam[o.teamId] = [];
    officialsByTeam[o.teamId].push(o);
  });
  const unsoldPlayers = data.players.filter(p => p.isUnsold);
  const unpickedPlayers = data.players.filter(p => !p.teamId && !p.isUnsold);
  // The auction is complete once it has run (a player sold or marked unsold)
  // and no players are left waiting — at that point adding teams makes no sense.
  const hasAuctionData = data.players.some(p => (p.teamId && !p.isIcon) || p.isUnsold);
  const auctionComplete = hasAuctionData && unpickedPlayers.length === 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
      <div className="mb-7">
        <button onClick={() => router.push(`/leagues/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to League
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gradient-green tracking-tight">Teams</h1>
              {teams.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  {teams.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{data.name}</p>
          </div>
          {teams.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport('roster')} disabled={!!exporting} className="toolbar-btn" title="One PDF listing every team's players">
                {exporting === 'roster'
                  ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />}
                Team Roster PDF
              </button>
              <button onClick={() => handleExport('posters')} disabled={!!exporting} className="toolbar-btn" title="One poster page per team with player photos">
                {exporting === 'posters'
                  ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <ImageDown className="w-3.5 h-3.5" />}
                Squad Posters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Teams list */}
      <div className="space-y-3 mb-8">
        {teams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-4 animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-[2]" aria-hidden="true" />
              <div className="relative w-14 h-14 rounded-2xl bg-linear-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center animate-float">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{canEdit ? 'No teams yet. Add teams below to get started.' : 'No teams have been added yet.'}</p>
          </div>
        )}
        {teams.map((team, ti) => {
          const spent = spentByTeam[team.id] ?? 0;
          const remaining = team.budget - spent;
          const pct = Math.min(100, Math.round((spent / team.budget) * 100));
          const tPlayers = playersByTeam[team.id] ?? [];
          const tOfficials = officialsByTeam[team.id] ?? [];

          return (
            <div
              key={team.id}
              className="card-premium p-4 space-y-3 animate-fade-in-up"
              style={{ animationDelay: `${ti * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ background: team.colorHex, boxShadow: `0 0 10px ${team.colorHex}80` }}
                />
                {editId === team.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(team.id); } if (e.key === 'Escape') setEditId(null); }}
                      className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleSaveEdit(team.id)} title="Save"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditId(null)} title="Cancel"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => router.push(`/leagues/${id}/teams/${team.id}`)}
                      className="font-semibold text-foreground flex-1 text-left hover:text-primary transition-colors truncate"
                      title="View full squad details"
                    >
                      {team.name}
                    </button>
                    {tPlayers.length >= team.maxPlayers ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 mr-1">
                        Full · {tPlayers.length}/{team.maxPlayers}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums mr-1">
                        {tPlayers.length}/{team.maxPlayers} players
                      </span>
                    )}
                    {canEdit && (
                      <button onClick={() => setIconPickerTeam(v => v === team.id ? null : team.id)}
                        title="Add icon player"
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                          iconPickerTeam === team.id
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10'
                        }`}>
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => toggleOfficialEditor(team.id)}
                        title="Add team official"
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                          officialTeam === team.id
                            ? 'text-indigo-500 bg-indigo-500/10'
                            : 'text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10'
                        }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleExport('posters', team.id)} disabled={!!exporting}
                      title={`Download ${team.name} squad poster`}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                      {exporting === team.id
                        ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                    </button>
                    {canEdit && (
                      <button onClick={() => { setEditId(team.id); setEditName(team.name); }} title="Rename team"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => handleDelete(team.id)} title="Delete team"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Budget bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> {fmt(spent)} spent</span>
                  <span className={remaining < 0 ? 'text-destructive font-semibold' : ''}>{fmt(remaining)} left</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--destructive)' : team.colorHex }} />
                </div>
              </div>

              {/* Icon player picker */}
              {iconPickerTeam === team.id && (() => {
                const available = data.players.filter(p => !p.teamId);
                return (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-2 animate-scale-in">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" />
                      Pick an icon player for {team.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Icon players join the squad before the auction and skip the bidding pool.
                    </p>
                    {available.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No unassigned players available.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {available.map(p => (
                          <button key={p.id} onClick={() => assignIcon(team, p)} disabled={iconBusy}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border bg-card text-foreground hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                            {p.name}
                            <span className="text-muted-foreground/60">· {p.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Team officials editor */}
              {officialTeam === team.id && (
                <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-3 space-y-3 animate-scale-in">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    Add a team official for {team.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Officials don&apos;t take part in the auction — they appear only on the squad poster. The contact number is kept for your records and isn&apos;t printed.
                  </p>
                  <div className="flex items-start gap-3">
                    <label className="shrink-0 cursor-pointer" title="Upload photo">
                      <div
                        className="w-14 h-14 rounded-full border-2 border-dashed border-border bg-muted/40 bg-cover bg-center overflow-hidden flex items-center justify-center hover:border-indigo-500/50 transition-colors"
                        style={oPreview ? { backgroundImage: `url(${oPreview})`, borderStyle: 'solid' } : undefined}
                      >
                        {!oPreview && <ImagePlus className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setOFile(f);
                          setOPreview(f ? URL.createObjectURL(f) : '');
                        }} />
                    </label>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input value={oName} onChange={e => setOName(e.target.value)} placeholder="Name"
                        className="col-span-2 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                      <input value={oRole} onChange={e => setORole(e.target.value)} placeholder="Role (e.g. Coach)"
                        className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                      <div className="flex items-stretch h-9 rounded-lg border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/30">
                        <span className="flex items-center px-2.5 text-sm text-muted-foreground bg-muted/60 border-r border-border select-none">+91</span>
                        <input value={oContact} onChange={e => setOContact(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Contact number" inputMode="numeric" maxLength={10}
                          className="flex-1 min-w-0 px-3 bg-transparent text-sm focus:outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => toggleOfficialEditor(team.id)}
                      className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-xs font-medium">
                      Cancel
                    </button>
                    <button onClick={() => addOfficial(team)} disabled={oBusy}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors inline-flex items-center gap-1.5">
                      {oBusy && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      Add Official
                    </button>
                  </div>
                </div>
              )}

              {/* Officials */}
              {tOfficials.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tOfficials.map(o => (
                    <span key={o.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                      <Briefcase className="w-2.5 h-2.5" />
                      {o.name}
                      <span className="opacity-60">{o.role}</span>
                      {canEdit && (
                        <button onClick={() => removeOfficial(o)} disabled={oBusy} title="Remove official"
                          className="ml-0.5 hover:text-destructive transition-colors disabled:opacity-50">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Players */}
              {tPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tPlayers.map(p => p.isIcon ? (
                    <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {p.name}
                      <span className="opacity-60">Icon</span>
                      {canEdit && (
                        <button onClick={() => removeIcon(p)} disabled={iconBusy} title="Remove icon player"
                          className="ml-0.5 hover:text-destructive transition-colors disabled:opacity-50">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ) : (
                    <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground transition-colors">
                      <Users className="w-2.5 h-2.5" />
                      {p.name}
                      {p.soldPrice ? <span className="text-primary/70 ml-0.5">{fmt(p.soldPrice)}</span> : null}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary: unassigned + unsold */}
      {(unpickedPlayers.length > 0 || unsoldPlayers.length > 0) && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 mb-8 space-y-2">
          {unpickedPlayers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{unpickedPlayers.length}</span> player{unpickedPlayers.length !== 1 ? 's' : ''} not yet in auction
            </p>
          )}
          {unsoldPlayers.length > 0 && (
            <p className="text-xs text-amber-500">
              <span className="font-semibold">{unsoldPlayers.length}</span> unsold player{unsoldPlayers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Add team form — hidden once the auction has finished */}
      {canEdit && !auctionComplete && (
      <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Add a Team</p>
            <p className="text-xs text-muted-foreground">Name, budget and colour</p>
          </div>
        </div>
        <form onSubmit={handleAdd} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team Name</label>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Mumbai Indians"
                className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Budget</label>
              <input
                value={newBudget} onChange={e => setNewBudget(e.target.value)}
                type="number" min="1"
                className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Players per Team</label>
              <input
                value={newMaxPlayers} onChange={e => setNewMaxPlayers(e.target.value)}
                type="number" min="1" max="100"
                placeholder="e.g. 11"
                className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground/70">Used in the auction to cap squads and work out each team&apos;s max bid</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colour</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {TEAM_COLORS.map(c => {
                  const selected = newColor === c;
                  return (
                    <button
                      key={c} type="button"
                      onClick={() => setNewColor(c)}
                      aria-label={`Team colour ${c}`}
                      aria-pressed={selected}
                      className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 ${
                        selected
                          ? 'ring-2 ring-offset-2 ring-offset-card scale-110'
                          : 'hover:scale-110 opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        background: c,
                        ...(selected ? { boxShadow: `0 0 12px ${c}80`, ['--tw-ring-color' as string]: c } : {}),
                      }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            type="submit" disabled={adding}
            className="btn-premium w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
          >
            <Plus className="w-4 h-4" /> Add Team
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
