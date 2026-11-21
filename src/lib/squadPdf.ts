'use client';

import type { Player, Team, TeamOfficial } from '@/lib/types';
import { cloudinaryImage } from '@/lib/utils';
import { fitPdfText } from '@/lib/pdfText';

interface LeagueInfo {
  name: string;
  conductedBy: string;
}

/* jsPDF's built-in Helvetica has no ₹ glyph — use "Rs" in PDFs */
function fmtRs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [34, 197, 94];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function batShort(t: Player['battingType']): string {
  return t === 'Right-Hand Bat' ? 'RHB' : 'LHB';
}

function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      cleanup();
      img.onload = img.onerror = null;
      img.src = '';
      reject(signal?.reason);
    };
    img.crossOrigin = 'anonymous';
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = error => { cleanup(); reject(error); };
    signal?.addEventListener('abort', abort, { once: true });
    img.src = url;
  });
}

/* ────────────────────────────────────────────────────────────────────
 * Team-wise roster — one flowing document, a section per team
 * ──────────────────────────────────────────────────────────────────── */
export async function downloadTeamwiseRoster(league: LeagueInfo, teams: Team[], players: Player[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  let y = 0;

  const accent: [number, number, number] = [34, 197, 94];

  // Document header
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(league.name, margin, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Team-wise Roster', margin, 22);
  doc.text(
    `Conducted by ${league.conductedBy} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin, 28
  );
  y = 44;

  function ensureSpace(h: number) {
    if (y + h > pageH - 16) {
      doc.addPage();
      y = margin;
    }
  }

  function drawTableHeader() {
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('#', margin + 2, y);
    doc.text('NAME', margin + 10, y);
    doc.text('ROLE', margin + 78, y);
    doc.text('BAT', margin + 116, y);
    doc.text('BOWLING', margin + 130, y);
    doc.text('PRICE', pageW - margin - 2, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 5.5;
  }

  function drawPlayerRow(p: Player, idx: number, rgb: [number, number, number]) {
    ensureSpace(9);
    doc.setTextColor(170, 170, 170);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(idx + 1), margin + 2, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(p.name, margin + 10, y);
    if (p.isWicketKeeper) {
      const nameW = doc.getTextWidth(p.name);
      doc.setTextColor(...rgb);
      doc.setFontSize(6.5);
      doc.text('WK', margin + 12 + nameW, y);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(p.role, margin + 78, y);
    doc.text(batShort(p.battingType), margin + 116, y);
    doc.text(p.bowlingType === 'N/A' ? '—' : p.bowlingType, margin + 130, y);
    if (p.isIcon) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(217, 119, 6);
      doc.text('ICON', pageW - margin - 2, y, { align: 'right' });
    } else if (p.soldPrice) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...rgb);
      doc.text(fmtRs(p.soldPrice), pageW - margin - 2, y, { align: 'right' });
    }
    y += 4;
    doc.setDrawColor(242, 242, 242);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  function drawSection(title: string, rgb: [number, number, number], squad: Player[], subtitle: string) {
    ensureSpace(28);
    // Section header strip
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(margin, y - 4.5, 2.4, 9, 1.2, 1.2, 'F');
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text(title, margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, pageW - margin - 2, y, { align: 'right' });
    y += 7.5;
    drawTableHeader();
    squad.forEach((p, i) => drawPlayerRow(p, i, rgb));
    y += 6;
  }

  teams.forEach((team) => {
    const squad = players.filter((p) => p.teamId === team.id);
    const spent = squad.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const rgb = hexToRgb(team.colorHex);
    if (squad.length === 0) {
      ensureSpace(16);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.roundedRect(margin, y - 4.5, 2.4, 9, 1.2, 1.2, 'F');
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(team.name, margin + 6, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('No players yet', pageW - margin - 2, y, { align: 'right' });
      y += 12;
      return;
    }
    drawSection(
      team.name, rgb, squad,
      `${squad.length} player${squad.length !== 1 ? 's' : ''} · ${fmtRs(spent)} spent · ${fmtRs(Math.max(0, team.budget - spent))} left`
    );
  });

  const unassigned = players.filter((p) => !p.teamId && !p.isUnsold);
  const unsold = players.filter((p) => !p.teamId && p.isUnsold);
  if (unassigned.length > 0) {
    drawSection('Not Yet Auctioned', [120, 120, 130], unassigned, `${unassigned.length} player${unassigned.length !== 1 ? 's' : ''}`);
  }
  if (unsold.length > 0) {
    drawSection('Unsold', [217, 119, 6], unsold, `${unsold.length} player${unsold.length !== 1 ? 's' : ''}`);
  }

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  doc.save(`${safeFileName(league.name)}_teamwise_roster.pdf`);
}

/* ────────────────────────────────────────────────────────────────────
 * Squad posters — exactly one A4 page per team, premium dark theme.
 *
 * Photo-first: every person is a 3:4 portrait tile with the photo running
 * edge to edge and the name plate laid over a dark fade at its foot. Phone
 * photos are portrait, so the tile keeps a whole head and shoulders where a
 * circular avatar shrank the face to a thumbnail.
 *
 * Reading order top→bottom: TEAM OFFICIALS (silver) → ICON PLAYERS (gold
 * frame and ICON chip) → PLAYERS (team colour), each a labelled section
 * with a count chip.
 *
 * The grid picks its column count per page — whichever of 3–6 gives the
 * largest tiles that still fit — and centres short rows, so a squad is never
 * split across pages. The same 300-DPI image is used for the in-app preview
 * and the PDF, including the browser's shaping of regional-language text.
 * No bid prices — this is a presentation piece, not a ledger.
 * ──────────────────────────────────────────────────────────────────── */

type RGB = [number, number, number];

const DARK_BG: RGB = [13, 15, 23];
const CARD_BORDER: RGB = [42, 46, 64];
const TEXT_WHITE: RGB = [245, 246, 250];
const TEXT_SOFT: RGB = [200, 205, 218];
const TEXT_GRAY: RGB = [128, 134, 152];
/** Gold for icon (star) players, silver for the officials' leadership band */
const GOLD: RGB = [234, 179, 8];
const SILVER: RGB = [156, 168, 188];

/** 3:4 — the shape phone photos are taken in */
const TILE_ASPECT = 4 / 3;
const TILE_PX_W = 480;
const TILE_PX_H = 640;
/** Corner radius as a fraction of the tile width */
const TILE_RADIUS = 0.06;
/** Millimetres per typographic point */
const PT = 0.3528;

/** Blend a colour towards the dark page background (t = how much colour survives) */
function dim(rgb: RGB, t: number): RGB {
  const bg = DARK_BG;
  return [
    Math.round(bg[0] + (rgb[0] - bg[0]) * t),
    Math.round(bg[1] + (rgb[1] - bg[1]) * t),
    Math.round(bg[2] + (rgb[2] - bg[2]) * t),
  ];
}

/** Pick a legible text colour (near-black or near-white) for a filled chip */
function textOn(c: RGB): RGB {
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return lum > 140 ? DARK_BG : TEXT_WHITE;
}

/** Lift a dark team colour towards white until it reads on the dark fade */
function legible(c: RGB): RGB {
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  if (lum >= 150) return c;
  const t = (150 - lum) / (255 - lum);
  return [
    Math.round(c[0] + (255 - c[0]) * t),
    Math.round(c[1] + (255 - c[1]) * t),
    Math.round(c[2] + (255 - c[2]) * t),
  ];
}

function css(c: RGB, alpha = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function initialsOf(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(segmenter.segment(w))[0].segment)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

/** Ask for a subject-cropped 3:4 portrait instead of the full upload */
function portraitUrl(url: string): string {
  // Google avatars are stored as a 96px square (`…=s96-c`); request one the tile can use
  if (url.includes('googleusercontent.com')) return url.replace(/=s\d+(-c)?$/, `=s${TILE_PX_H}-c`);
  return cloudinaryImage(url, { w: TILE_PX_W, h: TILE_PX_H });
}

interface Portrait {
  /** JPEG data URL — the photo (or a tinted placeholder) with its fade and accent bar baked in */
  src: string;
  /** False for a placeholder, which gets the person's initials drawn over it */
  hasPhoto: boolean;
}

async function makePortrait(photo: string, accent: RGB, signal?: AbortSignal): Promise<Portrait> {
  signal?.throwIfAborted();
  let img: HTMLImageElement | null = null;
  if (photo) {
    try {
      img = await loadImage(portraitUrl(photo), signal);
    } catch {
      signal?.throwIfAborted();
      /* fall through to the placeholder */
    }
  }
  const W = TILE_PX_W;
  const H = TILE_PX_H;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (img) {
    // Cover-fit; a photo taller than 3:4 keeps its top, where the head is
    const s = Math.max(W / img.width, H / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) * 0.3, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, css(dim(accent, 0.55)));
    g.addColorStop(1, css(dim(accent, 0.2)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Dark fade under the name plate, so white text reads over any photo
  const fade = ctx.createLinearGradient(0, H * 0.45, 0, H);
  fade.addColorStop(0, css(DARK_BG, 0));
  fade.addColorStop(0.5, css(DARK_BG, 0.7));
  fade.addColorStop(1, css(DARK_BG, 0.95));
  ctx.fillStyle = fade;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
  // Accent bar along the foot
  const bar = Math.round(H * 0.016);
  ctx.fillStyle = css(accent);
  ctx.fillRect(0, H - bar, W, bar);
  try {
    return { src: canvas.toDataURL('image/jpeg', 0.88), hasPhoto: !!img };
  } catch (err) {
    // A photo host without CORS taints the canvas — fall back to the placeholder
    if (!img) throw err;
    return makePortrait('', accent, signal);
  } finally {
    canvas.width = canvas.height = 0;
  }
}

/** Page background: the dark base with a soft team-colour glow off the top-right corner */
function makeBackdrop(rgb: RGB): string {
  // 3px per mm — a soft gradient has no detail to lose
  const W = 630;
  const H = 891;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = css(DARK_BG);
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.88, 0, 0, W * 0.88, 0, W * 0.95);
  glow.addColorStop(0, css(rgb, 0.3));
  glow.addColorStop(0.5, css(rgb, 0.09));
  glow.addColorStop(1, css(rgb, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const src = canvas.toDataURL('image/jpeg', 0.92);
  canvas.width = canvas.height = 0;
  return src;
}

interface Tile {
  name: string;
  /** Playing role for players, title for officials */
  role: string;
  /** Batting / bowling style — players only */
  skill?: string;
  accent: RGB;
  kind: 'official' | 'icon' | 'player';
  wk?: boolean;
  portrait: Portrait;
}

export interface SquadPosterPage {
  teamId: string;
  teamName: string;
  src: string;
}

export async function renderSquadPosters(
  league: LeagueInfo,
  teams: Team[],
  players: Player[],
  officials: TeamOfficial[] = [],
  onlyTeamId?: string,
  signal?: AbortSignal,
): Promise<SquadPosterPage[]> {
  signal?.throwIfAborted();
  const targetTeams = onlyTeamId ? teams.filter((t) => t.id === onlyTeamId) : teams;
  if (targetTeams.length === 0) throw new Error('No teams available for squad posters');

  const pageW = 210;
  const pageH = 297;

  const GRID_X = 14;
  const GRID_W = pageW - GRID_X * 2;
  /** Lowest the grid may reach — the footer rule sits at pageH - 13 */
  const GRID_BOTTOM = pageH - 18;
  const GAP = 3.5;
  const LABEL_H = 8;
  const SECTION_GAP = 5;

  const canvas = document.createElement('canvas');
  const scale = 12;
  canvas.width = pageW * scale;
  canvas.height = pageH * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot render squad poster text');
  const ctx = context;
  ctx.scale(scale, scale);
  const pages: SquadPosterPage[] = [];
  const needsShaping = (text: string) => /[^\u0020-\u00ff]/u.test(text);
  let fontStyle: 'bold' | 'normal' | 'italic' = 'normal';

  function setFont(size: number, style = fontStyle) {
    fontStyle = style;
    ctx.font = `${style === 'normal' ? '' : `${style} `}${size * PT}px Arial, sans-serif`;
  }

  function textWidth(text: string, charSpace = 0): number {
    ctx.letterSpacing = needsShaping(text) ? '0px' : `${charSpace}px`;
    return ctx.measureText(text).width;
  }

  function posterText(text: string, x: number, y: number, options: { align?: 'left' | 'center' | 'right'; baseline?: 'middle'; charSpace?: number } = {}) {
    // ponytail: native shaping covers regional scripts; fonts can vary by OS.
    // For pixel-identical exports, move to a server renderer with bundled fonts.
    ctx.save();
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'alphabetic';
    textWidth(text, options.charSpace);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function fitText(text: string, maxW: number, size: number, min: number, charSpace = 0): string {
    const fitted = fitPdfText(text, maxW, size, min, (value, fontSize) => {
      setFont(fontSize);
      return textWidth(value, charSpace);
    });
    setFont(fitted.fontSize);
    return fitted.text;
  }

  async function drawTeamHeader(team: Team, squad: Player[], officialCount: number): Promise<number> {
    const rgb = hexToRgb(team.colorHex);

    ctx.drawImage(await loadImage(makeBackdrop(rgb), signal), 0, 0, pageW, pageH);

    // Team-colour accent bar across the very top
    ctx.fillStyle = css(rgb);
    ctx.fillRect(0, 0, pageW, 2.2);

    // Eyebrow: league name in team colour
    ctx.fillStyle = css(legible(rgb));
    setFont(9, 'bold');
    posterText(fitText(league.name.toUpperCase(), GRID_W, 9, 7, 0.8), GRID_X, 17, { charSpace: 0.8 });

    // Team name — the hero
    ctx.fillStyle = css(TEXT_WHITE);
    posterText(fitText(team.name.toUpperCase(), GRID_W, 30, 16), GRID_X, 30);

    // Squad meta — same order as the sections below
    const iconCount = squad.filter((p) => p.isIcon).length;
    const metaParts: string[] = [];
    if (officialCount > 0) metaParts.push(`${officialCount} OFFICIAL${officialCount !== 1 ? 'S' : ''}`);
    if (iconCount > 0) metaParts.push(`${iconCount} ICON${iconCount !== 1 ? 'S' : ''}`);
    metaParts.push(`${squad.length} PLAYER${squad.length !== 1 ? 'S' : ''}`);
    ctx.fillStyle = css(TEXT_GRAY);
    setFont(8.5, 'normal');
    posterText(`OFFICIAL SQUAD   ·   ${metaParts.join('   ·   ')}`, GRID_X, 37.5, { charSpace: 0.5 });

    // Accent underline
    ctx.fillStyle = css(rgb);
    ctx.beginPath();
    ctx.roundRect(GRID_X, 41, 26, 1.2, 0.6);
    ctx.fill();

    return 48;
  }

  function drawFooter() {
    ctx.strokeStyle = css(CARD_BORDER);
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(GRID_X, pageH - 13);
    ctx.lineTo(pageW - GRID_X, pageH - 13);
    ctx.stroke();
    ctx.fillStyle = css(TEXT_GRAY);
    setFont(7, 'normal');
    posterText(fitText(`${league.name}  ·  Conducted by ${league.conductedBy}`, GRID_W - 38, 7, 5), GRID_X, pageH - 8);
    setFont(7);
    posterText(
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      pageW - GRID_X, pageH - 8, { align: 'right' }
    );
  }

  /** Filled 5-point star centred at (cx, cy) with the given outer radius. */
  function drawStar(cx: number, cy: number, r: number, color: RGB) {
    const inner = r * 0.42;
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
    }
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const point of pts.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
  }

  /** Pill badge in a tile corner; `x` is its left edge, or its right edge when `alignRight` */
  function drawChip(label: string, x: number, y: number, k: number, fill: RGB, alignRight: boolean, star = false) {
    const fs = 5.8 * k;
    const h = 4.2 * k;
    const padX = 1.6 * k;
    const starW = star ? 2.9 * k : 0;
    const cs = 0.3 * k;
    setFont(fs, 'bold');
    const w = padX * 2 + starW + textWidth(label, cs);
    const left = alignRight ? x - w : x;
    ctx.fillStyle = css(fill);
    ctx.beginPath();
    ctx.roundRect(left, y, w, h, h / 2);
    ctx.fill();
    const ink = textOn(fill);
    if (star) drawStar(left + padX + 1.1 * k, y + h / 2 + 0.1 * k, 1.35 * k, ink);
    ctx.fillStyle = css(ink);
    posterText(label, left + padX + starW, y + h / 2 + (fs * PT * 0.72) / 2, { charSpace: cs });
  }

  async function drawTile(t: Tile, x: number, y: number, w: number) {
    const h = w * TILE_ASPECT;
    const r = w * TILE_RADIUS;
    const k = w / 42; // type is tuned for a 42mm tile and scales with it
    const cx = x + w / 2;
    const icon = t.kind === 'icon';

    // Photo, clipped to the rounded tile
    const photo = await loadImage(t.portrait.src, signal);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(photo, x, y, w, h);
    ctx.restore();

    if (!t.portrait.hasPhoto) {
      ctx.fillStyle = css(TEXT_WHITE);
      setFont((w * 0.32) / PT, 'bold');
      posterText(initialsOf(t.name), cx, y + h * 0.38, { align: 'center', baseline: 'middle' });
    }

    ctx.strokeStyle = css(icon ? GOLD : dim(t.accent, 0.5));
    ctx.lineWidth = icon ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();

    // Name plate over the fade, built bottom-up
    const maxW = w - 4 * k;
    let baseY = y + h - 3.6 * k;
    if (t.skill) {
      ctx.fillStyle = css(TEXT_SOFT);
      setFont(6 * k, 'normal');
      posterText(fitText(t.skill, maxW, 6 * k, 4), cx, baseY, { align: 'center' });
      baseY -= 3.8 * k;
    }
    const roleCs = 0.35 * k;
    ctx.fillStyle = css(legible(t.accent));
    setFont(6.2 * k, 'bold');
    const role = fitText(t.role.toUpperCase(), maxW, 6.2 * k, 4, roleCs);
    posterText(role, cx, baseY, { align: 'center', charSpace: roleCs });
    baseY -= 4.6 * k;
    ctx.fillStyle = css(TEXT_WHITE);
    posterText(fitText(t.name, maxW, 10.5 * k, 5.5), cx, baseY, { align: 'center' });

    const inset = 2 * k;
    if (icon) drawChip('ICON', x + inset, y + inset, k, GOLD, false, true);
    if (t.wk) drawChip('WK', x + w - inset, y + inset, k, t.accent, true);
  }

  function drawSectionLabel(label: string, color: RGB, count: number, y: number, left: number, right: number) {
    const base = y + 4.6;
    // Leading colour bar
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.roundRect(left, base - 3.3, 2.4, 4.4, 0.8);
    ctx.fill();
    // Label
    ctx.fillStyle = css(TEXT_WHITE);
    setFont(8.5, 'bold');
    posterText(label, left + 5, base, { charSpace: 0.9 });
    const labelW = textWidth(label, 0.9);
    // Count chip pinned to the right edge
    const chip = String(count);
    setFont(7);
    const chipH = 4.6;
    const cw = Math.max(chipH + 1.4, textWidth(chip) + 4.4);
    const chipX = right - cw;
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.roundRect(chipX, base - 3.4, cw, chipH, chipH / 2);
    ctx.fill();
    ctx.fillStyle = css(textOn(color));
    posterText(chip, chipX + cw / 2, base - 0.2, { align: 'center' });
    // Rule between label and chip
    ctx.strokeStyle = css(CARD_BORDER);
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(left + 8 + labelW, base - 1.1);
    ctx.lineTo(chipX - 3, base - 1.1);
    ctx.stroke();
  }

  /** The column count (3–6) giving the widest tiles at which every section still fits */
  function planGrid(counts: number[], availH: number): { cols: number; tileW: number } {
    let best = { cols: 3, tileW: 0 };
    for (let cols = 3; cols <= 6; cols++) {
      const totalRows = counts.reduce((n, c) => n + Math.ceil(c / cols), 0);
      const fixedH =
        counts.length * LABEL_H + (counts.length - 1) * SECTION_GAP + (totalRows - counts.length) * GAP;
      const tileW = Math.min(
        (GRID_W - (cols - 1) * GAP) / cols,
        (availH - fixedH) / (totalRows * TILE_ASPECT)
      );
      if (tileW > best.tileW) best = { cols, tileW };
    }
    return best;
  }

  try {
    for (const team of targetTeams) {
      signal?.throwIfAborted();
      const squad = players.filter((p) => p.teamId === team.id);
      const teamOfficials = officials.filter((o) => o.teamId === team.id);
      const rgb = hexToRgb(team.colorHex);

      const gridTop = await drawTeamHeader(team, squad, teamOfficials.length);
      drawFooter();

      if (squad.length === 0 && teamOfficials.length === 0) {
        ctx.fillStyle = css(TEXT_GRAY);
        setFont(11, 'italic');
        posterText('No players in this squad yet', pageW / 2, pageH / 2, { align: 'center' });
        pages.push({ teamId: team.id, teamName: team.name, src: canvas.toDataURL('image/jpeg', 0.92) });
        continue;
      }

      const icons = squad.filter((p) => p.isIcon);
      const others = squad.filter((p) => !p.isIcon);

      // Pre-render portraits in parallel — photo fetch is the slow part
      const [officialPortraits, iconPortraits, otherPortraits] = await Promise.all([
        Promise.all(teamOfficials.map((o) => makePortrait(o.photo, SILVER, signal))),
        Promise.all(icons.map((p) => makePortrait(p.photo, GOLD, signal))),
        Promise.all(others.map((p) => makePortrait(p.photo, rgb, signal))),
      ]);

      const playerTile = (p: Player, kind: Tile['kind'], accent: RGB, portrait: Portrait): Tile => ({
        name: p.name,
        role: p.role,
        skill: p.bowlingType === 'N/A' ? batShort(p.battingType) : `${batShort(p.battingType)} · ${p.bowlingType}`,
        accent,
        kind,
        wk: p.isWicketKeeper,
        portrait,
      });

      // Reading order: officials (silver) → icons (gold) → other players (team colour)
      const sections = [
        {
          label: 'TEAM OFFICIALS', color: SILVER,
          tiles: teamOfficials.map((o, i): Tile => ({
            name: o.name, role: o.role || 'Official', accent: SILVER, kind: 'official', portrait: officialPortraits[i],
          })),
        },
        { label: 'ICON PLAYERS', color: GOLD, tiles: icons.map((p, i) => playerTile(p, 'icon', GOLD, iconPortraits[i])) },
        { label: 'PLAYERS', color: rgb, tiles: others.map((p, i) => playerTile(p, 'player', rgb, otherPortraits[i])) },
      ].filter((sec) => sec.tiles.length > 0);

      const availH = GRID_BOTTOM - gridTop;
      const { cols, tileW } = planGrid(sections.map((sec) => sec.tiles.length), availH);
      const tileH = tileW * TILE_ASPECT;
      const totalRows = sections.reduce((n, sec) => n + Math.ceil(sec.tiles.length / cols), 0);
      const usedH =
      sections.length * LABEL_H + (sections.length - 1) * SECTION_GAP +
      totalRows * tileH + (totalRows - sections.length) * GAP;
      // Labels line up with the grid's outer edges, which move in when height is what limits the tiles
      const gridW = cols * tileW + (cols - 1) * GAP;
      const left = GRID_X + (GRID_W - gridW) / 2;

      // A small squad sits a little lower rather than hugging the header
      let curY = gridTop + Math.min(14, (availH - usedH) / 2);
      for (const [si, sec] of sections.entries()) {
        if (si > 0) curY += SECTION_GAP;
        drawSectionLabel(sec.label, sec.color, sec.tiles.length, curY, left, left + gridW);
        curY += LABEL_H;
        for (let i = 0; i < sec.tiles.length; i += cols) {
          const row = sec.tiles.slice(i, i + cols);
          // Short rows are centred, so a lone icon or a part-filled last row stays balanced
          let x = GRID_X + (GRID_W - (row.length * tileW + (row.length - 1) * GAP)) / 2;
          for (const tile of row) {
            await drawTile(tile, x, curY, tileW);
            x += tileW + GAP;
          }
          curY += tileH + GAP;
        }
        curY -= GAP;
      }
      pages.push({ teamId: team.id, teamName: team.name, src: canvas.toDataURL('image/jpeg', 0.92) });
    }
    return pages;
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function saveSquadPosters(pages: SquadPosterPage[], name: string) {
  if (!pages.length) throw new Error('No squad posters to download');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pages.forEach((page, index) => {
    if (index > 0) doc.addPage();
    doc.addImage(page.src, 'JPEG', 0, 0, 210, 297);
  });
  doc.save(`${safeFileName(name)}.pdf`);
}

export async function downloadSquadPosters(
  league: LeagueInfo,
  teams: Team[],
  players: Player[],
  officials: TeamOfficial[] = [],
  onlyTeamId?: string,
) {
  const pages = await renderSquadPosters(league, teams, players, officials, onlyTeamId);
  await saveSquadPosters(pages, onlyTeamId ? `${pages[0].teamName}_squad` : `${league.name}_squads`);
}
