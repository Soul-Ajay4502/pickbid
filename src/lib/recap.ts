// Post-auction storytelling helpers, shared by the "Auction Wrapped" recap
// (/leagues/[id]/wrapped) and the squad pack-opening reveal
// (/leagues/[id]/teams/[teamId]/reveal). Pure functions over the
// LeagueWithPlayers payload — no fetching, no state.

import type { LeagueWithPlayers, Player } from './types';

/** A sale, everywhere in these features, means the same thing as on the
 *  leaderboard: assigned to a team at a winning bid > 0. Pre-assigned icon
 *  players have no bid and are celebrated separately. */
export function isSold(p: Player): boolean {
  return !!p.teamId && (p.soldPrice ?? 0) > 0;
}

/** Every winning bid in the league — the reference distribution for rarity. */
export function winningBids(players: Player[]): number[] {
  return players.filter(isSold).map((p) => p.soldPrice!);
}

// ── Rarity ────────────────────────────────────────────────────────────────────

/** Card rarity tier, from where a winning bid sits among every sale in the league. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'icon';

export interface RarityMeta {
  label: string;
  /** Accent color for glows, chips and foil */
  color: string;
  /** "R,G,B" of the accent, for rgba() */
  rgb: string;
  /** Strength of the holographic foil overlay, 0–1 */
  foil: number;
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  common:    { label: 'Squad Player', color: '#94a3b8', rgb: '148,163,184', foil: 0 },
  rare:      { label: 'Rare',         color: '#38bdf8', rgb: '56,189,248',  foil: 0.22 },
  epic:      { label: 'Epic',         color: '#a855f7', rgb: '168,85,247',  foil: 0.34 },
  legendary: { label: 'Legendary',    color: '#fbbf24', rgb: '251,191,36',  foil: 0.5 },
  icon:      { label: 'Icon',         color: '#ffd700', rgb: '255,215,0',   foil: 0.5 },
};

/**
 * Tier a player by price percentile across the league's winning bids.
 * Strict rank (bids strictly below) so a league where everyone went for the
 * same price stays common rather than everyone turning legendary; the single
 * priciest buy is always legendary.
 */
export function rarityOf(player: Player, bids: number[]): Rarity {
  if (player.isIcon) return 'icon';
  const price = player.soldPrice ?? 0;
  if (price <= 0 || bids.length === 0) return 'common';
  if (price >= Math.max(...bids)) return 'legendary';
  const pct = bids.filter((b) => b < price).length / bids.length;
  if (pct >= 0.85) return 'legendary';
  if (pct >= 0.6) return 'epic';
  if (pct >= 0.3) return 'rare';
  return 'common';
}

/**
 * The order cards come out of a squad pack: cheapest first so the suspense
 * builds toward the marquee buy, with pre-assigned icon players as the final
 * flourish after it.
 */
export function revealOrder(squad: Player[]): Player[] {
  return [...squad].sort((a, b) => {
    if (!!a.isIcon !== !!b.isIcon) return a.isIcon ? 1 : -1;
    const pa = a.soldPrice ?? 0, pb = b.soldPrice ?? 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

// ── Wrapped stats ─────────────────────────────────────────────────────────────

/** Per-team money summary. Teams are resolved from the league's Team rows when
 *  they exist; leagues that recorded sales against free-text team names get an
 *  ad-hoc entry per name so nobody drops out of the recap. */
export interface TeamSpend {
  id: string;
  name: string;
  colorHex: string;
  budget: number | null;
  spent: number;
  count: number;
  topBuy: Player | null;
}

export interface RoleSpend {
  role: Player['role'];
  spent: number;
  count: number;
}

export interface WrappedStats {
  /** Players with a winning bid, priciest first */
  soldPlayers: Player[];
  totalSpend: number;
  avgPrice: number;
  /** Top of soldPlayers (up to 5) */
  topBuys: Player[];
  /** The cheapest winning bid — only when there was more than one sale */
  steal: Player | null;
  /** Biggest spender first */
  teamSpends: TeamSpend[];
  unsoldCount: number;
  iconCount: number;
  /** Where the money went by role, biggest first */
  roleSpends: RoleSpend[];
  season: string;
}

const FALLBACK_TEAM_COLOR = '#64748b';

export function computeWrapped(data: LeagueWithPlayers): WrappedStats {
  const soldPlayers = data.players
    .filter(isSold)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));

  const totalSpend = soldPlayers.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  const avgPrice = soldPlayers.length > 0 ? totalSpend / soldPlayers.length : 0;

  const spendByTeam = new Map<string, TeamSpend>();
  for (const t of data.teams) {
    spendByTeam.set(t.id, { id: t.id, name: t.name, colorHex: t.colorHex, budget: t.budget, spent: 0, count: 0, topBuy: null });
  }
  for (const p of soldPlayers) {
    let entry = spendByTeam.get(p.teamId!);
    if (!entry) {
      entry = { id: p.teamId!, name: p.teamId!, colorHex: FALLBACK_TEAM_COLOR, budget: null, spent: 0, count: 0, topBuy: null };
      spendByTeam.set(p.teamId!, entry);
    }
    entry.spent += p.soldPrice ?? 0;
    entry.count += 1;
    // soldPlayers is priciest-first, so the first hit is the team's top buy
    entry.topBuy ??= p;
  }
  const teamSpends = [...spendByTeam.values()].sort((a, b) => b.spent - a.spent || b.count - a.count);

  const spendByRole = new Map<Player['role'], RoleSpend>();
  for (const p of soldPlayers) {
    const entry = spendByRole.get(p.role) ?? { role: p.role, spent: 0, count: 0 };
    entry.spent += p.soldPrice ?? 0;
    entry.count += 1;
    spendByRole.set(p.role, entry);
  }
  const roleSpends = [...spendByRole.values()].sort((a, b) => b.spent - a.spent);

  return {
    soldPlayers,
    totalSpend,
    avgPrice,
    topBuys: soldPlayers.slice(0, 5),
    steal: soldPlayers.length > 1 ? soldPlayers[soldPlayers.length - 1] : null,
    teamSpends,
    unsoldCount: data.players.filter((p) => p.isUnsold).length,
    iconCount: data.players.filter((p) => p.isIcon).length,
    roleSpends,
    season: new Date(data.createdAt).getFullYear().toString(),
  };
}

/** Team context for a player in the recap (handles free-text team names too). */
export function teamOf(p: Player, teamSpends: TeamSpend[]): { name: string; colorHex: string } | null {
  if (!p.teamId) return null;
  const t = teamSpends.find((ts) => ts.id === p.teamId);
  return t ? { name: t.name, colorHex: t.colorHex } : { name: p.teamId, colorHex: FALLBACK_TEAM_COLOR };
}
