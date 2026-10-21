import { NextRequest, NextResponse } from 'next/server';
import { getTeams, createMatches } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import {
  assignRounds,
  isIsoDate,
  parseFixtureConfig,
  scheduleFixtures,
  validateFixture,
  type FixtureMatch,
  type PossibleMatch,
} from '@/lib/fixtures';

// 20 teams home-and-away is 380 matches; anything past this is a mistake.
const MAX_FIXTURES = 500;

/**
 * Saves a fixture the organizer previewed on the matches screen. The client
 * sends the exact matches it showed, in order, with the config that produced
 * them; this re-validates that list against the league's *current* teams with
 * the same `validateFixture` the generator uses — so only this league's teams
 * can appear, and a fixture built before a team was added or removed is refused
 * rather than saved half-right. Rounds are worked out here from the order, and
 * dates from the optional schedule. Existing matches are left alone.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { error, status } = await requireLeagueManager(id);
    if (error) return NextResponse.json({ error }, { status });

    const body = await request.json().catch(() => null);
    const parsed = parseFixtureConfig(body?.config);
    if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });

    const raw: unknown = body?.matches;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: 'The fixture has no matches' }, { status: 400 });
    }
    if (raw.length > MAX_FIXTURES) {
      return NextResponse.json({ error: `A fixture can have at most ${MAX_FIXTURES} matches` }, { status: 400 });
    }
    const order: PossibleMatch[] = [];
    for (const m of raw) {
      if (!m || typeof m.team1Id !== 'string' || typeof m.team2Id !== 'string') {
        return NextResponse.json({ error: 'The fixture is malformed' }, { status: 400 });
      }
      order.push({ teamAId: m.team1Id, teamBId: m.team2Id });
    }

    let schedule: { startDate: string; daysBetweenRounds: number } | null = null;
    if (body.schedule != null) {
      if (!isIsoDate(body.schedule.startDate)) return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
      const gap = Math.floor(Number(body.schedule.daysBetweenRounds));
      schedule = { startDate: body.schedule.startDate, daysBetweenRounds: Number.isFinite(gap) ? Math.min(60, Math.max(0, gap)) : 0 };
    }

    // Name order, as the matches screen generates in.
    const teams = (await getTeams(id)).sort((a, b) => a.name.localeCompare(b.name));
    const labels = Object.fromEntries(teams.map((t) => [t.id, t.name]));
    const check = validateFixture(teams.map((t) => t.id), order, parsed.config, labels);
    if (!check.valid) {
      return NextResponse.json(
        { error: `${check.errors[0].message} Reload the page and generate the fixture again.`, issues: check.errors },
        { status: 400 },
      );
    }

    const rounds = assignRounds(order);
    const fixture: FixtureMatch[] = order.map((m, i) => ({ ...m, round: rounds[i] }));
    const dated = schedule
      ? scheduleFixtures(fixture, schedule)
      : fixture.map((m) => ({ ...m, matchDate: null }));

    const matches = await createMatches(id, dated.map((m) => ({ team1Id: m.teamAId, team2Id: m.teamBId, matchDate: m.matchDate })));
    return NextResponse.json(matches, { status: 201 });
  } catch (err) {
    console.error('Failed to save fixtures:', err);
    return NextResponse.json({ error: 'Failed to save fixtures' }, { status: 500 });
  }
}
