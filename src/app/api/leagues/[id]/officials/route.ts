import { NextRequest, NextResponse } from 'next/server';
import {
  getLeague, getOfficial,
  createOfficial, updateOfficial, deleteOfficial, cleanupImages,
} from '@/lib/store';
import { auth } from '@/auth';

// Officials are squad-poster metadata, never part of the auction. Only the
// league creator may add, edit or remove them.
async function requireCreator(leagueId: string) {
  const [session, league] = await Promise.all([auth(), getLeague(leagueId)]);
  if (!session?.user?.id) return { error: 'Unauthorised', status: 401 };
  if (!league) return { error: 'League not found', status: 404 };
  if (league.creatorId !== session.user.id) return { error: 'Forbidden', status: 403 };
  return { error: null, status: 200 };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireCreator(id);
  if (error) return NextResponse.json({ error }, { status });

  const { teamId, name, role, contactNumber, photo } = await request.json();
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const official = await createOfficial({
    leagueId: id,
    teamId,
    name: name.trim(),
    role: (typeof role === 'string' && role.trim()) || 'Official',
    contactNumber: (typeof contactNumber === 'string' && contactNumber.trim()) || null,
    photo: typeof photo === 'string' ? photo : '',
  });
  return NextResponse.json(official, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireCreator(id);
  if (error) return NextResponse.json({ error }, { status });

  const { officialId, name, role, contactNumber, photo } = await request.json();
  if (!officialId) return NextResponse.json({ error: 'officialId required' }, { status: 400 });

  const existing = await getOfficial(officialId);
  if (!existing || existing.leagueId !== id) {
    return NextResponse.json({ error: 'Official not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined)          patch.name = String(name).trim();
  if (role !== undefined)          patch.role = String(role).trim() || 'Official';
  if (contactNumber !== undefined) patch.contactNumber = (typeof contactNumber === 'string' && contactNumber.trim()) || null;
  if (photo !== undefined)         patch.photo = typeof photo === 'string' ? photo : '';

  const updated = await updateOfficial(officialId, patch);
  // A replaced/removed photo frees the old Cloudinary asset if nothing else uses it
  if (photo !== undefined && existing.photo && photo !== existing.photo) {
    await cleanupImages([existing.photo]);
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireCreator(id);
  if (error) return NextResponse.json({ error }, { status });

  const { officialId } = await request.json();
  if (!officialId) return NextResponse.json({ error: 'officialId required' }, { status: 400 });

  const existing = await getOfficial(officialId);
  if (!existing || existing.leagueId !== id) {
    return NextResponse.json({ error: 'Official not found' }, { status: 404 });
  }
  await deleteOfficial(officialId);
  await cleanupImages([existing.photo]);
  return NextResponse.json({ success: true });
}
