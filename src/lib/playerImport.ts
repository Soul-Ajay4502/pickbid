// Turning a registration spreadsheet into player cards.
//
// Pure and dependency-free: the import dialog uses it to guess which column is
// which and to preview every row, and the import endpoint uses the same
// `parseImportedPlayer` to refuse anything the preview wouldn't have produced.
// Sheets come from Google Forms, WhatsApp polls typed up by hand, last
// season's Excel — so every value is read forgivingly ("Left hand batsman",
// "RHB", "WK") and anything unreadable falls back to a default the organizer
// can see in the preview and fix on the card later.

import { PLAYER_ROLES, type Player, type PlayerRole } from './types';

/** Rows accepted in one import — a registration sheet, not a database dump. */
export const IMPORT_MAX_ROWS = 300;

export const BATTING_TYPES: Player['battingType'][] = ['Right-Hand Bat', 'Left-Hand Bat'];
export const BOWLING_TYPES: Player['bowlingType'][] = [
  'Right-Arm Fast', 'Right-Arm Medium', 'Right-Arm Off-Spin', 'Right-Arm Leg-Spin',
  'Left-Arm Fast', 'Left-Arm Medium', 'Left-Arm Spin', 'N/A',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The card fields a sheet column can be mapped onto. */
export const IMPORT_FIELDS = [
  { key: 'name', label: 'Player name', required: true },
  { key: 'contactNumber', label: 'Phone number', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'role', label: 'Role', required: false },
  { key: 'battingType', label: 'Batting style', required: false },
  { key: 'bowlingType', label: 'Bowling style', required: false },
  { key: 'isWicketKeeper', label: 'Wicket-keeper', required: false },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
/** Which sheet column feeds each field; null when the sheet has none. */
export type ImportMapping = Record<ImportField, number | null>;

/** One card as the import endpoint accepts it. */
export interface ImportedPlayer {
  name: string;
  contactNumber: string | null;
  email: string | null;
  role: PlayerRole;
  battingType: Player['battingType'];
  bowlingType: Player['bowlingType'];
  isWicketKeeper: boolean;
}

/** What a column header has to look like to be taken for each field. */
const HEADER_HINTS: { field: ImportField; test: RegExp; not?: RegExp }[] = [
  { field: 'email', test: /e-?mail/ },
  { field: 'contactNumber', test: /phone|mobile|contact|whats\s?app|cell/ },
  { field: 'isWicketKeeper', test: /keeper|\bwk\b/ },
  { field: 'bowlingType', test: /bowl/, not: /role|type of player|speciali/ },
  { field: 'battingType', test: /bat/, not: /role|type of player|speciali|bowl/ },
  { field: 'role', test: /role|speciali|player type|type of player|playing as|category/ },
  { field: 'name', test: /name/, not: /team|club|father|mother|guardian|user\s?name|league|tournament|upi|account|bank/ },
];

/** Best guess at the mapping from a sheet's header row. */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {
    name: null, contactNumber: null, email: null, role: null, battingType: null, bowlingType: null, isWicketKeeper: null,
  };
  const taken = new Set<number>();
  for (const { field, test, not } of HEADER_HINTS) {
    const idx = headers.findIndex((h, i) => {
      const text = h.toLowerCase();
      return !taken.has(i) && test.test(text) && !(not && not.test(text));
    });
    if (idx >= 0) { mapping[field] = idx; taken.add(idx); }
  }
  return mapping;
}

export function normalizeRole(value: string): PlayerRole | null {
  const v = value.toLowerCase();
  if (!v.trim()) return null;
  if (/keep|\bwk\b/.test(v)) return 'Wicket-Keeper Batter';
  if (/all/.test(v) || (/bat/.test(v) && /bowl/.test(v))) return 'All-Rounder';
  if (/bowl/.test(v)) return 'Bowler';
  if (/bat/.test(v)) return 'Batter';
  return null;
}

export function normalizeBatting(value: string): Player['battingType'] | null {
  const v = value.toLowerCase();
  if (/left|\blhb?\b/.test(v)) return 'Left-Hand Bat';
  if (/right|\brhb?\b/.test(v)) return 'Right-Hand Bat';
  return null;
}

export function normalizeBowling(value: string): Player['bowlingType'] | null {
  const v = value.toLowerCase().trim();
  if (!v) return null;
  if (/^(n\/?a|no|none|nil|-+|don'?t bowl|does not bowl|not applicable)$/.test(v)) return 'N/A';
  const left = /left|\bla\b|chinaman/.test(v);
  const kind = /fast|pace|quick|seam/.test(v) && !/med/.test(v) ? 'fast'
    : /med/.test(v) ? 'medium'
      : /off/.test(v) ? 'off'
        : /leg|wrist|chinaman/.test(v) ? 'leg'
          : /spin|slow|orthodox/.test(v) ? 'spin'
            : null;
  if (!kind) return null;
  if (left) return kind === 'fast' ? 'Left-Arm Fast' : kind === 'medium' ? 'Left-Arm Medium' : 'Left-Arm Spin';
  if (kind === 'fast') return 'Right-Arm Fast';
  if (kind === 'medium') return 'Right-Arm Medium';
  return kind === 'leg' ? 'Right-Arm Leg-Spin' : 'Right-Arm Off-Spin';
}

const isYes = (value: string) => /^(y|yes|true|1|wk|keeper|wicket[\s-]?keeper)$/i.test(value.trim());

/** A previewed sheet row: the card it would become, and why it can't if it can't. */
export interface ImportPreviewRow {
  /**
   * The row's position among the sheet's players, from 1. Not Excel's row
   * number: the reader drops blank rows, so that would drift after the first.
   */
  sheetRow: number;
  player: ImportedPlayer;
  /** Set when the row can't be imported at all. */
  problem: string | null;
  /** Values that were given but not understood, and so fell back to a default. */
  notes: string[];
}

/** Reads one sheet row through the mapping. */
export function previewRow(cells: string[], mapping: ImportMapping, sheetRow: number): ImportPreviewRow {
  const cell = (field: ImportField) => {
    const idx = mapping[field];
    return idx === null ? '' : (cells[idx] ?? '').trim();
  };
  const notes: string[] = [];
  const name = cell('name').replace(/\s+/g, ' ');
  const rawEmail = cell('email').toLowerCase();
  const email = EMAIL_RE.test(rawEmail) && rawEmail.length <= 200 ? rawEmail : null;
  if (rawEmail && !email) notes.push('email not valid — left out');

  const rawRole = cell('role');
  const rawBat = cell('battingType');
  const rawBowl = cell('bowlingType');
  const role = normalizeRole(rawRole);
  const battingType = normalizeBatting(rawBat);
  const bowlingType = normalizeBowling(rawBowl);
  if (rawRole && !role) notes.push(`role "${rawRole}" not recognised`);
  if (rawBat && !battingType) notes.push(`batting "${rawBat}" not recognised`);
  if (rawBowl && !bowlingType) notes.push(`bowling "${rawBowl}" not recognised`);

  const finalRole = role ?? 'All-Rounder';
  return {
    sheetRow,
    player: {
      name: name.slice(0, 80),
      contactNumber: cell('contactNumber').slice(0, 40) || null,
      email,
      role: finalRole,
      battingType: battingType ?? 'Right-Hand Bat',
      bowlingType: bowlingType ?? 'N/A',
      isWicketKeeper: finalRole === 'Wicket-Keeper Batter' || isYes(cell('isWicketKeeper')),
    },
    problem: !name ? 'No name' : name.length > 80 ? 'Name is longer than 80 characters' : null,
    notes,
  };
}

/** How two cards are judged to be the same person: same name, same phone digits. */
export function importDedupeKey(p: { name: string; contactNumber?: string | null }): string {
  return `${p.name.trim().toLowerCase().replace(/\s+/g, ' ')}|${(p.contactNumber ?? '').replace(/\D/g, '').slice(-10)}`;
}

/**
 * Rebuilds one imported card from a request body, field by field. Returns the
 * reason as a string when the row isn't acceptable — the endpoint refuses the
 * whole import rather than silently dropping rows the organizer ticked.
 */
export function parseImportedPlayer(value: unknown): ImportedPlayer | string {
  if (!value || typeof value !== 'object') return 'is not a player';
  const v = value as Record<string, unknown>;
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name || name.length > 80) return 'needs a name of 1–80 characters';
  if (!PLAYER_ROLES.includes(v.role as PlayerRole)) return 'has an invalid role';
  if (!BATTING_TYPES.includes(v.battingType as Player['battingType'])) return 'has an invalid batting style';
  if (!BOWLING_TYPES.includes(v.bowlingType as Player['bowlingType'])) return 'has an invalid bowling style';
  if (v.contactNumber != null && (typeof v.contactNumber !== 'string' || v.contactNumber.length > 40)) {
    return 'has an invalid phone number';
  }
  let email: string | null = null;
  if (v.email != null && v.email !== '') {
    if (typeof v.email !== 'string' || v.email.length > 200 || !EMAIL_RE.test(v.email.trim())) return 'has an invalid email';
    email = v.email.trim().toLowerCase();
  }
  return {
    name,
    contactNumber: (typeof v.contactNumber === 'string' && v.contactNumber.trim()) || null,
    email,
    role: v.role as PlayerRole,
    battingType: v.battingType as Player['battingType'],
    bowlingType: v.bowlingType as Player['bowlingType'],
    isWicketKeeper: Boolean(v.isWicketKeeper),
  };
}
