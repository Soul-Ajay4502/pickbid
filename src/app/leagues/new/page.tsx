'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import TemplateSelector from '@/components/TemplateSelector';
import PlayerCard from '@/components/PlayerCard';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';
import { DEFAULT_TEMPLATE_ID } from '@/lib/templates';
import { toast } from 'sonner';
import type { Player } from '@/lib/types';

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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [form, setForm] = useState({ name: '', conductedBy: '', totalPlayers: '' });

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
    if (!form.name.trim() || !form.conductedBy.trim() || !form.totalPlayers) {
      toast.error('Please fill in all fields');
      return;
    }
    const total = parseInt(form.totalPlayers, 10);
    if (isNaN(total) || total < 1 || total > 100) {
      toast.error('Total players must be between 1 and 100');
      return;
    }

    setLoading(true);
    const creatorToken = generateToken();

    try {
      // 1. Upload logo to Cloudinary if one was selected
      let logoUrl = '';
      if (logoFile) {
        const folder = sanitizeFolder(form.name.trim());
        logoUrl = await uploadFile(logoFile, folder);
      }

      // 2. Create the league
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          conductedBy: form.conductedBy.trim(),
          totalPlayers: total,
          templateId,
          logoUrl,
          creatorToken,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create league');
      }

      const league = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`creator_league_${league.id}`, creatorToken);
      }
      toast.success('League created!');
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-2 text-muted-foreground">
        ← Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Form */}
        <Card className="border border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Create a League</CardTitle>
            <CardDescription>Set up a new cricket league and invite players to add their cards.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name">League Name</Label>
                <Input
                  id="name" name="name"
                  placeholder="e.g. Mumbai Premier League 2025"
                  value={form.name} onChange={handleChange}
                  disabled={loading} required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conductedBy">Conducted By</Label>
                <Input
                  id="conductedBy" name="conductedBy"
                  placeholder="e.g. Mumbai Cricket Club"
                  value={form.conductedBy} onChange={handleChange}
                  disabled={loading} required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalPlayers">Total Players</Label>
                <Input
                  id="totalPlayers" name="totalPlayers"
                  type="number" min={1} max={100}
                  placeholder="e.g. 20"
                  value={form.totalPlayers} onChange={handleChange}
                  disabled={loading} required
                />
              </div>

              {/* Logo upload */}
              <div className="space-y-1.5">
                <Label>League Logo</Label>
                <div
                  className="flex items-center gap-4 p-3 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Logo preview" className="w-14 h-14 rounded-md object-contain bg-muted" />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center text-2xl select-none">
                      🏅
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{logoPreview ? 'Change logo' : 'Upload logo'}</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or SVG · appears on every player card</p>
                  </div>
                  {logoPreview && (
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="ml-auto text-muted-foreground"
                      onClick={handleRemoveLogo}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={logoInputRef} type="file" accept="image/*"
                  className="hidden" onChange={handleLogoChange}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Player Card Template</Label>
                <TemplateSelector value={templateId} onChange={setTemplateId} />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-600 text-white">
                {loading ? 'Creating…' : 'Create League'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live card preview */}
        <div className="flex flex-col items-center gap-3 sticky top-8">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide self-start">
            Live Preview
          </p>
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
