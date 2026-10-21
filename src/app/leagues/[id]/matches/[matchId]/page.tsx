import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getMatchCentre } from '@/lib/store';
import { statusText, tryReplay } from '@/lib/scoring';
import MatchCentreView from '@/components/scoring/MatchCentreView';
import type { MatchCentre } from '@/lib/types';

// The match centre — live score, scorecard, commentary and squads for one
// match. Public by link like the auction's /watch (see `isPublicPath`), and
// server-rendered with the score already in it, so a link shared to WhatsApp
// previews with the score and the first paint isn't a skeleton. Updates after
// that come from the edge-cached score feed the view polls.

const loadCentre = cache(async (id: string, matchId: string): Promise<MatchCentre | null> => {
  try {
    return await getMatchCentre(id, matchId);
  } catch {
    return null;
  }
});

function headline(centre: MatchCentre): string {
  const card = centre.scorecard;
  if (card) {
    const r = tryReplay(card.setup, card.events);
    if (r.ok) return statusText(r.state);
  }
  return centre.match.matchDate ? `Fixture on ${centre.match.matchDate}` : 'Fixture';
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string; matchId: string }> },
): Promise<Metadata> {
  const { id, matchId } = await params;
  const centre = await loadCentre(id, matchId);
  if (!centre) return {};
  const { team1, team2, leagueName } = centre.match;
  const live = centre.scorecard?.phase === 'live' || centre.scorecard?.phase === 'break';
  const title = `${team1.name} vs ${team2.name} — ${live ? 'Live score' : 'Scorecard'}`;
  const description = `${headline(centre)} · ${leagueName}`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function MatchCentrePage(
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const { id, matchId } = await params;
  const centre = await loadCentre(id, matchId);
  if (!centre) notFound();
  return <MatchCentreView leagueId={id} initial={centre} />;
}
