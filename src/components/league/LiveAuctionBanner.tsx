/**
 * "An auction is running right now" banner for a league page.
 *
 * It exists because a live auction used to be unreachable from inside the app:
 * the watch link lived only in the share modal *inside* the auction console, so
 * an organizer who closed that tab — and every spectator who was never sent the
 * link — had no route back to it. Organizers get the console, everyone else the
 * public watch screen.
 *
 * No hooks and no client state, so it renders in the signed-in workspace (a
 * client component) and the server-rendered public league page alike.
 */
import Link from 'next/link';
import { Gavel, Tv } from 'lucide-react';
import type { LiveAuctionSummary } from '@/lib/types';

export default function LiveAuctionBanner({
  leagueId,
  live,
  canManage = false,
}: {
  leagueId: string;
  live: LiveAuctionSummary;
  /** Creator or co-organizer — only they are offered the auction console. */
  canManage?: boolean;
}) {
  const { sold, total, round } = live;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-r from-red-500/12 via-rose-500/6 to-transparent p-4 sm:p-5 mb-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[2px] text-red-600 dark:text-red-400">
            <span className="relative flex w-2 h-2" aria-hidden="true">
              <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
            </span>
            Live now
          </span>
          <p className="mt-1.5 font-bold text-foreground">Auction in progress</p>
          {total > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {sold} of {total} players sold{round > 1 ? ` · Round ${round}` : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canManage && (
            <Link
              href={`/leagues/${leagueId}/auction`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-500/25"
            >
              <Gavel className="w-4 h-4" />
              Resume auction
            </Link>
          )}
          <Link
            href={`/leagues/${leagueId}/watch`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:border-foreground/30 transition-colors"
          >
            <Tv className="w-4 h-4" />
            Watch live
          </Link>
        </div>
      </div>
    </div>
  );
}
