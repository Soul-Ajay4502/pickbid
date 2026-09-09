import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getProfile, setProfile, cleanupImages } from '@/lib/store';
import { parseIdProofType } from '@/lib/types';

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

  // Identity proof is optional, but a malformed one is a 400 rather than a
  // silently dropped field — a league that requires proof reads these two.
  const idProofType = parseIdProofType(data.idProofType);
  if (idProofType === undefined) {
    return NextResponse.json({ error: 'Invalid identity proof type' }, { status: 400 });
  }
  if (data.idProofUrl != null && (typeof data.idProofUrl !== 'string' || data.idProofUrl.length > 1000)) {
    return NextResponse.json({ error: 'Invalid identity proof URL' }, { status: 400 });
  }
  const idProofUrl = (typeof data.idProofUrl === 'string' && data.idProofUrl.trim()) || null;
  if (idProofUrl && !idProofType) {
    return NextResponse.json({ error: 'Choose which document this is' }, { status: 400 });
  }

  const previous = await getProfile(session.user.id);
  const profile = await setProfile(session.user.id, session.user.email ?? '', {
    ...data,
    idProofType: idProofUrl ? idProofType : null,
    idProofUrl,
  });
  // Photo replaced → drop the old Cloudinary asset unless a player card still uses it
  if (previous?.photo && typeof data.photo === 'string' && data.photo !== previous.photo) {
    await cleanupImages([previous.photo]);
  }
  // Same for a replaced or removed identity document — it has no other referent
  if (previous?.idProofUrl && previous.idProofUrl !== idProofUrl) {
    await cleanupImages([previous.idProofUrl]);
  }
  return NextResponse.json(profile);
}
