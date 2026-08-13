'use client';

import { Star, Phone, Gavel, Ban, Clock, Shield } from 'lucide-react';
import { formatIndianPhone, localPhoneDigits } from '@/lib/utils';
import type { Player } from '@/lib/types';

function fmtPrice(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

interface StatDef { label: string; value: number | null | undefined; fixed?: number; }

interface PlayerFullViewProps {
  player: Player;
  /** Resolved team for sold / icon players (color + name). */
  team?: { name: string; colorHex: string } | null;
  leagueName?: string;
  conductedBy?: string;
  /**
   * Optional actions rendered above the league footer — used by the league
   * workspace to give organizers this player's certificate download. Kept as a
   * slot so this view stays presentational and never fetches anything itself.
   */
  actions?: React.ReactNode;
  /** Label shown beside `actions`. */
  actionsLabel?: string;
}

/**
 * Full-screen profile view of a player — a calmer, data-first layout that
 * complements the cinematic trading-card (PlayerCard). The full, uncropped
 * photo sits on one side and the details on the other.
 */
export default function PlayerFullView({ player, team, leagueName, conductedBy, actions, actionsLabel }: PlayerFullViewProps) {
  const accent = team?.colorHex ?? '#22c55e';
  const phone = formatIndianPhone(localPhoneDigits(player.contactNumber));

  const stats: StatDef[] = [
    { label: 'Matches', value: player.statsMatches },
    { label: 'Runs', value: player.statsRuns },
    { label: 'Wickets', value: player.statsWickets },
    { label: 'Average', value: player.statsAverage, fixed: 1 },
    { label: 'Strike Rate', value: player.statsSR, fixed: 0 },
  ].filter((s) => s.value != null);

  const wkNote = player.isWicketKeeper && player.role !== 'Wicket-Keeper Batter';
  const badges = [player.battingType, player.bowlingType !== 'N/A' ? player.bowlingType : null, wkNote ? 'Wicket-Keeper' : null]
    .filter((b): b is string => !!b);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card sm:flex-row">
      {/* Image side — shows the full, uncropped photo */}
      <div className="relative flex aspect-square w-full items-center justify-center bg-linear-to-br from-muted/70 to-muted/20 sm:aspect-auto sm:w-[46%] sm:min-h-[420px]">
        {player.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photo} alt={player.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-7xl font-black text-foreground/25">{initials(player.name)}</span>
        )}
        {/* Icon badge (kept left so it never clashes with the dialog close button) */}
        {player.isIcon && (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-amber-300 backdrop-blur-sm">
            <Star className="h-3 w-3 fill-current" />Icon{team ? ` · ${team.name}` : ''}
          </div>
        )}
      </div>

      {/* Details side */}
      <div className="flex-1 space-y-5 p-5 sm:w-[54%]">
        {/* Name + role */}
        <div>
          <h2 className="text-2xl font-black leading-tight tracking-tight text-foreground">{player.name}</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>
            <span className="h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            {player.role}
          </p>
        </div>

        {/* Trait badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b} className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">{b}</span>
            ))}
          </div>
        )}

        {/* Career stats */}
        {stats.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Career Stats</p>
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-background/40 p-3 text-center">
                  <p className="text-xl font-black tabular-nums leading-none text-foreground">
                    {s.fixed != null ? Number(s.value).toFixed(s.fixed) : s.value}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auction status */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Auction</p>
          {player.teamId ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <span className="h-3 w-3 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}80` }} />
                {team?.name ?? 'Team'}
              </span>
              {player.isIcon && !player.soldPrice ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-500"><Star className="h-3.5 w-3.5 fill-current" />Icon Pick</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600 dark:text-green-400"><Gavel className="h-3.5 w-3.5" />{fmtPrice(player.soldPrice ?? 0)}</span>
              )}
            </div>
          ) : player.isUnsold ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
              <Ban className="h-4 w-4" />Unsold
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />Not yet auctioned
            </div>
          )}
        </div>

        {/* Contact (creator-only — stripped server-side for everyone else) */}
        {phone && (
          <a href={`tel:${localPhoneDigits(player.contactNumber)}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <Phone className="h-4 w-4 opacity-60" />{phone}
          </a>
        )}

        {/* Organizer actions (certificate download) */}
        {actions && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/40 p-3">
            {actionsLabel && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{actionsLabel}</p>
            )}
            {actions}
          </div>
        )}

        {/* League footer */}
        {(leagueName || conductedBy) && (
          <div className="flex items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 opacity-60" />
            <span className="truncate">{leagueName}{conductedBy ? ` · ${conductedBy}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
