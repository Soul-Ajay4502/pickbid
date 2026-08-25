import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from './adminCookie';

export { ADMIN_COOKIE };

/**
 * Super-admin authentication — deliberately separate from the Auth.js session
 * used by every normal user.
 *
 * The owner is not a row in `users`: there is no admin flag on the user table,
 * no migration and no seed. The single credential pair lives in env
 * (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and a successful login mints a signed,
 * HTTP-only cookie that is the *only* thing the admin APIs trust. Keeping this
 * off Auth.js means the Google-only sign-in flow is untouched, and a leaked
 * Google session can never escalate into admin access.
 *
 * Everything here is Web Crypto, so the module stays edge-safe and pulls no
 * Sequelize into whatever imports it.
 */



/** Admin sessions are short by design — the owner logs in for a sitting. */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function signingSecret(): string {
  // Auth.js v5 reads either name; .env.local uses NEXTAUTH_SECRET today.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET (or NEXTAUTH_SECRET) must be set to sign admin sessions');
  return secret;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(signingSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

/**
 * Constant-time string comparison. Both sides are hashed first so the compare
 * always runs over a fixed 32-byte digest — the loop can't leak the length of
 * the real password, only whether the digests match.
 */
async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const ba = new Uint8Array(da), bb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

/** True when the super-admin credentials are configured at all. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

/**
 * Check a submitted credential pair against env. Both comparisons always run
 * (no short-circuit on a wrong email) so a caller can't time-probe which half
 * they got right.
 */
export async function verifyAdminCredentials(email: unknown, password: unknown): Promise<boolean> {
  if (!adminConfigured()) return false;
  if (typeof email !== 'string' || typeof password !== 'string') return false;
  const [emailOk, passwordOk] = await Promise.all([
    constantTimeEquals(email.trim().toLowerCase(), process.env.ADMIN_EMAIL!.trim().toLowerCase()),
    constantTimeEquals(password, process.env.ADMIN_PASSWORD!),
  ]);
  return emailOk && passwordOk;
}

/** Mint a `<expiresAt>.<signature>` session token. */
export async function createAdminSession(): Promise<{ token: string; maxAge: number }> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  return { token: `${payload}.${await hmac(payload)}`, maxAge: SESSION_TTL_SECONDS };
}

async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const payload = token.slice(0, separator), signature = token.slice(separator + 1);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  try {
    return await constantTimeEquals(signature, await hmac(payload));
  } catch {
    return false;
  }
}

/** True when the current request carries a valid super-admin session. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return isValidToken(store.get(ADMIN_COOKIE)?.value);
}

/**
 * Gate for admin route handlers, mirroring `requireLeagueManager`'s shape.
 * Returns a 401 payload when the session is missing, expired or forged.
 */
export async function requireAdmin(): Promise<{ error: string | null; status: number }> {
  return (await isAdmin())
    ? { error: null, status: 200 }
    : { error: 'Unauthorised', status: 401 };
}
