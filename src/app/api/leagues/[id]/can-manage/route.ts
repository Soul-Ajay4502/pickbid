import { NextRequest, NextResponse } from 'next/server';
import { getLeague, canManageLeague } from '@/lib/store';
import { isAdmin } from '@/lib/adminAuth';
import { auth } from '@/auth';

// Whether the caller may manage this league, and nothing else.
//
// It exists for the watch screen, which needs the flag only to decide whether
// to offer per-sale share actions. That one boolean used to cost a full
// `/api/leagues/[id]` read — ~100 KB of player cards — once per spectator.
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session, league, platformAdmin] = await Promise.all([auth(), getLeague(id), isAdmin()]);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    // Same three tiers as the league GET: creator, co-organizer, or the
    // platform owner, re-checked per request so a revoked co-organizer loses
    // the share actions immediately.
    const canManage = platformAdmin || (await canManageLeague(session?.user?.id, league));
    // Answers differ per caller — this one must never reach a shared cache.
    return NextResponse.json({ canManage }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error checking league management access:', error);
    return NextResponse.json({ error: 'Failed to check access' }, { status: 500 });
  }
}
