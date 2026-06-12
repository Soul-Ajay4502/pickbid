import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getProfile, setProfile, cleanupImages } from '@/lib/store';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const profile = await getProfile(session.user.id);
  return NextResponse.json(profile ?? null);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const data = await request.json();
  const previous = await getProfile(session.user.id);
  const profile = await setProfile(session.user.id, session.user.email ?? '', data);
  // Photo replaced → drop the old Cloudinary asset unless a player card still uses it
  if (previous?.photo && typeof data.photo === 'string' && data.photo !== previous.photo) {
    await cleanupImages([previous.photo]);
  }
  return NextResponse.json(profile);
}
