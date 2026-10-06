'use client';

import type { Player, Team, TeamOfficial } from '@/lib/types';
import { cloudinaryImage } from '@/lib/utils';

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
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
 * split across pages. Only pixels are rasterised (photos, fades, backdrop);
 * every word is vector text, so nothing depends on the device's fonts.
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
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
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

async function makePortrait(photo: string, accent: RGB): Promise<Portrait> {
  let img: HTMLImageElement | null = null;
  if (photo) {
    try {
      img = await loadImage(portraitUrl(photo));
    } catch {
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
    return makePortrait('', accent);
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
  return canvas.toDataURL('image/jpeg', 0.92);
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

export async function downloadSquadPosters(
  league: LeagueInfo,
  teams: Team[],
  players: Player[],
  officials: TeamOfficial[] = [],
  onlyTeamId?: string
) {
  const targetTeams = onlyTeamId ? teams.filter((t) => t.id === onlyTeamId) : teams;
  if (targetTeams.length === 0) return;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;

  const GRID_X = 14;
  const GRID_W = pageW - GRID_X * 2;
  /** Lowest the grid may reach — the footer rule sits at pageH - 13 */
  const GRID_BOTTOM = pageH - 18;
  const GAP = 3.5;
  const LABEL_H = 8;
  const SECTION_GAP = 5;

  let firstPage = true;

  /**
   * Sets the largest font size from `size` down to `min` at which `text` fits
   * `maxW`, and returns the text — truncated if it overflows even at `min`.
   * The font face must already be set.
   */
  function fitText(text: string, maxW: number, size: number, min: number, charSpace = 0): string {
    const width = (s: string) => doc.getTextWidth(s) + charSpace * Math.max(0, s.length - 1);
    let fs = size;
    doc.setFontSize(fs);
    while (fs > min && width(text) > maxW) {
      fs = Math.max(min, fs - 0.25);
      doc.setFontSize(fs);
    }
    if (width(text) <= maxW) return text;
    let cut = text;
    while (cut.length > 1 && width(cut + '…') > maxW) cut = cut.slice(0, -1);
    return cut.trimEnd() + '…';
  }

  function drawTeamHeader(team: Team, squad: Player[], officialCount: number): number {
    const rgb = hexToRgb(team.colorHex);

    doc.addImage(makeBackdrop(rgb), 'JPEG', 0, 0, pageW, pageH);

    // Team-colour accent bar across the very top
    doc.setFillColor(...rgb);
    doc.rect(0, 0, pageW, 2.2, 'F');

    // Eyebrow: league name in team colour
    doc.setTextColor(...legible(rgb));
    doc.setFont('helvetica', 'bold');
    doc.text(fitText(league.name.toUpperCase(), GRID_W, 9, 7, 0.8), GRID_X, 17, { charSpace: 0.8 });

    // Team name — the hero
    doc.setTextColor(...TEXT_WHITE);
    doc.text(fitText(team.name.toUpperCase(), GRID_W, 30, 16), GRID_X, 30);

    // Squad meta — same order as the sections below
    const iconCount = squad.filter((p) => p.isIcon).length;
    const metaParts: string[] = [];
    if (officialCount > 0) metaParts.push(`${officialCount} OFFICIAL${officialCount !== 1 ? 'S' : ''}`);
    if (iconCount > 0) metaParts.push(`${iconCount} ICON${iconCount !== 1 ? 'S' : ''}`);
    metaParts.push(`${squad.length} PLAYER${squad.length !== 1 ? 'S' : ''}`);
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`OFFICIAL SQUAD   ·   ${metaParts.join('   ·   ')}`, GRID_X, 37.5, { charSpace: 0.5 });

    // Accent underline
    doc.setFillColor(...rgb);
    doc.roundedRect(GRID_X, 41, 26, 1.2, 0.6, 0.6, 'F');

    return 48;
  }

  function drawFooter() {
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.25);
    doc.line(GRID_X, pageH - 13, pageW - GRID_X, pageH - 13);
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${league.name}  ·  Conducted by ${league.conductedBy}`, GRID_X, pageH - 8);
    doc.text(
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
    const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]] as [number, number]);
    doc.setFillColor(...color);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
  }

  /** Pill badge in a tile corner; `x` is its left edge, or its right edge when `alignRight` */
  function drawChip(label: string, x: number, y: number, k: number, fill: RGB, alignRight: boolean, star = false) {
    const fs = 5.8 * k;
    const h = 4.2 * k;
    const padX = 1.6 * k;
    const starW = star ? 2.9 * k : 0;
    const cs = 0.3 * k;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    const w = padX * 2 + starW + doc.getTextWidth(label) + cs * (label.length - 1);
    const left = alignRight ? x - w : x;
    doc.setFillColor(...fill);
    doc.roundedRect(left, y, w, h, h / 2, h / 2, 'F');
    const ink = textOn(fill);
    if (star) drawStar(left + padX + 1.1 * k, y + h / 2 + 0.1 * k, 1.35 * k, ink);
    doc.setTextColor(...ink);
    doc.text(label, left + padX + starW, y + h / 2 + (fs * PT * 0.72) / 2, { charSpace: cs });
  }

  function drawTile(t: Tile, x: number, y: number, w: number) {
    const h = w * TILE_ASPECT;
    const r = w * TILE_RADIUS;
    const k = w / 42; // type is tuned for a 42mm tile and scales with it
    const cx = x + w / 2;
    const icon = t.kind === 'icon';

    // Photo, clipped to the rounded tile
    doc.saveGraphicsState();
    doc.roundedRect(x, y, w, h, r, r, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(t.portrait.src, 'JPEG', x, y, w, h);
    doc.restoreGraphicsState();

    if (!t.portrait.hasPhoto) {
      doc.setTextColor(...TEXT_WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize((w * 0.32) / PT);
      doc.text(initialsOf(t.name), cx, y + h * 0.38, { align: 'center', baseline: 'middle' });
    }

    doc.setDrawColor(...(icon ? GOLD : dim(t.accent, 0.5)));
    doc.setLineWidth(icon ? 0.7 : 0.3);
    doc.roundedRect(x, y, w, h, r, r, 'S');

    // Name plate over the fade, built bottom-up
    const maxW = w - 4 * k;
    let baseY = y + h - 3.6 * k;
    if (t.skill) {
      doc.setTextColor(...TEXT_SOFT);
      doc.setFont('helvetica', 'normal');
      doc.text(fitText(t.skill, maxW, 6 * k, 4), cx, baseY, { align: 'center' });
      baseY -= 3.8 * k;
    }
    const roleCs = 0.35 * k;
    doc.setTextColor(...legible(t.accent));
    doc.setFont('helvetica', 'bold');
    const role = fitText(t.role.toUpperCase(), maxW, 6.2 * k, 4, roleCs);
    // jsPDF centres on the unspaced width, so letter-spaced text is centred by hand
    const roleW = doc.getTextWidth(role) + roleCs * (role.length - 1);
    doc.text(role, cx - roleW / 2, baseY, { charSpace: roleCs });
    baseY -= 4.6 * k;
    doc.setTextColor(...TEXT_WHITE);
    doc.text(fitText(t.name, maxW, 10.5 * k, 5.5), cx, baseY, { align: 'center' });

    const inset = 2 * k;
    if (icon) drawChip('ICON', x + inset, y + inset, k, GOLD, false, true);
    if (t.wk) drawChip('WK', x + w - inset, y + inset, k, t.accent, true);
  }

  function drawSectionLabel(label: string, color: RGB, count: number, y: number, left: number, right: number) {
    const base = y + 4.6;
    // Leading colour bar
    doc.setFillColor(...color);
    doc.roundedRect(left, base - 3.3, 2.4, 4.4, 0.8, 0.8, 'F');
    // Label
    doc.setTextColor(...TEXT_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(label, left + 5, base, { charSpace: 0.9 });
    const labelW = doc.getTextWidth(label) + label.length * 0.9;
    // Count chip pinned to the right edge
    const chip = String(count);
    doc.setFontSize(7);
    const chipH = 4.6;
    const cw = Math.max(chipH + 1.4, doc.getTextWidth(chip) + 4.4);
    const chipX = right - cw;
    doc.setFillColor(...color);
    doc.roundedRect(chipX, base - 3.4, cw, chipH, chipH / 2, chipH / 2, 'F');
    doc.setTextColor(...textOn(color));
    doc.text(chip, chipX + cw / 2, base - 0.2, { align: 'center' });
    // Rule between label and chip
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.25);
    doc.line(left + 8 + labelW, base - 1.1, chipX - 3, base - 1.1);
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

  for (const team of targetTeams) {
    const squad = players.filter((p) => p.teamId === team.id);
    const teamOfficials = officials.filter((o) => o.teamId === team.id);
    const rgb = hexToRgb(team.colorHex);

    if (!firstPage) doc.addPage();
    firstPage = false;

    const gridTop = drawTeamHeader(team, squad, teamOfficials.length);
    drawFooter();

    if (squad.length === 0 && teamOfficials.length === 0) {
      doc.setTextColor(...TEXT_GRAY);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.text('No players in this squad yet', pageW / 2, pageH / 2, { align: 'center' });
      continue;
    }

    const icons = squad.filter((p) => p.isIcon);
    const others = squad.filter((p) => !p.isIcon);

    // Pre-render portraits in parallel — photo fetch is the slow part
    const [officialPortraits, iconPortraits, otherPortraits] = await Promise.all([
      Promise.all(teamOfficials.map((o) => makePortrait(o.photo, SILVER))),
      Promise.all(icons.map((p) => makePortrait(p.photo, GOLD))),
      Promise.all(others.map((p) => makePortrait(p.photo, rgb))),
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
    sections.forEach((sec, si) => {
      if (si > 0) curY += SECTION_GAP;
      drawSectionLabel(sec.label, sec.color, sec.tiles.length, curY, left, left + gridW);
      curY += LABEL_H;
      for (let i = 0; i < sec.tiles.length; i += cols) {
        const row = sec.tiles.slice(i, i + cols);
        // Short rows are centred, so a lone icon or a part-filled last row stays balanced
        let x = GRID_X + (GRID_W - (row.length * tileW + (row.length - 1) * GAP)) / 2;
        for (const tile of row) {
          drawTile(tile, x, curY, tileW);
          x += tileW + GAP;
        }
        curY += tileH + GAP;
      }
      curY -= GAP;
    });
  }

  const fileName = onlyTeamId && targetTeams.length === 1
    ? `${safeFileName(targetTeams[0].name)}_squad.pdf`
    : `${safeFileName(league.name)}_squads.pdf`;
  doc.save(fileName);
}
