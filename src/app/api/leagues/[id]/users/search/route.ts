import { NextRequest, NextResponse } from 'next/server';
import { searchUsersForCoOrganizer } from '@/lib/store';
import { requireLeagueCreator } from '@/lib/leagueAuth';

// Creator-only: powers the "add co-organizer" picker. Matches existing Player Hunt
// accounts by name, email or phone; the creator and current co-organizers are
// already filtered out. Emails are returned so the creator can tell two people
// with the same name apart — which is also why this stays creator-only.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status, league } = await requireLeagueCreator(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json([]);

    const users = await searchUsersForCoOrganizer(league, q);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
