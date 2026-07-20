import { NextRequest, NextResponse } from 'next/server';
import {
  getSponsors, getSponsor,
  createSponsor, updateSponsor, deleteSponsor, cleanupImages,
} from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sponsors = await getSponsors(id);
  return NextResponse.json(sponsors);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const { name, logoUrl, website } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const sponsor = await createSponsor({
    leagueId: id,
    name:     name.trim(),
    logoUrl:  typeof logoUrl === 'string' ? logoUrl : '',
    website:  (typeof website === 'string' && website.trim()) || null,
  });
  return NextResponse.json(sponsor, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const { sponsorId, name, logoUrl, website } = await request.json();
  if (!sponsorId) return NextResponse.json({ error: 'sponsorId required' }, { status: 400 });

  const existing = await getSponsor(sponsorId);
  if (!existing || existing.leagueId !== id) {
    return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined)    patch.name = String(name).trim();
  if (logoUrl !== undefined) patch.logoUrl = typeof logoUrl === 'string' ? logoUrl : '';
  if (website !== undefined) patch.website = (typeof website === 'string' && website.trim()) || null;

  const updated = await updateSponsor(sponsorId, patch);
  // A replaced/removed logo frees the old Cloudinary asset if nothing else uses it
  if (logoUrl !== undefined && existing.logoUrl && logoUrl !== existing.logoUrl) {
    await cleanupImages([existing.logoUrl]);
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, status } = await requireLeagueManager(id);
  if (error) return NextResponse.json({ error }, { status });

  const { sponsorId } = await request.json();
  if (!sponsorId) return NextResponse.json({ error: 'sponsorId required' }, { status: 400 });

  const existing = await getSponsor(sponsorId);
  if (!existing || existing.leagueId !== id) {
    return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });
  }
  await deleteSponsor(sponsorId);
  await cleanupImages([existing.logoUrl]);
  return NextResponse.json({ success: true });
}
