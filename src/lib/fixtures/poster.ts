import { isIsoDate } from './schedule';

/**
 * The downloadable fixture poster: templates, sizes, the request shape, and how
 * matches are laid out across pages. Pure, so the browser can show the page
 * count and the server can render page N from the very same arithmetic. The
 * rendering itself is server-side (`app/api/fixtures/poster`), like the
 * Auction Wrapped poster, so the PNG is identical on every device.
 */

export type PosterTemplateId =
  | 'floodlight' | 'royal' | 'ivory' | 'electric' | 'crimson'
  | 'midnight' | 'platinum' | 'heritage' | 'cleansheet' | 'monsoon' | 'sunset' | 'pitch' | 'jersey';

export type PosterMood = 'dark' | 'light' | 'vibrant';
export type PosterFormat = 'portrait' | 'story' | 'square';

export const POSTER_FORMATS: Record<PosterFormat, { label: string; hint: string; width: number; height: number }> = {
  portrait: { label: 'Portrait', hint: '4:5 · feeds & WhatsApp', width: 1080, height: 1350 },
  story: { label: 'Story', hint: '9:16 · status & stories', width: 1080, height: 1920 },
  square: { label: 'Square', hint: '1:1 · anywhere', width: 1080, height: 1080 },
};

export interface PosterFont {
  /** A Google Fonts family, fetched as TrueType at render time. */
  family: string;
  weight: 400 | 500 | 600 | 700 | 800 | 900;
  /**
   * Average glyph width as a fraction of the font size, in the case the title
   * is set in — how the renderer picks the largest title that fits. Measure it
   * on a real all-caps title rather than guessing: too low and a long title
   * wraps past its two lines and gets cut off. 0.5 and under counts as a
   * condensed face, which also gets bigger round labels.
   */
  charWidth: number;
}

export interface PosterTemplate {
  id: PosterTemplateId;
  name: string;
  tagline: string;
  /** For the picker's filter. */
  mood: PosterMood;
  dark: boolean;
  /** Canvas background (a CSS gradient). */
  background: string;
  /** Glow layers painted over it — satori has no blur, so radial falloffs stand in. */
  glows: string[];
  text: string;
  muted: string;
  accent: string;
  /** Second accent, for gradients and highlights. */
  accent2: string;
  /** Chip and badge fill. */
  chip: string;
  row: string;
  rowBorder: string;
  vsBg: string;
  vsText: string;
  /** The PICKBID watermark's colour, alpha included. */
  watermark: string;
  display: PosterFont;
  /** Display titles in capitals — right for condensed faces, wrong for serifs. */
  upperTitle: boolean;
  /** Three colours for the picker's swatch. */
  swatch: [string, string, string];
}

const INTER = 'Inter';

