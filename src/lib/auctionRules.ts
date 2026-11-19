/**
 * The auction's purse rule, in one place.
 *
 * A squad size is exact — every slot gets filled — so a team must always keep
 * the base price back for each slot it still has to fill *after* the player it
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
  /** Squad slots still to fill, including the one being bid on. */
  slotsLeft: number;
  /** Held back for the *other* open slots: `(slotsLeft − 1) × basePrice`. */
  reserve: number;
  /** Highest legal price for the next player. 0 when the squad is full. */
  maxBid: number;
  /**
   * How far the purse falls short of filling every open slot at the base
   * price. Above 0 the team can't legally buy anyone — the purse or the base
   * price has to change first.
   */
  shortfall: number;
}

export function auctionLimits(input: {
  budget: number;
  /** Total already spent on the squad — excluding the player being priced. */
  spent: number;
  /** Players already in the squad — excluding the player being priced. */
  squadSize: number;
  maxPlayers: number;
  /** The league's base price; null or 0 means no reserve rule. */
  basePrice: number | null | undefined;
}): AuctionLimits {
  const base = Math.max(0, input.basePrice ?? 0);
  const balance = input.budget - input.spent;
  const slotsLeft = Math.max(0, input.maxPlayers - input.squadSize);
  const reserve = Math.max(0, slotsLeft - 1) * base;
  const maxBid = slotsLeft === 0 ? 0 : Math.max(0, balance - reserve);
  const shortfall = Math.max(0, slotsLeft * base - balance);
  return { balance, slotsLeft, reserve, maxBid, shortfall };
}

/** The sentence shown when a price breaks the reserve rule. */
export function reserveRuleMessage(teamName: string, limits: AuctionLimits, fmt: (n: number) => string): string {
  const others = limits.slotsLeft - 1;
  if (others <= 0 || limits.reserve === 0) return `Exceeds ${teamName}'s remaining purse of ${fmt(Math.max(0, limits.balance))}`;
  return `Exceeds ${teamName}'s max bid of ${fmt(limits.maxBid)} — it must keep ${fmt(limits.reserve)} for its ${others} other open slot${others === 1 ? '' : 's'}`;
}
