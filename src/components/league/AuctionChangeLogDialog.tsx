'use client';

import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatINR } from '@/lib/utils';
import type { AuctionChange } from '@/lib/types';

const price = (n: number | null) => (n == null ? 'no price' : formatINR(n));

/** One log entry as a sentence about the player. */
function describe(c: AuctionChange): string {
  switch (c.action) {
    case 'sold': return `sold to ${c.toTeamName} for ${price(c.toPrice)}`;
    case 'added': return `added to ${c.toTeamName} at ${price(c.toPrice)}`;
    case 'icon': return `made an icon player of ${c.toTeamName}`;
    case 'moved': return `moved from ${c.fromTeamName} to ${c.toTeamName} (${price(c.fromPrice)} → ${price(c.toPrice)})`;
    case 'removed': return `removed from ${c.fromTeamName} (was ${price(c.fromPrice)})`;
    case 'price': return `price changed from ${price(c.fromPrice)} to ${price(c.toPrice)} · ${c.toTeamName}`;
    case 'unsold': return 'marked unsold';
    case 'cleared': return 'unsold mark removed';
    case 'reset': return 'cleared — the auction was reset';
  }
}

const SOURCE_LABEL: Record<AuctionChange['source'], string> = {
  auction: 'Auction',
  correction: 'Correction',
  setup: 'Teams page',
  other: 'Other',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * The auction change log, for organizers: every sale, unsold call and — the
 * reason it exists — every correction made after the auction, with who made it
 * and when. Read-only; the log is append-only on the server.
 *
 * Opens on corrections alone, because that is the question it answers ("who
 * changed this price?"). The auction-night calls are one tick away.
 */
export default function AuctionChangeLogDialog({ leagueId, open, onClose }: {
  leagueId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [changes, setChanges] = useState<AuctionChange[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAuction, setShowAuction] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/auction/changes`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { changes: AuctionChange[] };
        if (!cancelled) { setChanges(json.changes); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, leagueId]);

  const shown = (changes ?? []).filter((c) => showAuction || c.source !== 'auction');
  const hiddenCount = (changes?.length ?? 0) - shown.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogTitle className="flex items-center gap-2 shrink-0">
          <History className="w-4 h-4 text-muted-foreground" />Auction change log
        </DialogTitle>
        <p className="text-xs text-muted-foreground -mt-2 shrink-0">
          Who changed a player&apos;s team or price, and when. Visible to organizers only.
        </p>

        {failed ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Could not load the change log.</p>
        ) : !changes ? (
          <p className="text-sm text-muted-foreground py-6 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer w-fit shrink-0">
              <input type="checkbox" checked={showAuction} onChange={(e) => setShowAuction(e.target.checked)} />
              Show auction-night calls too{!showAuction && hiddenCount > 0 ? ` (${hiddenCount})` : ''}
            </label>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {changes.length === 0 ? 'Nothing recorded yet — changes appear here from now on.' : 'No corrections since the auction.'}
              </p>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60 rounded-xl border border-border">
                {shown.map((c) => (
                  <li key={c.id} className="px-3 py-2.5">
                    <p className="text-sm text-foreground">
                      <strong>{c.playerName}</strong> {describe(c)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.actorName} · {when(c.createdAt)} ·{' '}
                      <span className={c.source === 'correction' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{SOURCE_LABEL[c.source]}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
