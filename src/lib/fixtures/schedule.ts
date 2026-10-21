import type { FixtureMatch } from './types';

/**
 * Scheduling: putting dates on a fixture that already exists. Kept apart from
 * generation on purpose — the fixture decides who plays whom and in what
 * order; this decides when. Times, venues and per-day match limits belong here
 * as they arrive, without touching the generator.
 */

export interface ScheduleOptions {
  /** `YYYY-MM-DD` of round one. */
  startDate: string;
  /** Days from one round to the next; 0 puts every round on the start date. */
  daysBetweenRounds: number;
}

export type ScheduledMatch<T extends { round: number } = FixtureMatch> = T & { matchDate: string };

/** `YYYY-MM-DD`, the shape `matches.matchDate` stores and `<input type="date">` produces. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Round-trips only for a real calendar day — rejects 2026-02-30.
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * The date round `roundIndex` (0-based) is played on, when round one is on
 * `startDate` and each later round follows `daysBetweenRounds` after the last.
 * Worked in UTC so the server and the browser land on the same calendar day.
 */
export function roundDate(startDate: string, roundIndex: number, daysBetweenRounds: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + roundIndex * daysBetweenRounds);
  return d.toISOString().slice(0, 10);
}

/** "25 Oct" for a stored `YYYY-MM-DD`, read in UTC so no timezone shifts it a day. */
export function formatMatchDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Dates every match by its round: one round per date, rounds spaced evenly. */
export function scheduleFixtures<T extends { round: number }>(
  matches: readonly T[],
  options: ScheduleOptions,
): ScheduledMatch<T>[] {
  return matches.map((m) => ({ ...m, matchDate: roundDate(options.startDate, m.round - 1, options.daysBetweenRounds) }));
}