export const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: 'floodlight',
    name: 'Floodlight',
    tagline: 'Night match under the lights',
    mood: 'dark',
    dark: true,
    background: 'linear-gradient(165deg, #0b1220 0%, #060a12 55%, #03130c 100%)',
    glows: [
      'radial-gradient(circle at 8% 0%, rgba(167,243,208,0.20), transparent 38%)',
      'radial-gradient(circle at 92% 0%, rgba(167,243,208,0.16), transparent 36%)',
      'radial-gradient(ellipse at 50% 112%, rgba(34,197,94,0.28), transparent 46%)',
    ],
    text: '#f8fafc',
    muted: 'rgba(226,232,240,0.62)',
    accent: '#22c55e',
    accent2: '#a3e635',
    chip: 'rgba(34,197,94,0.14)',
    row: 'rgba(255,255,255,0.05)',
    rowBorder: 'rgba(255,255,255,0.09)',
    vsBg: 'linear-gradient(135deg, #22c55e, #059669)',
    vsText: '#04130b',
    watermark: 'rgba(255,255,255,0.045)',
    display: { family: 'Bebas Neue', weight: 400, charWidth: 0.42 },
    upperTitle: true,
    swatch: ['#0b1220', '#22c55e', '#a3e635'],
  },
  {
    id: 'royal',
    name: 'Royal Gold',
    tagline: 'Black tie, gold leaf',
    mood: 'dark',
    dark: true,
    background: 'linear-gradient(160deg, #15110a 0%, #0a0907 50%, #000000 100%)',
    glows: [
      'radial-gradient(circle at 50% -8%, rgba(245,215,122,0.22), transparent 44%)',
      'radial-gradient(circle at 100% 100%, rgba(212,175,55,0.12), transparent 40%)',
    ],
    text: '#fdf8ec',
    muted: 'rgba(240,226,190,0.62)',
    accent: '#d4af37',
    accent2: '#f5d77a',
    chip: 'rgba(212,175,55,0.14)',
    row: 'rgba(212,175,55,0.06)',
    rowBorder: 'rgba(212,175,55,0.22)',
    vsBg: 'linear-gradient(135deg, #f5d77a, #b8860b)',
    vsText: '#1a1405',
    watermark: 'rgba(245,215,122,0.05)',
    display: { family: 'Playfair Display', weight: 900, charWidth: 0.56 },
    upperTitle: false,
    swatch: ['#0a0907', '#d4af37', '#f5d77a'],
  },
  {
    id: 'ivory',
    name: 'Ivory Scorecard',
    tagline: 'Clubhouse classic, prints well',
    mood: 'light',
    dark: false,
    background: 'linear-gradient(170deg, #fbf7ee 0%, #f3ead6 100%)',
    glows: [
      'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.55), transparent 35%)',
      'radial-gradient(circle at 100% 100%, rgba(15,61,46,0.08), transparent 45%)',
    ],
    text: '#10241c',
    muted: 'rgba(16,36,28,0.6)',
    accent: '#0f3d2e',
    accent2: '#8b1e3f',
    chip: 'rgba(15,61,46,0.08)',
    row: 'rgba(255,255,255,0.78)',
    rowBorder: 'rgba(15,61,46,0.16)',
    vsBg: 'linear-gradient(135deg, #8b1e3f, #5c1129)',
    vsText: '#fbf7ee',
    watermark: 'rgba(15,61,46,0.055)',
    display: { family: 'DM Serif Display', weight: 400, charWidth: 0.55 },
    upperTitle: false,
    swatch: ['#f3ead6', '#0f3d2e', '#8b1e3f'],
  },
  {
    id: 'electric',
    name: 'Electric',
    tagline: 'Bold, bright, made for stories',
    mood: 'vibrant',
    dark: true,
    background: 'linear-gradient(140deg, #2e1065 0%, #3730a3 48%, #0e7490 100%)',
    glows: [
      'radial-gradient(circle at 10% 10%, rgba(240,171,252,0.35), transparent 40%)',
      'radial-gradient(circle at 95% 85%, rgba(103,232,249,0.32), transparent 42%)',
    ],
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.72)',
    accent: '#f0abfc',
    accent2: '#67e8f9',
    chip: 'rgba(255,255,255,0.14)',
    row: 'rgba(255,255,255,0.12)',
    rowBorder: 'rgba(255,255,255,0.22)',
    vsBg: 'linear-gradient(135deg, #f0abfc, #67e8f9)',
    vsText: '#1e1b4b',
    watermark: 'rgba(255,255,255,0.06)',
    display: { family: 'Outfit', weight: 800, charWidth: 0.58 },
    upperTitle: false,
    swatch: ['#3730a3', '#f0abfc', '#67e8f9'],
  },
  {
    id: 'crimson',
    name: 'Crimson Strike',
    tagline: 'Big-league broadcast energy',
    mood: 'dark',
    dark: true,
    background: 'linear-gradient(155deg, #2a0609 0%, #12030a 55%, #050102 100%)',
    glows: [
      'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.34), transparent 42%)',
      'radial-gradient(circle at 0% 100%, rgba(251,191,36,0.14), transparent 40%)',
    ],
    text: '#fff7ed',
    muted: 'rgba(254,226,226,0.62)',
    accent: '#ef4444',
    accent2: '#fbbf24',
    chip: 'rgba(239,68,68,0.16)',
    row: 'rgba(255,255,255,0.05)',
    rowBorder: 'rgba(239,68,68,0.24)',
    vsBg: 'linear-gradient(135deg, #fbbf24, #ef4444)',
    vsText: '#1c0406',
    watermark: 'rgba(255,255,255,0.045)',
    display: { family: 'Bebas Neue', weight: 400, charWidth: 0.42 },
    upperTitle: true,
    swatch: ['#2a0609', '#ef4444', '#fbbf24'],
  },
  {
    id: 'midnight',
    name: 'Midnight Neon',
    tagline: 'Synthwave under the lights',
    mood: 'dark',
    dark: true,
    background: 'linear-gradient(180deg, #05010f 0%, #0b0420 58%, #1d0638 100%)',
    glows: [
      'radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.32), transparent 52%)',
      'radial-gradient(circle at 0% 0%, rgba(34,211,238,0.20), transparent 40%)',
    ],
    text: '#f5f3ff',
    muted: 'rgba(221,214,254,0.66)',
    accent: '#22d3ee',
    accent2: '#f472b6',
    chip: 'rgba(34,211,238,0.12)',
    row: 'rgba(12,6,34,0.72)',
    rowBorder: 'rgba(34,211,238,0.32)',
    vsBg: 'linear-gradient(135deg, #22d3ee, #f472b6)',
    vsText: '#05010f',
    watermark: 'rgba(244,114,182,0.065)',
    display: { family: 'Orbitron', weight: 800, charWidth: 0.8 },
    upperTitle: true,
    swatch: ['#0b0420', '#22d3ee', '#f472b6'],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    tagline: 'Brushed steel, understated',
    mood: 'dark',
    dark: true,
    background: 'linear-gradient(150deg, #2e2e33 0%, #18181b 45%, #09090b 100%)',
    glows: ['radial-gradient(circle at 82% 0%, rgba(228,228,231,0.17), transparent 42%)'],
    text: '#fafafa',
    muted: 'rgba(228,228,231,0.6)',
    accent: '#e4e4e7',
    accent2: '#a1a1aa',
    chip: 'rgba(228,228,231,0.08)',
    row: 'rgba(255,255,255,0.045)',
    rowBorder: 'rgba(228,228,231,0.16)',
    vsBg: 'linear-gradient(135deg, #fafafa, #a1a1aa)',
    vsText: '#18181b',
    watermark: 'rgba(255,255,255,0.04)',
    display: { family: 'Montserrat', weight: 800, charWidth: 0.72 },
    upperTitle: true,
    swatch: ['#18181b', '#e4e4e7', '#a1a1aa'],
  },
  {
    id: 'heritage',
    name: 'Test Whites',
    tagline: 'Red ball, whites, five days',
    mood: 'light',
    dark: false,
    background: 'linear-gradient(175deg, #ffffff 0%, #f1f5f9 100%)',
    glows: ['radial-gradient(circle at 100% 0%, rgba(185,28,28,0.07), transparent 40%)'],
    text: '#0f172a',
    muted: 'rgba(15,23,42,0.58)',
    accent: '#b91c1c',
    accent2: '#1e3a8a',
    chip: 'rgba(185,28,28,0.07)',
    row: '#ffffff',
    rowBorder: 'rgba(15,23,42,0.13)',
    vsBg: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
    vsText: '#ffffff',
    watermark: 'rgba(15,23,42,0.045)',
    display: { family: 'Cinzel', weight: 700, charWidth: 0.74 },
    upperTitle: true,
    swatch: ['#f1f5f9', '#1e3a8a', '#b91c1c'],
  },
  {
    id: 'cleansheet',
    name: 'Clean Sheet',
    tagline: 'Swiss minimal, prints anywhere',
    mood: 'light',
    dark: false,
    background: 'linear-gradient(180deg, #ffffff 0%, #f6f6f6 100%)',
    glows: [],
    text: '#0a0a0a',
    muted: 'rgba(10,10,10,0.55)',
    accent: '#0a0a0a',
    accent2: '#ef4444',
    chip: 'rgba(10,10,10,0.05)',
    row: '#ffffff',
    rowBorder: 'rgba(10,10,10,0.14)',
    vsBg: 'linear-gradient(135deg, #0a0a0a, #2a2a2a)',
    vsText: '#ffffff',
    watermark: 'rgba(10,10,10,0.04)',
    display: { family: 'Archivo Black', weight: 400, charWidth: 0.64 },
    upperTitle: false,
    swatch: ['#ffffff', '#0a0a0a', '#ef4444'],
  },
  {
    id: 'monsoon',
    name: 'Monsoon',
    tagline: 'Coastal teal and sea spray',
    mood: 'vibrant',
    dark: true,
    background: 'linear-gradient(160deg, #042f2e 0%, #0f766e 55%, #0e7490 100%)',
    glows: [
      'radial-gradient(circle at 15% 0%, rgba(153,246,228,0.30), transparent 40%)',
      'radial-gradient(circle at 100% 100%, rgba(253,230,138,0.18), transparent 42%)',
    ],
    text: '#f0fdfa',
    muted: 'rgba(204,251,241,0.72)',
    accent: '#5eead4',
    accent2: '#fde68a',
    chip: 'rgba(94,234,212,0.14)',
    row: 'rgba(4,47,46,0.38)',
    rowBorder: 'rgba(153,246,228,0.24)',
    vsBg: 'linear-gradient(135deg, #fde68a, #5eead4)',
    vsText: '#042f2e',
    watermark: 'rgba(255,255,255,0.055)',
    display: { family: 'Sora', weight: 800, charWidth: 0.62 },
    upperTitle: false,
    swatch: ['#0f766e', '#5eead4', '#fde68a'],
  },
  {
    id: 'sunset',
    name: 'Sunset Fest',
    tagline: 'Golden-hour carnival',
    mood: 'vibrant',
    dark: true,
    background: 'linear-gradient(170deg, #3b0764 0%, #9d174d 48%, #ea580c 100%)',
    glows: [
      'radial-gradient(circle at 88% 6%, rgba(253,224,71,0.42), transparent 34%)',
      'radial-gradient(ellipse at 50% 108%, rgba(253,186,116,0.35), transparent 45%)',
    ],
    text: '#fff7ed',
    muted: 'rgba(255,237,213,0.78)',
    accent: '#fde047',
    accent2: '#fb923c',
    chip: 'rgba(253,224,71,0.16)',
    row: 'rgba(40,4,40,0.32)',
    rowBorder: 'rgba(253,224,71,0.26)',
    vsBg: 'linear-gradient(135deg, #fde047, #fb923c)',
    vsText: '#3b0764',
    watermark: 'rgba(255,255,255,0.06)',
    display: { family: 'Righteous', weight: 400, charWidth: 0.58 },
    upperTitle: false,
    swatch: ['#9d174d', '#fde047', '#fb923c'],
  },
  {
    id: 'pitch',
    name: 'Emerald Pitch',
    tagline: 'Fresh-cut outfield stripes',
    mood: 'vibrant',
    dark: true,
    background: 'linear-gradient(180deg, #14532d 0%, #166534 50%, #15803d 100%)',
    glows: ['radial-gradient(circle at 50% -12%, rgba(255,255,255,0.2), transparent 46%)'],
    text: '#ffffff',
    muted: 'rgba(220,252,231,0.78)',
    accent: '#fef08a',
    accent2: '#ffffff',
    chip: 'rgba(0,0,0,0.18)',
    row: 'rgba(5,46,22,0.5)',
    rowBorder: 'rgba(255,255,255,0.18)',
    vsBg: 'linear-gradient(135deg, #fef08a, #facc15)',
    vsText: '#14532d',
    watermark: 'rgba(255,255,255,0.06)',
    display: { family: 'Oswald', weight: 700, charWidth: 0.57 },
    upperTitle: true,
    swatch: ['#166534', '#fef08a', '#ffffff'],
  },
  {
    id: 'jersey',
    name: 'Jersey Blue',
    tagline: 'Bleed blue with saffron trim',
    mood: 'vibrant',
    dark: true,
    background: 'linear-gradient(160deg, #0b1f5c 0%, #1d4ed8 55%, #0b1f5c 100%)',
    glows: ['radial-gradient(circle at 100% 0%, rgba(251,146,60,0.26), transparent 40%)'],
    text: '#ffffff',
    muted: 'rgba(219,234,254,0.76)',
    accent: '#fb923c',
    accent2: '#fde68a',
    chip: 'rgba(251,146,60,0.16)',
    row: 'rgba(11,31,92,0.5)',
    rowBorder: 'rgba(147,197,253,0.26)',
    vsBg: 'linear-gradient(135deg, #fb923c, #f97316)',
    vsText: '#0b1f5c',
    watermark: 'rgba(255,255,255,0.055)',
    display: { family: 'Teko', weight: 600, charWidth: 0.5 },
    upperTitle: true,
    swatch: ['#1d4ed8', '#fb923c', '#fde68a'],
  },
];

