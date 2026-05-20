'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import PlayerCard from '@/components/PlayerCard';
import DownloadPDFButton from '@/components/DownloadPDFButton';
import TemplateSelector from '@/components/TemplateSelector';
import type { LeagueWithPlayers } from '@/lib/types';
import { toast } from 'sonner';

export default function LeaguePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LeagueWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLeagueCreator, setIsLeagueCreator] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${id}`);
      if (!res.ok) {
        if (res.status === 404) router.push('/');
        return;
      }
      const json: LeagueWithPlayers = await res.json();
      setData(json);
      setActiveTemplateId(json.templateId);

      if (typeof window !== 'undefined') {
        const token = localStorage.getItem(`creator_league_${id}`);
        setIsLeagueCreator(!!token && token === json.creatorToken);
      }
    } catch {
      toast.error('Failed to load league');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchLeague();
  }, [fetchLeague]);

  async function handleTemplateChange(templateId: string) {
    setActiveTemplateId(templateId);
    const creatorToken = typeof window !== 'undefined' ? localStorage.getItem(`creator_league_${id}`) : null;
    if (!creatorToken) return;

    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorToken, templateId }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Template updated');
    } catch {
      toast.error('Failed to save template');
      setActiveTemplateId(data?.templateId ?? templateId);
    } finally {
      setSavingTemplate(false);
    }
  }

  function canEditPlayer(playerCreatorToken: string, playerId: string): boolean {
    if (typeof window === 'undefined') return false;
    const leagueToken = localStorage.getItem(`creator_league_${id}`);
    const playerToken = localStorage.getItem(`creator_player_${playerId}`);
    return (
      (!!leagueToken && leagueToken === data?.creatorToken) ||
      (!!playerToken && playerToken === playerCreatorToken)
    );
  }

  async function handleDeletePlayer(playerId: string) {
    if (!confirm('Delete this player card?')) return;
    try {
      const res = await fetch(`/api/leagues/${id}/players/${playerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Player card deleted');
      fetchLeague();
    } catch {
      toast.error('Failed to delete player card');
    }
  }

  async function handleDeleteLeague() {
    if (!confirm(`Delete "${data?.name}"? This will remove all player cards too and cannot be undone.`)) return;
    const creatorToken = typeof window !== 'undefined' ? localStorage.getItem(`creator_league_${id}`) : null;
    if (!creatorToken) return;
    try {
      const res = await fetch(`/api/leagues/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorToken }),
      });
      if (!res.ok) throw new Error('Failed to delete league');
      toast.success('League deleted');
      router.push('/');
    } catch {
      toast.error('Failed to delete league');
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('League URL copied to clipboard!');
    });
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-40 bg-muted animate-pulse rounded mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" onClick={() => router.push('/')} className="-ml-2 text-muted-foreground text-sm p-1 h-auto">
              ← All Leagues
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{data.name}</h1>
          <p className="text-muted-foreground mt-0.5">Conducted by {data.conductedBy}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className="bg-green-100 text-green-800 border-0">
              {data.totalPlayers} player slots
            </Badge>
            <Badge variant="secondary">
              {data.players.length} registered
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" onClick={handleShare}>
            Share
          </Button>
          <Button
            onClick={() => router.push(`/leagues/${id}/players/new`)}
            className="bg-green-700 hover:bg-green-600 text-white"
          >
            + Add Your Card
          </Button>
          {isLeagueCreator && data.players.length > 0 && (
            <Button
              onClick={() => router.push(`/leagues/${id}/auction`)}
              className="bg-blue-700 hover:bg-blue-600 text-white"
            >
              Start Auction
            </Button>
          )}
          {isLeagueCreator && (
            <Button
              variant="outline"
              onClick={() => setTemplatePanelOpen((v) => !v)}
            >
              {templatePanelOpen ? 'Hide Templates' : 'Change Template'}
            </Button>
          )}
          {isLeagueCreator && (
            <Button variant="destructive" onClick={handleDeleteLeague}>
              Delete League
            </Button>
          )}
          {isLeagueCreator && data.players.length > 0 && (
            <DownloadPDFButton
              players={data.players}
              leagueName={data.name}
              conductedBy={data.conductedBy}
              templateId={activeTemplateId}
              logoUrl={data.logoUrl}
            />
          )}
        </div>
      </div>

      {/* Template switcher panel */}
      {isLeagueCreator && templatePanelOpen && (
        <div className="mb-6 rounded-2xl border bg-muted/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Card Template</p>
            {savingTemplate && (
              <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
            )}
          </div>
          <TemplateSelector value={activeTemplateId} onChange={handleTemplateChange} />
        </div>
      )}

      <Separator className="mb-8" />

      {/* Player cards grid */}
      {data.players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="text-6xl">🏏</span>
          <h2 className="text-lg font-semibold">No player cards yet</h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Be the first to add your cricket player card to this league!
          </p>
          <Button
            onClick={() => router.push(`/leagues/${id}/players/new`)}
            className="bg-green-700 hover:bg-green-600 text-white"
          >
            Add Your Card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
          {data.players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              templateId={activeTemplateId}
              leagueName={data.name}
              conductedBy={data.conductedBy}
              logoUrl={data.logoUrl}
              showEdit={canEditPlayer(player.creatorToken, player.id)}
              onEdit={() => router.push(`/leagues/${id}/players/${player.id}/edit`)}
              onDelete={() => handleDeletePlayer(player.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
