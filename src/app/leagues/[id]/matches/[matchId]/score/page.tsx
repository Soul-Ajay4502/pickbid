'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import MatchSetupForm from '@/components/scoring/MatchSetupForm';
import ScorerConsole from '@/components/scoring/ScorerConsole';
import type { LeagueWithPlayers, MatchCentre, MatchScorecard } from '@/lib/types';

/**
 * The scorer's console for one match — organizers only. Before the first ball
 * it is the setup form (rules, squads, toss); after that, the keypad.
 *
 * Immersive (see `isImmersiveLeaguePath`): no nav bar, no league rail. It is a
 * phone held at the boundary for a whole match.
 */
export default function ScoreMatchPage() {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const router = useRouter();
  const [league, setLeague] = useState<LeagueWithPlayers | null>(null);
  const [centre, setCentre] = useState<MatchCentre | null>(null);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [lr, sr] = await Promise.all([
          fetch(`/api/leagues/${id}`),
          // Straight past the one-second edge cache the spectators share: the
          // scorer has to build on the newest version or the first write conflicts.
          fetch(`/api/leagues/${id}/matches/${matchId}/score`, { cache: 'no-store' }),
        ]);
        if (!active) return;
        if (!lr.ok) { router.replace('/'); return; }
        const l = (await lr.json()) as LeagueWithPlayers;
        if (!l.canManage) { router.replace(`/leagues/${id}/matches/${matchId}`); return; }
        if (!sr.ok) { setFailed(sr.status === 404 ? 'This match no longer exists.' : 'Could not load the match.'); return; }
        const c = (await sr.json()) as MatchCentre;
        if (!active) return;
        setLeague(l);
        setCentre(c);
      } catch {
        if (active) setFailed('Could not load the match — check your connection.');
      }
    })();
    return () => { active = false; };
  }, [id, matchId, router]);

  if (failed) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{failed}</p>
        <Link href={`/leagues/${id}/matches`} className="text-sm font-semibold text-primary">Back to matches</Link>
      </div>
    );
  }

  if (!league || !centre) {
    return (
      <div className="min-h-dvh max-w-xl mx-auto px-3 py-4 space-y-3">
        {[56, 160, 120, 260].map((h, i) => <div key={i} className="rounded-2xl bg-muted shimmer" style={{ height: h }} />)}
      </div>
    );
  }

  const card = centre.scorecard;
  const { team1, team2 } = centre.match;

  if (!card || editing) {
    return (
      <div className="min-h-dvh bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 h-14">
            <button type="button"
              onClick={() => (editing ? setEditing(false) : router.push(`/leagues/${id}/matches/${matchId}`))}
              aria-label="Back"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{team1.name} vs {team2.name}</p>
              <p className="text-[11px] text-muted-foreground">Match setup · {league.name}</p>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-3 py-4">
          <MatchSetupForm
            leagueId={id}
            match={{ id: matchId, team1Id: team1.id, team2Id: team2.id }}
            teams={league.teams}
            players={league.players}
            existing={card}
            onSaved={(saved: MatchScorecard) => { setCentre({ ...centre, scorecard: saved }); setEditing(false); }}
          />
        </main>
      </div>
    );
  }

  return (
    <ScorerConsole
      // A new setup is a new log: remount rather than carry the old one's sync state
      key={`${card.version}-${card.updatedAt}`}
      leagueId={id}
      card={card}
      players={league.players}
      onEditSetup={(version) => { setCentre({ ...centre, scorecard: { ...card, version, events: [] } }); setEditing(true); }}
    />
  );
}
