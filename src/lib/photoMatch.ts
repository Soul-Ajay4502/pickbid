// Matching a folder of photo files to player cards by file name.
//
// Pure, so the bulk-photo dialog can show the pairing before a single byte is
// uploaded. Organizers collect photos however they can — a Google Forms upload
// folder ("Arun Kumar - IMG_2041.jpg"), WhatsApp downloads renamed by hand
// ("arun.jpeg"), a numbered list ("12. Arun Kumar 9876543210.png") — so a file
// is tried against the roster three ways, strongest signal first:
//
//   1. a ten-digit phone number in the name that is on exactly one card
//   2. the name itself, once extensions, numbers and punctuation are stripped
//   3. the words of the player's name all appearing in the file name (or the
//      other way round), when that singles out one player
//
// Anything that is still ambiguous is left unmatched for the organizer to pick
// by hand: a photo on the wrong card is worse than a photo not uploaded.

import { localPhoneDigits, playerNameKey } from './utils';

export interface PhotoCandidate {
  id: string;
  name: string;
  contactNumber?: string | null;
}

export type PhotoMatchReason = 'phone' | 'name' | 'partial';

export interface PhotoMatch {
  playerId: string;
  reason: PhotoMatchReason;
}

/** Camera and messenger filename noise that says nothing about who is in the picture. */
const NOISE = /\b(img|image|photo|pic|picture|dsc|whatsapp|screenshot|copy|final|edited|new|player|profile|passport|size)\b/gi;

/** "12. Arun_Kumar-IMG 2041.JPG" → "arun kumar". */
export function fileNameKey(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[a-z0-9]{2,5}$/i, '');
  return playerNameKey(base.replace(/[_.\-()]+/g, ' ').replace(NOISE, ' '));
}

const words = (key: string) => key.split(' ').filter((w) => w.length > 1);

/**
 * A key with the spacing and joining punctuation taken out, so "D'Souza Anil",
 * "d souza anil" and "DSouza-Anil" are the same name — people rarely type an
 * apostrophe into a file name.
 */
const compact = (key: string) => key.replace(/[\s'’-]+/g, '');

/**
 * Pairs each file name with at most one player, and each player with at most
 * one file — the first file to claim a player keeps them. Returns one entry
 * per file, in order, null where nothing matched confidently.
 */
export function matchPhotos(fileNames: string[], players: PhotoCandidate[]): (PhotoMatch | null)[] {
  const taken = new Set<string>();
  const byPhone = new Map<string, string[]>();
  for (const p of players) {
    const phone = localPhoneDigits(p.contactNumber);
    if (phone.length === 10) byPhone.set(phone, [...(byPhone.get(phone) ?? []), p.id]);
  }
  const keyed = players.map((p) => ({ id: p.id, key: playerNameKey(p.name) })).filter((p) => p.key);

  const claim = (playerId: string | undefined, reason: PhotoMatchReason): PhotoMatch | null => {
    if (!playerId || taken.has(playerId)) return null;
    taken.add(playerId);
    return { playerId, reason };
  };
  /** The one player satisfying `test`, or undefined when none or several do. */
  const only = (test: (key: string) => boolean): string | undefined => {
    const hits = keyed.filter((p) => !taken.has(p.id) && test(p.key));
    return hits.length === 1 ? hits[0].id : undefined;
  };

  // Exact matches for every file first, so a loose match on an early file
  // can't take the player a later file names exactly.
  const result: (PhotoMatch | null)[] = fileNames.map((fileName) => {
    for (const run of fileName.match(/\d{10,13}/g) ?? []) {
      const ids = byPhone.get(run.slice(-10));
      if (ids?.length === 1) { const m = claim(ids[0], 'phone'); if (m) return m; }
    }
    const key = compact(fileNameKey(fileName));
    return key ? claim(only((k) => compact(k) === key), 'name') : null;
  });

  return result.map((match, i) => {
    if (match) return match;
    const fileWords = words(fileNameKey(fileNames[i]));
    if (fileWords.length === 0) return null;
    return claim(
      only((k) => {
        const playerWords = words(k);
        if (playerWords.length === 0) return false;
        return playerWords.every((w) => fileWords.includes(w)) || fileWords.every((w) => playerWords.includes(w));
      }),
      'partial',
    );
  });
}
