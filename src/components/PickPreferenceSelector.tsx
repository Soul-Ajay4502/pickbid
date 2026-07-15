'use client';

import { PLAYER_ROLES, type PlayerRole } from '@/lib/types';
import { ArrowUp, ArrowDown, X, Plus } from 'lucide-react';

interface PickPreferenceSelectorProps {
  value: PlayerRole[];
  onChange: (next: PlayerRole[]) => void;
}

export default function PickPreferenceSelector({ value, onChange }: PickPreferenceSelectorProps) {
  const remaining = PLAYER_ROLES.filter((r) => !value.includes(r));

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No preference set — players will be picked in random order.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {value.map((role, i) => (
            <li
              key={role}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/40"
            >
              <span className="w-5 h-5 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">{role}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${role} up`}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                aria-label={`Move ${role} down`}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${role}`}
                className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onChange([...value, role])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {role}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
