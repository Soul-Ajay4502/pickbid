import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export function getOrCreateToken(key: string): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const token = generateToken();
  localStorage.setItem(key, token);
  return token;
}

/**
 * Extract the 10-digit national part of a phone number, stripping any country
 * code / spaces / punctuation. Accepts values like "+91 9846027693",
 * "9846027693", "+919846027693" → "9846027693".
 */
export function localPhoneDigits(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.slice(-10);
}

/** Format a 10-digit national number with the fixed +91 prefix, or '' if empty. */
export function formatIndianPhone(local: string): string {
  const digits = local.replace(/\D/g, '');
  return digits ? `+91 ${digits}` : '';
}

/**
 * Copy text to the clipboard across browsers and platforms.
 *
 * Prefers the async Clipboard API (HTTPS / localhost), and falls back to a
 * hidden <textarea> + execCommand for non-secure contexts — e.g. a phone
 * hitting the dev server over a LAN IP, where navigator.clipboard is undefined.
 * Returns whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Convert a league name to a safe Cloudinary folder segment */
export function sanitizeFolder(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'league'
  );
}

/**
 * Upload a File to Cloudinary via the /api/upload route.
 * @param file    The image File to upload
 * @param folder  Cloudinary folder path (e.g. "premier_league/players")
 * @returns       The Cloudinary secure URL
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Image upload failed');
  const { url } = (await res.json()) as { url: string };
  return url;
}
