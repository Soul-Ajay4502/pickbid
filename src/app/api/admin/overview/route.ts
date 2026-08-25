import { NextResponse } from 'next/server';
import { getAdminOverview, getAdminLeagues, getAdminUsers } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * The whole dashboard in one payload — totals, growth, every league and every
 * user. One request keeps the client simple and means a single auth check
 * guards all of it.
 */
export async function GET() {
  try {
    const { error, status } = await requireAdmin();
    if (error) return NextResponse.json({ error }, { status });

    const [overview, leagues, users] = await Promise.all([
      getAdminOverview(),
      getAdminLeagues(),
      getAdminUsers(),
    ]);
    return NextResponse.json(
      { overview, leagues, users },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error building admin overview:', error);
    return NextResponse.json({ error: 'Failed to load admin data' }, { status: 500 });
  }
}
