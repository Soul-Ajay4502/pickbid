import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCertificatesForUser } from '@/lib/store';

/**
 * GET /api/profile/certificates — every participation certificate the signed-in
 * user can download, newest league first.
 *
 * Scoped to the session user by construction: the store matches on the `userId`
 * stamped on a player card, so there is no id in the URL to tamper with. A
 * league only shows up once its organizers have released certificates.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const certificates = await getCertificatesForUser(session.user.id);
    return NextResponse.json({ certificates });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 });
  }
}
