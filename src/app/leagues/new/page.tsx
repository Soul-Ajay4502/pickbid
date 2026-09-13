'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import type { Player, PlayerRole } from '@/lib/types';
import { ArrowLeft, Upload, X, Trophy, Palette, ChevronRight, ListOrdered, ShieldCheck, ReceiptIndianRupee, Eye, Trash2 } from 'lucide-react';

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

export default function NewLeaguePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [form, setForm] = useState({ name: '', conductedBy: '', totalPlayers: '' });
  const [pickPreference, setPickPreference] = useState<PlayerRole[]>([]);
  const [idProofRequired, setIdProofRequired] = useState(false);
  const [paymentProofRequired, setPaymentProofRequired] = useState(false);
  // Both permissive by default — the organizer opts into a closed league
  const [rosterVisibleToPlayers, setRosterVisibleToPlayers] = useState(true);
  const [playersCanDeleteCards, setPlayersCanDeleteCards] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') signIn('google');
  }, [status]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo(e: React.MouseEvent) {
    e.stopPropagation();
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview('');
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
      let logoUrl = '';
      if (logoFile) {
        const folder = sanitizeFolder(form.name.trim());
        logoUrl = await uploadFile(logoFile, folder);
      }

      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          conductedBy: form.conductedBy.trim(),
          totalPlayers: total,
          templateId,
          logoUrl,
          pickPreference: pickPreference.length > 0 ? pickPreference : null,
          idProofRequired,
          paymentProofRequired,
          rosterVisibleToPlayers,
          playersCanDeleteCards,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create league');
      }

      const league = await res.json();
      toast.success('League created!');
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-muted-foreground text-sm animate-pulse">Redirecting to sign in…</div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-black tracking-tight text-gradient-green">Create a League</h1>
          <p className="text-muted-foreground text-sm">
            Set up your cricket league and invite players to join.
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
                <Trophy className="w-4 h-4 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">League Details</p>
                <p className="text-xs text-muted-foreground">Fill in the basics about your league</p>
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

            <Separator />

            {/* Registration requirements — both off by default, so nothing
                changes for an organizer who doesn't care about either. Both can
                also be flipped later from the league's Documents page. */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Registration Requirements (optional)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Documents players submit when they register. Only you and your co-organizers can open them —
                they never appear on a player card, poster or download.
              </p>
              {([
                {
                  on: idProofRequired,
                  set: setIdProofRequired,
                  Icon: ShieldCheck,
                  title: 'Require an identity proof',
                  hint: 'Players need an ID on their profile before they can add a card.',
                },
                {
                  on: paymentProofRequired,
                  set: setPaymentProofRequired,
                  Icon: ReceiptIndianRupee,
                  title: 'Require a payment receipt',
                  hint: 'Players attach proof of the entry fee when they add their card.',
                },
              ] as const).map(({ on, set, Icon, title, hint }) => (
                <button
                  key={title}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={loading}
                  onClick={() => set((v) => !v)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    on ? 'border-green-500/40 bg-green-500/8' : 'border-border bg-input hover:border-primary/30'
                  }`}
                >
                  <span className="flex items-start gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${on ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                      on ? 'bg-green-600' : 'bg-muted-foreground/25'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        on ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>

            <Separator />

            {/* Player access — both on by default, which is how the app has
                always behaved. Flipping either here saves a trip to the league's
                Player Access panel, where they can also be changed any time. */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Player Access
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                What your players can do with each other&apos;s cards. You and your co-organizers are
                never restricted by either.
              </p>
              {([
                {
                  on: rosterVisibleToPlayers,
                  set: setRosterVisibleToPlayers,
                  Icon: Eye,
                  title: 'Players can see the full roster',
                  hint: 'Turn off and each player sees only their own card and the icon players.',
                },
                {
                  on: playersCanDeleteCards,
                  set: setPlayersCanDeleteCards,
                  Icon: Trash2,
                  title: 'Players can delete their own card',
                  hint: 'Turn off and only you can remove a card. Players can still edit theirs.',
                },
              ] as const).map(({ on, set, Icon, title, hint }) => (
                <button
                  key={title}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={loading}
                  onClick={() => set((v) => !v)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    on ? 'border-green-500/40 bg-green-500/8' : 'border-amber-500/40 bg-amber-500/8'
                  }`}
                >
                  <span className="flex items-start gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${on ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                      on ? 'bg-green-600' : 'bg-muted-foreground/25'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        on ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-premium w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </>
              ) : (
                <>Create League <ChevronRight className="w-4 h-4" /></>
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
