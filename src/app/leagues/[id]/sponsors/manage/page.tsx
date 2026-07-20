'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Edit2, X, Check, ImagePlus, ExternalLink, Handshake, Eye } from 'lucide-react';
import { sanitizeFolder, uploadFile } from '@/lib/utils';
import type { LeagueWithPlayers, Sponsor } from '@/lib/types';

export default function ManageSponsorsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  // form (shared between add + edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName('');
    setWebsite('');
    setFile(null);
    setPreview('');
  }

  function startEdit(sponsor: Sponsor) {
    setEditingId(sponsor.id);
    setName(sponsor.name);
    setWebsite(sponsor.website ?? '');
    setFile(null);
    setPreview(sponsor.logoUrl);
  }

  const fetchData = useCallback(async () => {
    const leagueRes = await fetch(`/api/leagues/${id}`);
    if (!leagueRes.ok) { router.push('/'); return; }
    const leagueJson: LeagueWithPlayers = await leagueRes.json();
    // Managing sponsors is a creator-only action — everyone else just watches the marquee
    if (!leagueJson.canManage) { router.push(`/leagues/${id}/sponsors`); return; }
    setLeague(leagueJson);

    const sponsorsRes = await fetch(`/api/leagues/${id}/sponsors`);
    setSponsors(sponsorsRes.ok ? await sponsorsRes.json() : []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !league) return;
    if (!name.trim()) { toast.error('Sponsor name is required'); return; }
    setSaving(true);
    try {
      let logoUrl = editingId ? undefined : '';
      if (file) {
        logoUrl = await uploadFile(file, `${sanitizeFolder(league.name)}/sponsors`);
      }
      const body = {
        name: name.trim(),
        website: website.trim() || null,
        ...(logoUrl !== undefined ? { logoUrl } : {}),
      };
      const res = await fetch(`/api/leagues/${id}/sponsors`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { sponsorId: editingId, ...body } : body),
      });
      if (!res.ok) throw new Error();
      const saved: Sponsor = await res.json();
      setSponsors(prev => editingId
        ? prev.map(s => s.id === saved.id ? saved : s)
        : [...prev, saved]);
      toast.success(editingId ? 'Sponsor updated' : 'Sponsor added');
      resetForm();
    } catch {
      toast.error(editingId ? 'Failed to update sponsor' : 'Failed to add sponsor');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sponsor: Sponsor) {
    if (!confirm(`Remove ${sponsor.name} from the sponsor wall?`)) return;
    setDeletingId(sponsor.id);
    try {
      const res = await fetch(`/api/leagues/${id}/sponsors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId: sponsor.id }),
      });
      if (!res.ok) throw new Error();
      setSponsors(prev => prev.filter(s => s.id !== sponsor.id));
      if (editingId === sponsor.id) resetForm();
      toast.success(`${sponsor.name} removed`);
    } catch {
      toast.error('Failed to remove sponsor');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !league) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">
          {[1, 2, 3].map(n => <div key={n} className="h-16 rounded-xl bg-muted shimmer" />)}
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-black text-gradient-green tracking-tight">Sponsors</h1>
              {sponsors.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  {sponsors.length}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{league.name}</p>
          </div>
          <button onClick={() => router.push(`/leagues/${id}/sponsors`)} className="toolbar-btn" title="Open the full-screen sponsor wall">
            <Eye className="w-3.5 h-3.5" />View Sponsor Wall
          </button>
        </div>
      </div>

      {/* Sponsors list */}
      <div className="space-y-3 mb-8">
        {sponsors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-4 animate-fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-[2]" aria-hidden="true" />
              <div className="relative w-14 h-14 rounded-2xl bg-linear-to-br from-green-500/15 to-emerald-600/15 border border-green-500/20 flex items-center justify-center animate-float">
                <Handshake className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-muted-foreground text-sm">No sponsors yet. Add one below to get started.</p>
          </div>
        )}
        {sponsors.map((sponsor, i) => (
          <div key={sponsor.id} className="card-premium p-4 flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="w-14 h-14 shrink-0 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden">
              {sponsor.logoUrl
                ? <img src={sponsor.logoUrl} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                : <Handshake className="w-5 h-5 text-muted-foreground/50" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{sponsor.name}</p>
              {sponsor.website && (
                <a href={sponsor.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors truncate">
                  <ExternalLink className="w-3 h-3 shrink-0" />{sponsor.website}
                </a>
              )}
            </div>
            <button onClick={() => startEdit(sponsor)} title="Edit sponsor"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(sponsor)} disabled={deletingId === sponsor.id} title="Remove sponsor"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50">
              {deletingId === sponsor.id
                ? <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="px-5 py-4 border-b border-border bg-muted/40 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
            <Handshake className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{editingId ? 'Edit Sponsor' : 'Add a Sponsor'}</p>
            <p className="text-xs text-muted-foreground">Logo, name and an optional website link</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <label className="shrink-0 cursor-pointer" title="Upload logo">
              <div
                className="w-16 h-16 rounded-xl border-2 border-dashed border-border bg-muted/40 bg-contain bg-center bg-no-repeat overflow-hidden flex items-center justify-center hover:border-primary/50 transition-colors"
                style={preview ? { backgroundImage: `url(${preview})`, borderStyle: 'solid' } : undefined}
              >
                {!preview && <ImagePlus className="w-5 h-5 text-muted-foreground" />}
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(f ? URL.createObjectURL(f) : '');
                }} />
            </label>
            <div className="flex-1 space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sponsor name" required
                className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com (optional)" type="url"
                className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-sm font-medium inline-flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
              {saving
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Save Changes' : 'Add Sponsor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
