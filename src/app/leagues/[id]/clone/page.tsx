'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import TemplateSelector from '@/components/TemplateSelector';
import PickPreferenceSelector from '@/components/PickPreferenceSelector';
import PlayerCard from '@/components/PlayerCard';
import { sanitizeFolder, uploadFile } from '@/lib/utils';
import { DEFAULT_TEMPLATE_ID } from '@/lib/templates';
import { toast } from 'sonner';
import type { Player, PlayerRole, LeagueWithPlayers } from '@/lib/types';
import { ArrowLeft, Upload, X, Copy, Palette, ChevronRight, Users, UserPlus, UsersRound, ListOrdered } from 'lucide-react';

const PREVIEW_PLAYER: Player = {
  id: 'preview',
  leagueId: 'preview',
  name: 'Virat Sharma',
  photo: '',
  battingType: 'Right-Hand Bat',
  bowlingType: 'Right-Arm Fast',
  role: 'All-Rounder',
  isWicketKeeper: false,
  creatorToken: '',
  createdAt: new Date().toISOString(),
};

export default function CloneLeaguePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LeagueWithPlayers | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  // Empty string means "keep the source league's logo" (carried in sourceLogoUrl)
  const [sourceLogoUrl, setSourceLogoUrl] = useState('');
  const [form, setForm] = useState({ name: '', conductedBy: '', totalPlayers: '' });
  const [include, setInclude] = useState({ teams: true, players: true, officials: true });
  const [preserveAuctionResults, setPreserveAuctionResults] = useState(false);
  const [pickPreference, setPickPreference] = useState<PlayerRole[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') signIn('google');
  }, [status]);

  // Pre-fill the form from the league being cloned
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leagues/${id}`);
        if (!res.ok) throw new Error('Could not load the league to clone');
        const data: LeagueWithPlayers = await res.json();
        if (cancelled) return;
        setSource(data);
        setForm({
          name: `${data.name} (Copy)`,
          conductedBy: data.conductedBy,
          totalPlayers: String(data.totalPlayers),
        });
        setTemplateId(data.templateId || DEFAULT_TEMPLATE_ID);
        setSourceLogoUrl(data.logoUrl || '');
        setLogoPreview(data.logoUrl || '');
        setPickPreference(data.pickPreference ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong');
        router.push(`/leagues/${id}`);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, id, router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoPreview && logoFile) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo(e: React.MouseEvent) {
    e.stopPropagation();
    if (logoPreview && logoFile) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview('');
    // Clearing also drops the inherited source logo
    setSourceLogoUrl('');
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) { signIn('google'); return; }
    if (!form.name.trim() || !form.conductedBy.trim() || !form.totalPlayers) {
      toast.error('Please fill in all fields');
      return;
    }
    const total = parseInt(form.totalPlayers, 10);
    if (isNaN(total) || total < 1 || total > 500) {
      toast.error('Total players must be between 1 and 500');
      return;
    }

    setLoading(true);
    try {
      // Upload a replacement logo if the user picked one, otherwise keep the
      // source league's logo URL (or none if they cleared it)
      let logoUrl = sourceLogoUrl;
      if (logoFile) {
        const folder = sanitizeFolder(form.name.trim());
        logoUrl = await uploadFile(logoFile, folder);
      }

      const res = await fetch(`/api/leagues/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          conductedBy: form.conductedBy.trim(),
          totalPlayers: total,
          templateId,
          logoUrl,
          pickPreference: pickPreference.length > 0 ? pickPreference : null,
          includeTeams: include.teams,
          includePlayers: include.players,
          includeOfficials: include.officials,
          preserveAuctionResults: include.teams && include.players && preserveAuctionResults,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to clone league');
      }

      const league = await res.json();
      toast.success('League cloned!');
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || status === 'unauthenticated' || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-muted-foreground text-sm animate-pulse">
          {status === 'unauthenticated' ? 'Redirecting to sign in…' : 'Loading league…'}
        </div>
      </div>
    );
  }

  const teamCount = source?.teams.length ?? 0;
  const playerCount = source?.players.length ?? 0;
  const officialCount = source?.officials.length ?? 0;

  const includeOptions = [
    {
      key: 'players' as const,
      icon: UserPlus,
      label: 'Players',
      hint: `${playerCount} player${playerCount === 1 ? '' : 's'} · ${include.teams && preserveAuctionResults ? 'auction results kept' : 'auction results reset'
        }`,
      disabled: playerCount === 0,
    },
    {
      key: 'teams' as const,
      icon: Users,
      label: 'Teams',
      hint: `${teamCount} team${teamCount === 1 ? '' : 's'} · budgets & squad sizes`,
      disabled: teamCount === 0,
    },
    {
      key: 'officials' as const,
      icon: UsersRound,
      label: 'Team Officials',
      hint: include.teams ? `${officialCount} official${officialCount === 1 ? '' : 's'}` : 'Needs teams',
      disabled: officialCount === 0 || !include.teams,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">

      {/* Page header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-gradient-green">Clone League</h1>
          <p className="text-muted-foreground text-sm">
            Start a new league from <span className="font-medium text-foreground">{source?.name}</span>. Tweak the details and pick what to bring along.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-start">

        {/* ── Form card ── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">

          {/* Card header strip */}
          <div className="px-6 py-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center">
                <Copy className="w-4 h-4 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">League Details</p>
                <p className="text-xs text-muted-foreground">Edit anything before creating the copy</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  League Name
                </Label>
                <Input
                  id="name" name="name"
                  placeholder="e.g. Mumbai Premier League 2025"
                  value={form.name} onChange={handleChange}
                  disabled={loading} required className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conductedBy" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Conducted By
                </Label>
                <Input
                  id="conductedBy" name="conductedBy"
                  placeholder="e.g. Mumbai CC"
                  value={form.conductedBy} onChange={handleChange}
                  disabled={loading} required className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalPlayers" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Total Players
                </Label>
                <Input
                  id="totalPlayers" name="totalPlayers"
                  type="number" min={1} max={500}
                  placeholder="e.g. 20"
                  value={form.totalPlayers} onChange={handleChange}
                  disabled={loading} required className="h-10"
                />
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                League Logo
              </Label>
              <div
                className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 group"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview} alt="Logo preview"
                    className="w-12 h-12 rounded-xl object-contain bg-muted border border-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary/30 transition-colors">
                    <Upload className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {logoPreview ? 'Change logo' : 'Upload logo'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PNG, JPG or SVG · shown on every player card
                  </p>
                </div>
                {logoPreview && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
                    onClick={handleRemoveLogo}
                  >
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>

            <Separator />

            {/* What to copy */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What to copy
              </Label>
              <div className="space-y-2">
                {includeOptions.map(({ key, icon: Icon, label, hint, disabled }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${disabled
                      ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                      : 'border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40'
                      }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-green-600"
                      checked={!disabled && include[key]}
                      disabled={disabled || loading}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setInclude((prev) => ({
                          ...prev,
                          [key]: next,
                          // Officials can't outlive their teams
                          ...(key === 'teams' && !next ? { officials: false } : {}),
                        }));
                        // Preserved sales need a team to point to
                        if (key === 'teams' && !next) setPreserveAuctionResults(false);
                      }}
                    />
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                  </label>
                ))}
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${include.teams && include.players
                    ? 'border-border cursor-pointer hover:border-primary/40 hover:bg-muted/40'
                    : 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                    }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-green-600"
                    checked={include.teams && include.players && preserveAuctionResults}
                    disabled={!include.teams || !include.players || loading}
                    onChange={(e) => setPreserveAuctionResults(e.target.checked)}
                  />
                  <ListOrdered className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Keep auction results</p>
                    <p className="text-xs text-muted-foreground">
                      {include.teams && include.players
                        ? 'Sold prices and team assignments carry over instead of resetting'
                        : 'Needs players and teams'}
                    </p>
                  </div>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                The copy starts as a private league. Matches and live auction state are never carried over.
              </p>
            </div>

            <Separator />

            {/* Template */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Card Template
                </Label>
              </div>
              <TemplateSelector value={templateId} onChange={setTemplateId} />
            </div>

            <Separator />

            {/* Player pick preference */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Auction Pick Order (optional)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Pick a role order (e.g. Bowlers first, then Batters) to control who comes up first in the auction. Leave empty to pick everyone randomly.
              </p>
              <PickPreferenceSelector value={pickPreference} onChange={setPickPreference} />
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-premium w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cloning…
                </>
              ) : (
                <>Create Clone <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {/* ── Live preview ── */}
        <div className="flex flex-col items-center gap-3 lg:sticky lg:top-24 animate-fade-in-up" style={{ animationDelay: '0.12s' }}>
          <div className="flex items-center gap-2 self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Live Preview
            </p>
          </div>
          <PlayerCard
            player={PREVIEW_PLAYER}
            templateId={templateId}
            leagueName={form.name || 'League Name'}
            conductedBy={form.conductedBy || 'Conducted By'}
            logoUrl={logoPreview}
            pdfMode
          />
        </div>
      </div>
    </div>
  );
}
