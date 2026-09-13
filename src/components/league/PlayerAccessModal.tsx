'use client';

import { useState } from 'react';
import { Eye, Globe, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

/** The two league columns this modal writes. */
export type PlayerAccessField = 'rosterVisibleToPlayers' | 'playersCanDeleteCards';

interface PlayerAccessModalProps {
  leagueId: string;
  rosterVisibleToPlayers: boolean;
  playersCanDeleteCards: boolean;
  /**
   * True when this league is also published. A public league's roster is
   * server-rendered for logged-out visitors by `getPublicLeagueView`, so hiding
   * it from the league's own players would hide it from nobody — the modal says
   * so rather than letting an organizer believe otherwise.
   */
  isPublic: boolean;
  /** Fired after a successful save so the parent can update its copy. */
  onSaved: (field: PlayerAccessField, value: boolean) => void;
  onClose: () => void;
}

const SWITCHES: {
  field: PlayerAccessField;
  Icon: typeof Eye;
  title: string;
  onCopy: string;
  offCopy: string;
}[] = [
  {
    field: 'rosterVisibleToPlayers',
    Icon: Eye,
    title: 'Players can see the full roster',
    onCopy: 'Everyone who opens this league sees every registered card.',
    offCopy: 'Players see only their own card and the icon players. You and your co-organizers still see everyone.',
  },
  {
    field: 'playersCanDeleteCards',
    Icon: Trash2,
    title: 'Players can delete their own card',
    onCopy: 'Whoever created a card can remove it again from this league.',
    offCopy: 'Only you and your co-organizers can remove a card. Players can still edit their own.',
  },
];

/**
 * Organizer controls over what a league's players may do with each other's
 * cards. Both switches default to on, which is how every league behaved before
 * they existed — this modal is where an organizer opts into a closed roster or
 * a locked register, and both are enforced in the API, not just here.
 */
export default function PlayerAccessModal({
  leagueId,
  rosterVisibleToPlayers,
  playersCanDeleteCards,
  isPublic,
  onSaved,
  onClose,
}: PlayerAccessModalProps) {
  const [saving, setSaving] = useState<PlayerAccessField | null>(null);
  const value: Record<PlayerAccessField, boolean> = {
    rosterVisibleToPlayers,
    playersCanDeleteCards,
  };

  async function handleToggle(field: PlayerAccessField, next: boolean) {
    setSaving(field);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error('Failed to update the league');
      onSaved(field, next);
      toast.success(
        field === 'rosterVisibleToPlayers'
          ? next ? 'Players can see the full roster' : 'Roster hidden — players see only their own card'
          : next ? 'Players can delete their own card' : 'Card deletion is now organizers-only'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="flex items-center gap-2.5">
          <Eye className="w-5 h-5 text-green-600 dark:text-green-500" />Player Access
        </DialogTitle>
        <DialogDescription>
          What the players in this league can do with each other&apos;s cards. Both are on by
          default; turning either off applies immediately.
        </DialogDescription>

        <div className="space-y-2 mt-1">
          {SWITCHES.map(({ field, Icon, title, onCopy, offCopy }) => {
            const on = value[field];
            const busy = saving === field;
            return (
              <button
                key={field}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={!!saving}
                onClick={() => handleToggle(field, !on)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  on ? 'border-green-500/40 bg-green-500/8' : 'border-amber-500/40 bg-amber-500/8'
                }`}
              >
                <span className="flex items-start gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${on ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{on ? onCopy : offCopy}</span>
                  </span>
                </span>
                {busy ? (
                  <span className="w-4 h-4 shrink-0 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
                      on ? 'bg-green-600' : 'bg-muted-foreground/25'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-1'}`} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* A hidden roster on a published league hides nothing — the public page
            lists every player to anyone with the link, signed in or not. */}
        {isPublic && !rosterVisibleToPlayers && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/8 border border-amber-500/25 rounded-xl px-3 py-2.5">
            <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              This league is public, so its page already lists every player to anyone with the link.
              Make it private for a hidden roster to mean anything.
            </span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
