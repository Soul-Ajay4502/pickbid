'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PlayerForm, { type PlayerFormData } from '@/components/PlayerForm';
import { generateToken, sanitizeFolder, uploadFile } from '@/lib/utils';
import type { League } from '@/lib/types';
import { toast } from 'sonner';

export default function NewPlayerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    fetch(`/api/leagues/${id}`)
      .then((r) => r.json())
      .then((data) => setLeague(data))
      .catch(() => {/* non-critical — folder falls back to league id */});
  }, [id]);

  async function handleSubmit(data: PlayerFormData) {
    setLoading(true);
    const creatorToken = generateToken();

    try {
      // Upload photo to Cloudinary if a new file was selected
      let photoUrl = data.photo;
      if (data.photoFile) {
        const leagueName = league?.name ?? id;
        const folder = `${sanitizeFolder(leagueName)}/players`;
        photoUrl = await uploadFile(data.photoFile, folder);
      }

      const res = await fetch(`/api/leagues/${id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          photo: photoUrl,
          battingType: data.battingType,
          bowlingType: data.bowlingType,
          role: data.role,
          isWicketKeeper: data.isWicketKeeper,
          creatorToken,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to add player');
      }

      const player = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`creator_player_${player.id}`, creatorToken);
      }
      toast.success('Player card added!');
      router.push(`/leagues/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-2 text-muted-foreground">
        ← Back to League
      </Button>
      <Card className="border border-border shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Add Your Player Card</CardTitle>
          <CardDescription>Fill in your cricket details and upload a photo.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerForm onSubmit={handleSubmit} submitLabel="Add Card" loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
