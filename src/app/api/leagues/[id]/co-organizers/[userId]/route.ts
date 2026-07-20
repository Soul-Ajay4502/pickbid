import { NextRequest, NextResponse } from 'next/server';
import { removeCoOrganizer } from '@/lib/store';
import { requireLeagueCreator } from '@/lib/leagueAuth';

// Creator-only. Access is revoked instantly: every management endpoint
// re-checks canManageLeague per request, so a removed co-organizer's next
// action 403s even if their auction page is still open.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const { error, status } = await requireLeagueCreator(id);
    if (error) return NextResponse.json({ error }, { status });

    const removed = await removeCoOrganizer(id, userId);
    if (!removed) {
      return NextResponse.json({ error: 'Co-organizer not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing co-organizer:', error);
    return NextResponse.json({ error: 'Failed to remove co-organizer' }, { status: 500 });
  }
}
