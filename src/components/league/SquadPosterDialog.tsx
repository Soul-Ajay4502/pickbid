'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { renderSquadPosters, saveSquadPosters, type SquadPosterPage } from '@/lib/squadPdf';
import type { LeagueWithPlayers, Player, Team, TeamOfficial } from '@/lib/types';

export default function SquadPosterDialog({ league, teams, players, officials, teamId, onClose }: {
  league: Pick<LeagueWithPlayers, 'name' | 'conductedBy'>;
  teams: Team[];
  players: Player[];
  officials: TeamOfficial[];
  teamId?: string;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<SquadPosterPage[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    renderSquadPosters(league, teams, players, officials, teamId, controller.signal).then(result => {
      if (!active) return;
      setPages(result);
      setPageIndex(0);
      setError(null);
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'Could not render squad posters');
    });
    return () => { active = false; controller.abort(); };
  }, [league, teams, players, officials, teamId, attempt]);

  const current = error ? undefined : pages?.[pageIndex];

  async function download() {
    if (!current || downloading) return;
    setDownloading(true);
    try {
      await saveSquadPosters([current], `${current.teamName}_squad`);
      toast.success('Squad poster downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download squad poster');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92dvh] p-0 gap-0 overflow-hidden">
        <div className="p-4 pr-12 space-y-1">
          <DialogTitle>Squad poster preview</DialogTitle>
          <DialogDescription>View your posters here. Nothing downloads until you choose Download PDF.</DialogDescription>
        </div>
        <div className="max-h-[68dvh] overflow-y-auto bg-muted p-3">
          {error ? (
            <div className="py-12 text-center space-y-3">
              <p role="alert" className="text-destructive">{error}</p>
              <button className="toolbar-btn" onClick={() => { setPages(null); setError(null); setAttempt(value => value + 1); }}>
                Retry preview
              </button>
            </div>
          ) : current ? (
            <Image
              src={current.src}
              alt={`${current.teamName} squad poster`}
              width={2520}
              height={3564}
              unoptimized
              loading="eager"
              className="w-full h-auto rounded-lg"
              onError={() => setError('Could not display the squad poster')}
            />
          ) : (
            <div role="status" className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />Rendering squad posters…
            </div>
          )}
        </div>
        {current && pages && (
          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button className="toolbar-btn" aria-label="Previous team" disabled={pageIndex === 0} onClick={() => setPageIndex(value => value - 1)}>
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-sm min-w-0 text-center" aria-live="polite">
                <span className="block font-semibold">{current.teamName}</span>
                {pageIndex + 1} / {pages.length}
              </p>
              <button className="toolbar-btn" aria-label="Next team" disabled={pageIndex === pages.length - 1} onClick={() => setPageIndex(value => value + 1)}>
                <ChevronRight className="size-4" />
              </button>
            </div>
            <button className="toolbar-btn" disabled={downloading} onClick={download}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
