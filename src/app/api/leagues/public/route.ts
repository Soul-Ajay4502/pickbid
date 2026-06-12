import { NextResponse } from 'next/server';
import { getPublicLeagues } from '@/lib/store';

export async function GET() {
  const leagues = await getPublicLeagues(50);
  return NextResponse.json(leagues);
}
