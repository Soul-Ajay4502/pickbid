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

/**
 * The slice of a roster a given viewer may see when the league has
 * `rosterVisibleToPlayers` switched off.
 *
 * Two kinds of card survive. Icon players are announced signings — the
 * organizer put them on a team before the auction precisely so everyone knows
 * they're in it — so hiding them would defeat the point. And the viewer's own
 * cards, matched on `userId`: a player must always be able to find, open and
 * edit their own.
 *
 * Anonymous cards (no `userId`) can't be matched to a viewer here — a browser's
 * `creatorToken` never reaches a league-wide GET — so they're withheld like
 * anyone else's. Callers must only apply this to requesters who can't manage
 * the league; organizers and the platform owner always get the full roster.
 */
export function visibleRoster<T extends { isIcon?: boolean; userId?: string | null }>(
  players: T[],
  viewerUserId: string | null | undefined
): T[] {
  return players.filter((p) => p.isIcon || (!!viewerUserId && p.userId === viewerUserId));
}

/**
 * A Cloudinary delivery URL sized for where the image is actually rendered.
 *
 * `uploadToCloudinary` stores the original bytes untouched, so a 5MB photo
 * straight off a phone stays a 5MB photo: anything rendering `player.photo`
 * raw ships the whole upload to the browser, dozens of times over on a league
 * page. Rewriting the URL asks Cloudinary for a resized, re-encoded copy
 * instead — `f_auto,q_auto` alone typically takes a JPEG to a third of its
 * size by serving WebP or AVIF to browsers that accept them.
 *
 * `w`/`h` are the size the image is *rendered* at, in device pixels — pass the
 * CSS size multiplied by the pixel density you need to survive. `mode` mirrors
 * Cloudinary's crop: `fill` crops to the exact box (with `g_auto`, so the crop
 * lands on the subject rather than the centre of the frame), `fit` shrinks the
 * whole image inside it, `limit` is `fit` that never upscales.
 *
 * URLs that already carry a transformation are returned untouched, so this is
 * safe to call on a URL some other caller already sized, and a non-Cloudinary
 * URL (a Google avatar) passes straight through.
 */
export function cloudinaryImage(
  url: string,
  { w, h, mode = 'fill' }: { w: number; h?: number; mode?: 'fill' | 'fit' | 'limit' }
): string {
  if (!url || !url.includes('/upload/')) return url;
  // Matches every transformation this codebase produces, old and new.
  if (/\/upload\/(f_|q_|w_|h_|c_)/.test(url)) return url;
  const size = h ? `w_${w},h_${h}` : `w_${w}`;
  // Subject-aware cropping only means anything when pixels are being discarded.
  const gravity = mode === 'fill' ? ',g_auto' : '';
  return url.replace('/upload/', `/upload/f_auto,q_auto,${size},c_${mode}${gravity}/`);
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
 * The ceiling on every image upload, shared by the pickers and `/api/upload`.
 *
 * Cloudinary stores whatever arrives untouched and the whole file travels
 * through a serverless function body, so the limit is about the write path, not
 * about how the image is eventually served — `cloudinaryImage` already shrinks
 * delivery. 5MB clears a phone camera's own JPEG with room to spare while
 * keeping an unedited DSLR frame or a screenshot burst out of the pipe.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '5MB';

/**
 * Validate a picked file before it is previewed or uploaded.
 *
 * This is the fast, friendly copy of the check — the one that matters runs in
 * `/api/upload`, which anyone can post to directly.
 *
 * @returns a message to show the user, or null when the file is fine.
 */
export function checkImageFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Image must be under ${MAX_UPLOAD_LABEL} — this one is ${mb}MB.`;
  }
  return null;
}

/**
 * Upload a File to Cloudinary via the /api/upload route.
 * @param file    The image File to upload
 * @param folder  Cloudinary folder path (e.g. "premier_league/players")
 * @returns       The Cloudinary secure URL
 */
export async function uploadFile(file: File, folder: string): Promise<string> {
  // Backstop for a file that reached here without passing a picker's check.
  const tooBig = checkImageFile(file);
  if (tooBig) throw new Error(tooBig);

  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    // Callers toast `err.message`, so pass the handler's reason through.
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(error || 'Image upload failed');
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
