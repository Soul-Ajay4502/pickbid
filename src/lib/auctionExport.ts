// The auction's outcome as an Excel workbook: who went where for how much, and
// what each team has left.
//
// Three sheets, because that is how organizers read a result: every signing in
// one sortable list, one row per team with its purse, and whoever is still
// without a team. Built in the browser from the roster the page already holds
// (`buildWorkbook` in sheetWriter.ts), so there is no export endpoint to gate —
// and nothing organizer-only goes in: no phone numbers, no documents. This file
// gets forwarded to captains and posted in the league's group.

import { buildWorkbook, type SheetCell, type SheetSpec } from './sheetWriter';
import type { Player, Team } from './types';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/** The workbook's sheets — separate from the download so it can be checked on its own. */
export function auctionResultSheets(teams: Team[], players: Player[]): SheetSpec[] {
  const sortedTeams = [...teams].sort(byName);
  const squadOf = (teamId: string) =>
    players
      .filter((p) => p.teamId === teamId)
      // Icons first, then by price — the order the team page shows a squad in
      .sort((a, b) => Number(!!b.isIcon) - Number(!!a.isIcon) || (b.soldPrice ?? 0) - (a.soldPrice ?? 0) || byName(a, b));

  const results: SheetCell[][] = [];
  const summary: SheetCell[][] = [];
  for (const team of sortedTeams) {
    const squad = squadOf(team.id);
    const spent = squad.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0);
    for (const p of squad) {
      results.push([
        team.name,
        p.name,
        p.role + (p.isWicketKeeper && p.role !== 'Wicket-Keeper Batter' ? ' (WK)' : ''),
        p.battingType,
        p.bowlingType,
        p.isIcon ? 'Icon' : 'Auction',
        p.soldPrice ?? 0,
      ]);
    }
    summary.push([
      team.name,
      squad.length,
      team.maxPlayers,
      Math.max(0, team.maxPlayers - squad.length),
      team.budget,
      spent,
      team.budget - spent,
      squad.length > 0 ? Math.round(spent / squad.length) : 0,
      squad.reduce((max, p) => Math.max(max, p.soldPrice ?? 0), 0),
    ]);
  }

  const teamless = players
    .filter((p) => !p.teamId)
    .sort((a, b) => Number(!!b.isUnsold) - Number(!!a.isUnsold) || byName(a, b))
    .map((p): SheetCell[] => [p.name, p.role, p.battingType, p.bowlingType, p.isUnsold ? 'Unsold' : 'Not auctioned']);

  return [
    {
      name: 'Results',
      columns: [
        { header: 'Team', width: 24 }, { header: 'Player', width: 28 }, { header: 'Role', width: 24 },
        { header: 'Batting', width: 16 }, { header: 'Bowling', width: 20 }, { header: 'Signing', width: 11 },
        { header: 'Price (₹)', width: 14 },
      ],
      rows: results,
    },
    {
      name: 'Teams',
      columns: [
        { header: 'Team', width: 24 }, { header: 'Players', width: 10 }, { header: 'Squad size', width: 12 },
        { header: 'Slots left', width: 11 }, { header: 'Budget (₹)', width: 14 }, { header: 'Spent (₹)', width: 14 },
        { header: 'Purse left (₹)', width: 16 }, { header: 'Average price (₹)', width: 18 }, { header: 'Top buy (₹)', width: 14 },
      ],
      rows: summary,
    },
    {
      name: 'Without a team',
      columns: [
        { header: 'Player', width: 28 }, { header: 'Role', width: 24 }, { header: 'Batting', width: 16 },
        { header: 'Bowling', width: 20 }, { header: 'Status', width: 16 },
      ],
      rows: teamless,
    },
  ];
}

/** Builds the workbook and hands it to the browser as a download. */
export function downloadAuctionResults(leagueName: string, teams: Team[], players: Player[]): void {
  const blob = buildWorkbook(auctionResultSheets(teams, players));
  const safe = leagueName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'league';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}-auction-results.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
