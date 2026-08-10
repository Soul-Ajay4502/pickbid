'use client';

import { useMemo, useState } from 'react';
import { formatINR } from '@/lib/utils';

/**
 * Works out whether a set of auction numbers is actually playable.
 *
 * The figure organizers get wrong is the reserve: if a team must fill `n` more
 * slots after the player currently on the block, it has to keep `n × basePrice`
 * back, so its legal maximum bid is `purse − n × basePrice`. Getting this wrong
 * is how a team ends the auction unable to field a side.
 *
 * All arithmetic is client-side — nothing is sent anywhere.
 */

type Field = {
  key: 'teams' | 'squadSize' | 'purse' | 'basePrice';
  label: string;
  hint: string;
  min: number;
  step: number;
};

const FIELDS: Field[] = [
  { key: 'teams', label: 'Teams', hint: 'How many teams are bidding', min: 2, step: 1 },
  { key: 'squadSize', label: 'Squad size', hint: 'Players each team must end with', min: 1, step: 1 },
  { key: 'purse', label: 'Purse per team', hint: 'Budget each team starts with', min: 0, step: 1000 },
  { key: 'basePrice', label: 'Base price', hint: 'Opening bid for every player', min: 0, step: 100 },
];

export default function BudgetCalculator() {
  const [values, setValues] = useState({
    teams: 8,
    squadSize: 11,
    purse: 1000000,
    basePrice: 10000,
  });

  const result = useMemo(() => {
    const { teams, squadSize, purse, basePrice } = values;
    const playersNeeded = teams * squadSize;
    const totalMoney = teams * purse;
    const squadFloor = squadSize * basePrice;

    // The largest bid a team can make on its very first player while still
    // affording base price for every remaining slot.
    const maxOpeningBid = purse - (squadSize - 1) * basePrice;
    const headroom = purse - squadFloor;

    return {
      playersNeeded,
      totalMoney,
      squadFloor,
      maxOpeningBid,
      headroom,
      // How many base-price players the spare money could have bought instead —
      // a rough read on how much room there is for bidding wars.
      headroomMultiple: basePrice > 0 ? headroom / basePrice : 0,
      averagePerPlayer: squadSize > 0 ? purse / squadSize : 0,
      // Below 1× the squad floor a team cannot even fill its squad.
      viable: headroom >= 0,
    };
  }, [values]);

  function update(key: Field['key'], raw: string) {
    const parsed = Number(raw);
    setValues((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  }

  const rows: { label: string; value: string; note: string }[] = [
    {
      label: 'Players needed',
      value: String(result.playersNeeded),
      note: 'Register at least this many, or drop a team.',
    },
    {
      label: 'Total money in play',
      value: formatINR(result.totalMoney),
      note: 'Across every team’s purse combined.',
    },
    {
      label: 'Minimum to fill a squad',
      value: formatINR(result.squadFloor),
      note: 'Squad size × base price — a team cannot spend below this.',
    },
    {
      label: 'Spare money per team',
      value: formatINR(Math.max(result.headroom, 0)),
      note: result.viable
        ? `About ${result.headroomMultiple.toFixed(1)}× the base price to bid with.`
        : 'Negative — see the warning below.',
    },
    {
      label: 'Largest legal opening bid',
      value: formatINR(Math.max(result.maxOpeningBid, 0)),
      note: 'Purse minus base price for every other squad slot.',
    },
    {
      label: 'Average per player',
      value: formatINR(result.averagePerPlayer),
      note: 'If a team spread its purse evenly across the squad.',
    },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card/30 p-5 sm:p-6">
      <div className="grid sm:grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={`budget-${field.key}`}
              className="block text-sm font-semibold text-foreground"
            >
              {field.label}
            </label>
            <input
              id={`budget-${field.key}`}
              type="number"
              inputMode="numeric"
              min={field.min}
              step={field.step}
              value={values[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>

      {!result.viable && (
        <p
          role="status"
          className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          These numbers do not work: a purse of {formatINR(values.purse)} cannot fill a
          squad of {values.squadSize} at a base price of {formatINR(values.basePrice)}.
          Raise the purse, lower the base price, or cut the squad size.
        </p>
      )}

      <dl className="mt-6 divide-y divide-border/40 border-t border-border/40">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <dt className="text-sm text-muted-foreground min-w-44 flex-1">
              {row.label}
              <span className="block text-xs text-muted-foreground/70">{row.note}</span>
            </dt>
            <dd className="text-base font-bold tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
