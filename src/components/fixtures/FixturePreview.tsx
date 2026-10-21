import type { FixtureMatch } from '@/lib/fixtures';

/**
 * What a fixture will be, before anyone saves it: every match in order, grouped
 * by round, and how many matches each team ends up with. Shared by the matches
 * screen and the public tool.
 */
export default function FixturePreview({ matches, teams, colorOf }: {
  matches: FixtureMatch[];
  teams: { id: string; name: string }[];
  colorOf?: (teamId: string) => string | undefined;
}) {
  const nameOf = new Map(teams.map((t) => [t.id, t.name]));
  const played = new Map(teams.map((t) => [t.id, 0]));
  // Each match keeps its overall number while being grouped into its round.
  const rounds: { match: FixtureMatch; number: number }[][] = [];
  matches.forEach((match, i) => {
    (rounds[match.round - 1] ??= []).push({ match, number: i + 1 });
    played.set(match.teamAId, (played.get(match.teamAId) ?? 0) + 1);
    played.set(match.teamBId, (played.get(match.teamBId) ?? 0) + 1);
  });
  const most = Math.max(1, ...played.values());

  const team = (id: string) => {
    const color = colorOf?.(id);
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
        <span className="truncate">{nameOf.get(id) ?? id}</span>
      </span>
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
      <section aria-label="Fixture preview" className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Fixture Preview</h3>
          <p className="text-xs text-muted-foreground tabular-nums">Total matches: {matches.length}</p>
        </div>
        <ol className="max-h-96 overflow-y-auto divide-y divide-border/60">
          {rounds.map((round, r) => {
            const resting = teams.filter((t) => !round.some(({ match }) => match.teamAId === t.id || match.teamBId === t.id));
            return (
              <li key={r} className="px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1.5">Round {r + 1}</p>
                <ul className="space-y-1">
                  {round.map(({ match, number }) => (
                    <li key={number} className="grid grid-cols-[1.5rem_1fr_auto_1fr] sm:grid-cols-[4.5rem_1fr_auto_1fr] items-center gap-2 text-sm">
                      <span className="text-xs text-muted-foreground tabular-nums"><span className="hidden sm:inline">Match </span>{number}</span>
                      {team(match.teamAId)}
                      <span className="text-xs text-muted-foreground">vs</span>
                      {team(match.teamBId)}
                    </li>
                  ))}
                </ul>
                {resting.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {resting.length <= 3 ? `Resting: ${resting.map((t) => t.name).join(', ')}` : `${resting.length} teams resting`}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Team participation" className="rounded-xl border border-border overflow-hidden self-start">
        <h3 className="px-3 py-2 bg-muted/40 border-b border-border text-sm font-semibold">Team participation</h3>
        <ul className="max-h-96 overflow-y-auto divide-y divide-border/60">
          {teams.map((t) => {
            const count = played.get(t.id) ?? 0;
            return (
              <li key={t.id} className="px-3 py-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  {team(t.id)}
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${(count / most) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
