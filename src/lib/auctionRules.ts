/**
 * The auction's purse rule, in one place.
 *
 * A team must keep the base price back for each slot needed to reach its
 * minimum *after* the player it
 * is bidding on. This file is the only copy of that arithmetic: the auction
 * screen, the spectator broadcast, the team page's corrections and the server's
 * `assignPlayerToTeam` all call it, so the "Max" a screen shows is always the
 * limit the server enforces.
 *
 * Pure and dependency-free — safe to import from client components and from
 * `store.ts` alike.
 */

export interface AuctionLimits {
  /** Purse left: budget minus everything already spent. */
  balance: number;
  /** Capacity left before the maximum squad size is reached. */
  slotsLeft: number;
  /** Players still needed to reach the minimum, including the current bid. */
  requiredSlots: number;
  /** Held back for the other required slots. */
  reserve: number;
  /** Highest legal price for the next player. 0 when the squad is full. */
  maxBid: number;
  /**
   * How far the purse falls short of reaching the minimum at the base price.
   */
  shortfall: number;
}

export function auctionLimits(input: {
  budget: number;
  /** Total already spent on the squad — excluding the player being priced. */
  spent: number;
  /** Players already in the squad — excluding the player being priced. */
  squadSize: number;
  /** Omitted for legacy exact-size squads. */
  minPlayers?: number;
  maxPlayers: number;
  /** The league's base price; null or 0 means no reserve rule. */
  basePrice: number | null | undefined;
}): AuctionLimits {
  const base = Math.max(0, input.basePrice ?? 0);
  const balance = input.budget - input.spent;
  const slotsLeft = Math.max(0, input.maxPlayers - input.squadSize);
  const requiredSlots = Math.max(0, (input.minPlayers ?? input.maxPlayers) - input.squadSize);
  const reserve = Math.max(0, requiredSlots - 1) * base;
  const maxBid = slotsLeft === 0 ? 0 : Math.max(0, balance - reserve);
  const shortfall = Math.max(0, requiredSlots * base - balance);
  return { balance, slotsLeft, requiredSlots, reserve, maxBid, shortfall };
}

/** Null league limits preserve each legacy team's exact-size rule. */
export function squadLimits(
  legacyMax: number,
  league: { minSquadSize: number | null; maxSquadSize: number | null }
): { minPlayers: number; maxPlayers: number } {
  return {
    minPlayers: league.minSquadSize ?? legacyMax,
    maxPlayers: league.maxSquadSize ?? legacyMax,
  };
}

export function validSquadRange(min: unknown, max: unknown): boolean {
  return typeof min === 'number' && typeof max === 'number'
    && Number.isInteger(min) && Number.isInteger(max)
    && min >= 11 && max >= min && max <= 100;
}

/** The sentence shown when a price breaks the reserve rule. */
export function reserveRuleMessage(teamName: string, limits: AuctionLimits, fmt: (n: number) => string): string {
  const others = limits.requiredSlots - 1;
  if (others <= 0 || limits.reserve === 0) return `Exceeds ${teamName}'s remaining purse of ${fmt(Math.max(0, limits.balance))}`;
  return `Exceeds ${teamName}'s max bid of ${fmt(limits.maxBid)} — it must keep ${fmt(limits.reserve)} for its ${others} other required slot${others === 1 ? '' : 's'}`;
}
