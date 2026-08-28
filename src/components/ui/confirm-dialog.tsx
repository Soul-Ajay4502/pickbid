'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Body copy. Strings are rendered as a paragraph; nodes are rendered as-is. */
  description?: ReactNode;
  confirmLabel?: string;
  /** Shown next to the spinner while `onConfirm` is in flight. */
  pendingLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning icon. Defaults on, since every caller today deletes something. */
  destructive?: boolean;
  /**
   * Awaited. The dialog keeps itself open, disabled and spinning until it
   * settles, so a slow delete can't be double-fired or navigated away from.
   * Errors are swallowed here — handle them (toast) in the caller and leave
   * the dialog open so the user can retry.
   */
  onConfirm: () => void | Promise<void>;
  /** Cancel, backdrop click or Escape. Never fires while the action is pending. */
  onClose: () => void;
}

/**
 * Replacement for `window.confirm()` for actions that hit the network: the
 * native dialog can't show progress and hands control straight back to the
 * page, which lets the user keep clicking while the request is still running.
 * This one blocks the app behind a modal backdrop for the whole round trip.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  pendingLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  // `onConfirm` often navigates away (deleted league → home), unmounting us
  // mid-await; don't touch state after that.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } catch {
      // Caller reports the failure; we only need to re-enable the buttons.
    } finally {
      if (alive.current) setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !pending) onClose(); }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4.5" />
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description !== undefined && (
              <DialogDescription render={typeof description === 'string' ? undefined : <div />}>
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="lg" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="lg"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending && <span className="size-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />}
            {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