export const POSTER_MOODS: { id: PosterMood | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'vibrant', label: 'Vibrant' },
];

export const BODY_FONT = INTER;

export function getPosterTemplate(id: string): PosterTemplate {
  return POSTER_TEMPLATES.find((t) => t.id === id) ?? POSTER_TEMPLATES[0];
}

export interface PosterTeam {
  name: string;
  /** `#rrggbb`; the template's accent stands in when absent. */
  color?: string | null;
}

/** A match by team index, in play order. */
export interface PosterMatch {
  a: number;
  b: number;
  round: number;
  date?: string | null;
}

export interface FixturePosterInput {
  template: PosterTemplateId;
  format: PosterFormat;
  title: string;
  subtitle: string;
  teams: PosterTeam[];
  matches: PosterMatch[];
  /** 1-based. */
  page: number;
}

export const POSTER_LIMITS = { title: 60, subtitle: 90, teamName: 40, teams: 64, matches: 500 };

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Validates a poster request from the browser; the endpoint is anonymous, so everything is capped. */
export function parsePosterInput(raw: unknown): { ok: true; input: FixturePosterInput } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, message: 'Poster details are missing.' };
  const r = raw as Record<string, unknown>;
  if (!POSTER_TEMPLATES.some((t) => t.id === r.template)) return { ok: false, message: 'Choose a template.' };
  if (typeof r.format !== 'string' || !(r.format in POSTER_FORMATS)) return { ok: false, message: 'Choose a size.' };

  if (!Array.isArray(r.teams) || r.teams.length < 2 || r.teams.length > POSTER_LIMITS.teams) {
    return { ok: false, message: `A poster needs between 2 and ${POSTER_LIMITS.teams} teams.` };
  }
  const teams: PosterTeam[] = [];
  for (const t of r.teams as unknown[]) {
    const name = clean((t as Record<string, unknown>)?.name, POSTER_LIMITS.teamName);
    if (!name) return { ok: false, message: 'Every team needs a name.' };
    const color = (t as Record<string, unknown>)?.color;
    teams.push({ name, color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null });
  }

  if (!Array.isArray(r.matches) || r.matches.length === 0 || r.matches.length > POSTER_LIMITS.matches) {
    return { ok: false, message: `A poster needs between 1 and ${POSTER_LIMITS.matches} matches.` };
  }
  const matches: PosterMatch[] = [];
  for (const m of r.matches as unknown[]) {
    const x = m as Record<string, unknown>;
    const ok = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < teams.length;
    if (!x || !ok(x.a) || !ok(x.b) || x.a === x.b) return { ok: false, message: 'A match refers to a team that isn\'t listed.' };
    if (typeof x.round !== 'number' || !Number.isInteger(x.round) || x.round < 1 || x.round > POSTER_LIMITS.matches) {
      return { ok: false, message: 'A match has an invalid round.' };
    }
    if (x.date != null && !isIsoDate(x.date)) return { ok: false, message: 'A match has an invalid date.' };
    matches.push({ a: x.a as number, b: x.b as number, round: x.round, date: (x.date as string | null | undefined) ?? null });
  }

  const page = typeof r.page === 'number' && Number.isInteger(r.page) && r.page >= 1 ? r.page : 1;
  return {
    ok: true,
    input: {
      template: r.template as PosterTemplateId,
      format: r.format as PosterFormat,
      title: clean(r.title, POSTER_LIMITS.title) || 'Fixtures',
      subtitle: clean(r.subtitle, POSTER_LIMITS.subtitle),
      teams,
      matches,
      page,
    },
  };
}

