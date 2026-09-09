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

/** Indian-style rupee formatting, matching the auction UI (₹1,50,000). */
export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * The "player sold" announcement organizers paste into their league's
 * WhatsApp group. Keep this exact 3-line structure — it's the agreed format.
 */
export function buildPlayerSoldMessage(d: { playerName: string; soldPrice: number; teamName: string }): string {
  return `Player name: ${d.playerName}\nSold Price: ${formatINR(d.soldPrice)}\nSold To: ${d.teamName}`;
}

/**
 * WhatsApp click-to-chat link with no fixed recipient, so it opens the
 * share sheet / contact picker (WhatsApp app on mobile, WhatsApp Web on
 * desktop). encodeURIComponent handles apostrophes, emojis and newlines.
 */
export function whatsappShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// Organizers routinely bake serial numbers and phone numbers into the name they
// type — "111.Amal Kannan (6282148147)". These two helpers clean that up for
// display and for matching one person across leagues; the stored name is never
// rewritten.
const NAME_JUNK = /[^\p{L}\s'’-]+/gu;                    // digits, dots, brackets, …
const NAME_DANGLING = /(?<!\p{L})['’-]+|['’-]+(?!\p{L})/gu; // punctuation not joining two letters

/**
 * A player name with everything but letters stripped, keeping the hyphens and
 * apostrophes real names use (Jean-Pierre, D'Souza). Junk becomes a space so
 * the surrounding words don't run together. A name written entirely in digits
 * keeps its raw form rather than rendering blank.
 */
export function cleanPlayerName(name: string): string {
  const cleaned = name.replace(NAME_JUNK, ' ').replace(NAME_DANGLING, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || name;
}

/** Case- and punctuation-insensitive key for matching one person across leagues. */
export function playerNameKey(name: string): string {
  return cleanPlayerName(name).toLowerCase();
}

/**
 * Blank the fields on a player card that only a league's organizers may see:
 * the contact number and the entry-fee receipt. Every handler returning players
 * to someone who can't manage the league must run them through this — keeping
 * it in one place is what stops the next private field being remembered at
 * three of the four call sites.
 */
export function stripOrganizerFields<T extends { contactNumber?: string | null; paymentProofUrl?: string | null }>(
  player: T
): T {
  return { ...player, contactNumber: null, paymentProofUrl: null };
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
