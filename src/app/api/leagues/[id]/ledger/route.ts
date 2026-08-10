// League ledger — the optional markdown income & expense sheet.
//
// Two audiences, deliberately different:
//   • Organizers (creator + co-organizers) read and write everything, including
//     unpublished drafts, via `requireLeagueManager`.
//   • League members (anyone with a player card here) read the ledger only once
//     it's published. Everyone else gets 403 — note this is gated on
//     *membership*, not `league.isPublic`, so a public league's accounts still
//     aren't world-readable.
//
// A league with no ledger row is the normal case, so "nothing here" is a 200
// with `exists: false` rather than a 404. That response is identical whether an
// unpublished draft exists or not, so members can't probe for drafts.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLeague, canManageLeague, isLeagueMember, getLedger, saveLedger, deleteLedger } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import type { LedgerResponse } from '@/lib/types';

/** Guard against someone pasting a novel into the editor; a ledger is a page, not a book. */
const MAX_CONTENT_LENGTH = 100_000;

const EMPTY: LedgerResponse = { exists: false, canManage: false, ledger: null };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league] = await Promise.all([auth(), getLeague(id)]);
    // Session before existence, matching `leagueAuth.resolve` — so a caller with
    // no session can't probe which league ids are real
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 });

    if (await canManageLeague(userId, league)) {
      const ledger = await getLedger(id);
      return NextResponse.json<LedgerResponse>({ exists: !!ledger, canManage: true, ledger });
    }

    if (!(await isLeagueMember(userId, league))) {
      return NextResponse.json(
        { error: 'Only this league\'s players and organizers can view its ledger' },
        { status: 403 }
      );
    }

    const ledger = await getLedger(id);
    if (!ledger?.published) return NextResponse.json<LedgerResponse>(EMPTY);
    return NextResponse.json<LedgerResponse>({ exists: true, canManage: false, ledger });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger' }, { status: 500 });
  }
}

/**
 * Create-or-replace the ledger. `content` and `published` are independently
 * optional, so the editor uses this one call to save a draft, publish, and
 * unpublish. Sending neither is a no-op save that only bumps `updatedBy`.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, userId } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const { content, published } = await request.json();

    if (content !== undefined && typeof content !== 'string') {
      return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
    }
    if (typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Ledger is too long (max ${MAX_CONTENT_LENGTH.toLocaleString('en-IN')} characters)` },
        { status: 400 }
      );
    }
    if (published !== undefined && typeof published !== 'boolean') {
      return NextResponse.json({ error: 'published must be a boolean' }, { status: 400 });
    }
    // A live-but-empty ledger would show members a blank page, so the rule is
    // on the *resulting* state rather than on the publish action: it catches
    // publishing a blank sheet and equally clearing the text of one that's
    // already published. Either field may be absent, so fall back to what's
    // stored for whichever wasn't sent.
    if (published !== false) {
      const existing = (content === undefined || published === undefined) ? await getLedger(id) : null;
      const nextContent   = content   !== undefined ? content   : existing?.content   ?? '';
      const nextPublished = published !== undefined ? published : existing?.published ?? false;
      if (nextPublished && !nextContent.trim()) {
        return NextResponse.json(
          { error: 'Add some content before publishing — unpublish it instead to hide it' },
          { status: 400 }
        );
      }
    }

    const ledger = await saveLedger(id, { content, published, updatedBy: userId });
    return NextResponse.json<LedgerResponse>({ exists: true, canManage: true, ledger });
  } catch (error) {
    console.error('Error saving ledger:', error);
    return NextResponse.json({ error: 'Failed to save ledger' }, { status: 500 });
  }
}

/** Remove the ledger entirely, putting the league back to having none. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    await deleteLedger(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ledger:', error);
    return NextResponse.json({ error: 'Failed to delete ledger' }, { status: 500 });
  }
}
