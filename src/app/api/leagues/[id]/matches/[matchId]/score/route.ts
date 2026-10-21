import { NextRequest, NextResponse } from 'next/server';
import {
  getMatch, getMatchCentre, getScorecard, getPlayers, getTeams, saveScorecard, deleteScorecard,
  ScorecardConflictError, type ScorecardDerived,
} from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import {
  LIMITS, ScoringError, matchRowResult, parseEvents, parseSetup, playerMatchLines, replay, summarizeMatch,
  type MatchSetup, type MatchState,
} from '@/lib/scoring';

// The ball-by-ball scorecard of one match.
//
// GET is public, like the auction's watch board: anyone holding the match link
// follows the score live, and a crowd polls it. So, exactly as there, the
// response is edge-cached for one second (`CDN-Cache-Control`) while browsers
// are told to revalidate every time — a ground full of phones collapses into
// about one origin read a second. The scorer's console bypasses that cache on
// purpose (it fetches with `cache: 'no-store'`), because it must start from
// the newest version or its first write will conflict.
//
// Writes are organizer-only and are never trusted as sent: the server replays
// the whole resulting log through the same engine the console runs, and stores
// it only if every event is legal and the log is still at the version the
// scorer built on.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string; matchId: string }> };

/** A request body is a scoring log at most; anything bigger is refused unread. */
const MAX_BODY = 600_000;

async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ScoringError('That request is too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new ScoringError('That request is not valid JSON');
  }
}

function derive(state: MatchState): ScorecardDerived {
  return {
    phase: state.phase,
    summary: summarizeMatch(state),
    playerLines: playerMatchLines(state),
    matchResult: matchRowResult(state),
  };
}

function conflict(current: unknown) {
  return NextResponse.json(
    { error: 'This scorecard was updated on another device', scorecard: current },
    { status: 409 },
  );
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id, matchId } = await params;
    const centre = await getMatchCentre(id, matchId);
    if (!centre) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    return NextResponse.json(centre, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        // See the note at the top, and the auction board's GET: one second of
        // hard freshness, deliberately without stale-while-revalidate.
        'CDN-Cache-Control': 'public, s-maxage=1',
      },
    });
  } catch (error) {
    console.error('Error reading scorecard:', error);
    return NextResponse.json({ error: 'Failed to read the scorecard' }, { status: 500 });
  }
}

/**
 * Starts scoring, or changes the setup before the first ball: rules, playing
 * squads and the toss. Body: `{ baseVersion, setup }`.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id, matchId } = await params;
    const { error, status, userId } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const match = await getMatch(id, matchId);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const body = (await readJson(request)) as { baseVersion?: unknown; setup?: unknown } | null;
    const parsed = parseSetup(body?.setup);
    if (parsed.sides[0].teamId !== match.team1Id || parsed.sides[1].teamId !== match.team2Id) {
      return NextResponse.json({ error: "The squads don't match this fixture's teams" }, { status: 400 });
    }

    // Names, colours and squads come from the league itself: a card id must be
    // a card in this league, and is shown under the name on that card. Anyone
    // without a card plays as a guest.
    const [players, teams, existing] = await Promise.all([getPlayers(id), getTeams(id), getScorecard(matchId)]);
    const cardName = new Map(players.map((p) => [p.id, p.name]));
    const sides = parsed.sides.map((side) => {
      const team = teams.find((t) => t.id === side.teamId);
      return {
        ...side,
        name: team?.name ?? side.name,
        color: team?.colorHex ?? side.color,
        players: side.players.map((p) => {
          if (p.id.startsWith('guest:')) return p;
          const name = cardName.get(p.id);
          if (!name) throw new ScoringError(`${p.name} isn't a player in this league — add them as a guest`);
          return { id: p.id, name };
        }),
      };
    }) as MatchSetup['sides'];
    const setup: MatchSetup = { ...parsed, sides };

    const baseVersion = Number(body?.baseVersion ?? 0);
    if (existing) {
      if (existing.events.length > 0) {
        return NextResponse.json(
          { error: 'Scoring has started — undo back to before the first ball to change the setup' },
          { status: 409 },
        );
      }
      if (existing.version !== baseVersion) return conflict(existing);
    } else if (baseVersion !== 0) {
      return conflict(null);
    }

    const saved = await saveScorecard({
      leagueId: id, matchId, baseVersion, setup, writeSetup: true, events: [],
      derived: derive(replay(setup, [])), userId,
    });
    return NextResponse.json(saved, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof ScoringError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ScorecardConflictError) return conflict(error.current);
    console.error('Error saving scorecard setup:', error);
    return NextResponse.json({ error: 'Failed to save the match setup' }, { status: 500 });
  }
}

/**
 * Records scoring. Body: `{ baseVersion, keep, append }` — keep the first
 * `keep` events of the stored log, then add `append`. Recording a ball is
 * keep-everything-and-append-one; undo is keeping one fewer; a scorer coming
 * back online sends everything it recorded offline in one go.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id, matchId } = await params;
    const { error, status, userId } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const existing = await getScorecard(matchId);
    if (!existing || existing.leagueId !== id) {
      return NextResponse.json({ error: 'Set up the match before scoring it' }, { status: 404 });
    }

    const body = (await readJson(request)) as { baseVersion?: unknown; keep?: unknown; append?: unknown } | null;
    const baseVersion = Number(body?.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion !== existing.version) return conflict(existing);

    const keep = Number(body?.keep);
    if (!Number.isInteger(keep) || keep < 0 || keep > existing.events.length) {
      return NextResponse.json({ error: 'Invalid keep count' }, { status: 400 });
    }
    const append = parseEvents(body?.append ?? []);
    const events = [...existing.events.slice(0, keep), ...append];
    if (events.length > LIMITS.events) throw new ScoringError('This scorecard has too many events');
    if (new Set(events.map((e) => e.id)).size !== events.length) throw new ScoringError('An event appears twice');

    let state: MatchState;
    try {
      state = replay(existing.setup, events);
    } catch (err) {
      if (err instanceof ScoringError) {
        return NextResponse.json({ error: err.message, eventIndex: err.eventIndex }, { status: 422 });
      }
      throw err;
    }

    const saved = await saveScorecard({
      leagueId: id, matchId, baseVersion, setup: existing.setup, writeSetup: false, events,
      derived: derive(state), userId,
    });
    return NextResponse.json({ version: saved.version, phase: saved.phase, updatedAt: saved.updatedAt });
  } catch (error) {
    if (error instanceof ScoringError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof ScorecardConflictError) return conflict(error.current);
    console.error('Error saving scorecard events:', error);
    return NextResponse.json({ error: 'Failed to save the score' }, { status: 500 });
  }
}

/** Discards the scorecard, and with it any result it put on the match. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id, matchId } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });
    const deleted = await deleteScorecard(id, matchId);
    if (!deleted) return NextResponse.json({ error: 'No scorecard to delete' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting scorecard:', error);
    return NextResponse.json({ error: 'Failed to delete the scorecard' }, { status: 500 });
  }
}
