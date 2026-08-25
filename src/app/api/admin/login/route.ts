import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminConfigured, createAdminSession, verifyAdminCredentials } from '@/lib/adminAuth';

// The credential check must see the real request every time — never cached.
export const dynamic = 'force-dynamic';

/**
 * Throttle failed logins per client IP. This is a single-credential door, so a
 * slow-drip guess is the realistic attack; the window is deliberately short
 * because serverless instances are recycled often and this map dies with them.
 * It blunts a burst rather than pretending to be a durable rate limiter.
 */
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function isLockedOut(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export async function POST(request: NextRequest) {
  try {
    if (!adminConfigured()) {
      console.error('Admin login attempted but ADMIN_EMAIL / ADMIN_PASSWORD are not set');
      return NextResponse.json({ error: 'Admin access is not configured' }, { status: 503 });
    }

    const key = clientKey(request);
    if (isLockedOut(key)) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    const { email, password } = await request.json();
    if (!(await verifyAdminCredentials(email, password))) {
      recordFailure(key);
      // Deliberately vague: never reveal which half was wrong.
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    attempts.delete(key);
    const { token, maxAge } = await createAdminSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    });
    return response;
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