/**
 * Fixed vertical rhythm, in pixels. The renderer draws every round header and
 * match row at exactly these heights, which is what lets pagination be done
 * here, without rendering, and agree with the image.
 */
export const POSTER_LAYOUT = {
  padX: 72,
  top: 64,
  header: 300,
  footer: 118,
  roundHeader: 56,
  row: 66,
  columnGap: 32,
};

export interface PosterBlock {
  round: number;
  date: string | null;
  /** True when this block carries on a round begun in an earlier column. */
  continued: boolean;
  matches: { match: PosterMatch; number: number }[];
}

export interface PosterPage {
  columns: PosterBlock[][];
  /**
   * Whether the fixture is laid out two columns to a page. True for every page
   * once it doesn't fit one column — a last page with a single column included,
   * so its width matches the pages before it.
   */
  twoColumn: boolean;
}

export function posterContentHeight(format: PosterFormat): number {
  const { top, header, footer } = POSTER_LAYOUT;
  return POSTER_FORMATS[format].height - top - header - footer;
}

/**
 * Lays rounds out down the page: in one column if they all fit, otherwise in
 * two columns per page across as many pages as it takes. A round that fits a
 * fresh column is never split; only a round taller than a whole column breaks
 * across, with its header repeated as "continued".
 */
export function paginatePoster(matches: readonly PosterMatch[], format: PosterFormat): PosterPage[] {
  const { roundHeader, row } = POSTER_LAYOUT;
  const capacity = posterContentHeight(format);
  const height = (n: number) => roundHeader + n * row;

  const blocks: PosterBlock[] = [];
  matches.forEach((match, i) => {
    const last = blocks[blocks.length - 1];
    if (last && last.round === match.round) last.matches.push({ match, number: i + 1 });
    else blocks.push({ round: match.round, date: match.date ?? null, continued: false, matches: [{ match, number: i + 1 }] });
  });

  if (blocks.reduce((sum, b) => sum + height(b.matches.length), 0) <= capacity) return [{ columns: [blocks], twoColumn: false }];

  const pages: PosterPage[] = [];
  let columns: PosterBlock[][] = [];
  let column: PosterBlock[] = [];
  let used = 0;
  const closeColumn = () => {
    columns.push(column);
    column = [];
    used = 0;
    if (columns.length === 2) {
      pages.push({ columns, twoColumn: true });
      columns = [];
    }
  };

  for (const block of blocks) {
    let rest = block.matches;
    let continued = false;
    while (rest.length) {
      const free = capacity - used;
      // Whole round fits a fresh column but not this one: move on rather than split it.
      if (height(rest.length) > free && height(rest.length) <= capacity && used > 0) {
        closeColumn();
        continue;
      }
      const room = Math.floor((free - roundHeader) / row);
      if (room < 1) {
        closeColumn();
        continue;
      }
      const take = rest.slice(0, room);
      column.push({ ...block, continued, matches: take });
      used += height(take.length);
      rest = rest.slice(take.length);
      continued = true;
      if (rest.length) closeColumn();
    }
  }
  if (column.length) closeColumn();
  if (columns.length) pages.push({ columns, twoColumn: true });
  return pages;
}
