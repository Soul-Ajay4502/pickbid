'use client';

import type { Player, Team, TeamOfficial } from '@/lib/types';

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

/** Ask Cloudinary for a small face-cropped square instead of the full upload */
function thumbUrl(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_400,h_400,c_fill,g_auto/');
  }
  return url;
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

/**
 * Returns a circular avatar as a PNG data URL — the player photo
 * cover-fitted into a circle, or team-coloured initials as fallback.
 */
async function makeAvatar(photo: string, name: string, colorHex: string, px = 256): Promise<string> {
  if (photo) {
    try {
      const img = await loadImage(thumbUrl(photo));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = px;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const s = Math.max(px / img.width, px / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h);
      return canvas.toDataURL('image/png'); // throws if canvas got tainted → initials fallback
    } catch {
      /* fall through to initials */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `bold ${Math.round(px * 0.4)}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  ctx.fillText(initials, px / 2, px / 2 + px * 0.02);
  return canvas.toDataURL('image/png');
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
 * Player cards on a deep navy background with team-colour accents.
 *
 * Reading order top→bottom: TEAM OFFICIALS (silver leadership band) →
 * ICON PLAYERS (gold hero cards with a star badge) → PLAYERS (team-colour).
 * Each group is its own labelled section with a count chip.
 *
 * The grid auto-scales so a whole squad (plus officials) always fits on a
 * single page — large squads shrink rather than spilling to a second page.
 * No bid prices — this is a presentation piece, not a ledger.
 * ──────────────────────────────────────────────────────────────────── */

/** Blend a colour towards the dark page background (t = how much colour survives) */
function dim(rgb: [number, number, number], t: number): [number, number, number] {
  const bg = DARK_BG;
  return [
    Math.round(bg[0] + (rgb[0] - bg[0]) * t),
    Math.round(bg[1] + (rgb[1] - bg[1]) * t),
    Math.round(bg[2] + (rgb[2] - bg[2]) * t),
  ];
}

const DARK_BG: [number, number, number] = [13, 15, 23];
const CARD_BG: [number, number, number] = [23, 26, 40];
const CARD_BORDER: [number, number, number] = [42, 46, 64];
const TEXT_WHITE: [number, number, number] = [245, 246, 250];
const TEXT_GRAY: [number, number, number] = [128, 134, 152];
/** Gold for icon (star) players, silver for the officials' leadership band */
const GOLD: [number, number, number] = [234, 179, 8];
const SILVER: [number, number, number] = [156, 168, 188];

/** Pick a legible text colour (near-black or near-white) for a filled chip */
function textOn(c: [number, number, number]): [number, number, number] {
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return lum > 140 ? DARK_BG : TEXT_WHITE;
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

  const COLS = 3;
  const CELL_H = 62;
  const GRID_X = 14;
  const CELL_W = (pageW - GRID_X * 2) / COLS;

  let firstPage = true;

  function drawTeamHeader(team: Team, squad: Player[], officialCount: number): number {
    const rgb = hexToRgb(team.colorHex);

    // Full-page dark background
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Team-colour accent bar across the very top
    doc.setFillColor(...rgb);
    doc.rect(0, 0, pageW, 2.2, 'F');

    // Giant watermark initial, dimmed into the background
    doc.setTextColor(...dim(rgb, 0.16));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(150);
    doc.text(team.name.charAt(0).toUpperCase(), pageW - 14, 52, { align: 'right' });

    // Eyebrow: league name in team colour
    doc.setTextColor(...dim(rgb, 0.9));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(league.name.toUpperCase(), GRID_X, 19, { charSpace: 0.8 });

    // Team name — the hero
    doc.setTextColor(...TEXT_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.text(team.name.toUpperCase(), GRID_X, 32);

    // Squad meta — same order as the sections below
    const iconCount = squad.filter((p) => p.isIcon).length;
    const metaParts: string[] = [];
    if (officialCount > 0) metaParts.push(`${officialCount} OFFICIAL${officialCount !== 1 ? 'S' : ''}`);
    if (iconCount > 0) metaParts.push(`${iconCount} ICON${iconCount !== 1 ? 'S' : ''}`);
    metaParts.push(`${squad.length} PLAYER${squad.length !== 1 ? 'S' : ''}`);
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `OFFICIAL SQUAD   ·   ${metaParts.join('   ·   ')}`,
      GRID_X, 40, { charSpace: 0.5 }
    );

    // Accent underline
    doc.setFillColor(...rgb);
    doc.roundedRect(GRID_X, 44, 26, 1.2, 0.6, 0.6, 'F');

    return 52;
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

  // ── Card renderers ──────────────────────────────────────────────────────
  const OFFICIAL_CELL_H = 52;

  /** Filled 5-point star centred at (cx, cy) with the given outer radius. */
  function drawStar(cx: number, cy: number, r: number, color: [number, number, number]) {
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

  function drawPlayerCard(player: Player, avatar: string, cellX: number, top: number, rgb: [number, number, number], s: number) {
    const icon = player.isIcon;
    const accent = icon ? GOLD : rgb;
    const cx = cellX + CELL_W / 2;
    const cardX = cellX + 2;
    const cardW = CELL_W - 4;
    const cardH = (CELL_H - 5) * s;
    // Card body — icons get a subtle warm tint and a brighter gold border
    doc.setFillColor(...(icon ? dim(GOLD, 0.12) : CARD_BG));
    doc.setDrawColor(...(icon ? dim(GOLD, 0.85) : CARD_BORDER));
    doc.setLineWidth(icon ? 0.6 : 0.3);
    doc.roundedRect(cardX, top, cardW, cardH, 3, 3, 'FD');
    // Accent strip along the card top
    doc.setFillColor(...accent);
    doc.roundedRect(cardX + cardW / 2 - 7, top, 14, 1.1, 0.55, 0.55, 'F');
    // Star badge in the top-right corner for icon players
    if (icon) drawStar(cardX + cardW - 5 * s, top + 5 * s, 2.7 * s, GOLD);

    // Avatar with accent ring (thicker + double ring for icons)
    const AV = 24 * s;
    const avY = top + 5 * s;
    doc.setDrawColor(...accent);
    doc.setLineWidth(icon ? 1.2 : 0.9);
    doc.circle(cx, avY + AV / 2, AV / 2 + 1.3 * s, 'S');
    if (icon) {
      doc.setLineWidth(0.4);
      doc.circle(cx, avY + AV / 2, AV / 2 + 2.6 * s, 'S');
    }
    doc.addImage(avatar, 'PNG', cx - AV / 2, avY, AV, AV);

    // Name (+ WK tag)
    let textY = avY + AV + 7.5 * s;
    doc.setTextColor(...TEXT_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10 * s);
    const displayName = player.name.length > 20 ? player.name.slice(0, 19) + '…' : player.name;
    doc.text(displayName + (player.isWicketKeeper ? '  (WK)' : ''), cx, textY, { align: 'center' });

    // Role in accent colour
    textY += 4.8 * s;
    doc.setTextColor(...dim(accent, 0.95));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7 * s);
    doc.text(player.role.toUpperCase(), cx, textY, { align: 'center', charSpace: 0.4 });

    // Batting / bowling
    textY += 4.4 * s;
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8 * s);
    const skill = player.bowlingType === 'N/A'
      ? batShort(player.battingType)
      : `${batShort(player.battingType)} · ${player.bowlingType}`;
    doc.text(skill, cx, textY, { align: 'center' });

    // Gold "ICON" chip (no bid prices on the poster)
    if (icon) {
      textY += 6.2 * s;
      const label = 'ICON';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5 * s);
      const tw = doc.getTextWidth(label);
      doc.setFillColor(...GOLD);
      doc.roundedRect(cx - tw / 2 - 4, textY - 3.4 * s, tw + 8, 5 * s, 2.5 * s, 2.5 * s, 'F');
      doc.setTextColor(...DARK_BG);
      doc.text(label, cx, textY, { align: 'center', charSpace: 0.3 });
    }
  }

  function drawOfficialCard(official: TeamOfficial, avatar: string, cellX: number, top: number, accent: [number, number, number], s: number) {
    const cx = cellX + CELL_W / 2;
    const cardX = cellX + 2;
    const cardW = CELL_W - 4;
    const cardH = (OFFICIAL_CELL_H - 5) * s;
    doc.setFillColor(...CARD_BG);
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, top, cardW, cardH, 3, 3, 'FD');
    // Silver accent strip — sets the leadership band apart from the players
    doc.setFillColor(...dim(accent, 0.7));
    doc.roundedRect(cardX + cardW / 2 - 7, top, 14, 1.1, 0.55, 0.55, 'F');

    const AV = 22 * s;
    const avY = top + 5 * s;
    doc.setDrawColor(...dim(accent, 0.9));
    doc.setLineWidth(0.8);
    doc.circle(cx, avY + AV / 2, AV / 2 + 1.2 * s, 'S');
    doc.addImage(avatar, 'PNG', cx - AV / 2, avY, AV, AV);

    let textY = avY + AV + 7 * s;
    doc.setTextColor(...TEXT_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5 * s);
    const displayName = official.name.length > 20 ? official.name.slice(0, 19) + '…' : official.name;
    doc.text(displayName, cx, textY, { align: 'center' });

    // Role — the headline info for an official (no contact number on the poster)
    textY += 4.6 * s;
    doc.setTextColor(...accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7 * s);
    const role = (official.role || 'Official').toUpperCase();
    doc.text(role.length > 26 ? role.slice(0, 25) + '…' : role, cx, textY, { align: 'center', charSpace: 0.4 });
  }

  function drawSectionLabel(label: string, color: [number, number, number], count: number, y: number, s: number) {
    const fs = Math.max(7.5, 10.5 * s);
    // Leading colour bar
    doc.setFillColor(...color);
    doc.roundedRect(GRID_X, y - 3.2, 2.6, 4.8, 0.9, 0.9, 'F');
    // Label
    doc.setTextColor(...TEXT_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    doc.text(label, GRID_X + 5.5, y, { charSpace: 0.9 });
    const labelW = doc.getTextWidth(label) + label.length * 0.9;
    // Count chip pinned to the right edge
    const chip = String(count);
    doc.setFontSize(Math.max(6.5, 7.5 * s));
    const chipH = Math.max(4.6, 5.2 * s);
    const cw = doc.getTextWidth(chip) + 5.5;
    const chipX = pageW - GRID_X - cw;
    doc.setFillColor(...color);
    doc.roundedRect(chipX, y - chipH + 1.4, cw, chipH, chipH / 2, chipH / 2, 'F');
    doc.setTextColor(...textOn(color));
    doc.text(chip, chipX + cw / 2, y, { align: 'center' });
    // Divider between label and chip
    doc.setDrawColor(...CARD_BORDER);
    doc.setLineWidth(0.25);
    doc.line(GRID_X + 9.5 + labelW, y - 1.4, chipX - 3, y - 1.4);
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

    // Pre-render avatars in parallel — photo fetch is the slow part
    const [iconAvatars, otherAvatars, officialAvatars] = await Promise.all([
      Promise.all(icons.map((p) => makeAvatar(p.photo, p.name, team.colorHex))),
      Promise.all(others.map((p) => makeAvatar(p.photo, p.name, team.colorHex))),
      Promise.all(teamOfficials.map((o) => makeAvatar(o.photo, o.name, team.colorHex))),
    ]);

    // Reading order: officials (silver) → icons (gold) → other players (team colour)
    const sections = [
      {
        items: teamOfficials, label: 'TEAM OFFICIALS', color: SILVER, cellH: OFFICIAL_CELL_H,
        draw: (i: number, x: number, y: number, sc: number) =>
          drawOfficialCard(teamOfficials[i], officialAvatars[i], x, y, SILVER, sc),
      },
      {
        items: icons, label: 'ICON PLAYERS', color: GOLD, cellH: CELL_H,
        draw: (i: number, x: number, y: number, sc: number) =>
          drawPlayerCard(icons[i], iconAvatars[i], x, y, rgb, sc),
      },
      {
        items: others, label: 'PLAYERS', color: rgb, cellH: CELL_H,
        draw: (i: number, x: number, y: number, sc: number) =>
          drawPlayerCard(others[i], otherAvatars[i], x, y, rgb, sc),
      },
    ].filter((sec) => sec.items.length > 0);

    // Scale everything so the present sections fit on this one page. Cards keep
    // their natural size for small squads (s capped at 1) and shrink uniformly
    // for large ones, so a poster is never split across pages.
    const SECTION_GAP = 5, LABEL_H = 9;
    const naturalH =
      sections.reduce((h, sec) => h + LABEL_H + Math.ceil(sec.items.length / COLS) * sec.cellH, 0) +
      SECTION_GAP * Math.max(0, sections.length - 1);
    const available = (pageH - 18) - gridTop;
    const s = Math.min(1, available / naturalH);

    // Render each section: label, then its card grid
    let curY = gridTop;
    sections.forEach((sec, si) => {
      if (si > 0) curY += SECTION_GAP * s;
      drawSectionLabel(sec.label, sec.color, sec.items.length, curY + 4 * s, s);
      curY += LABEL_H * s;
      const cellH = sec.cellH * s;
      for (let i = 0; i < sec.items.length; i++) {
        const col = i % COLS;
        sec.draw(i, GRID_X + col * CELL_W, curY, s);
        if (col === COLS - 1) curY += cellH;
      }
      if (sec.items.length % COLS !== 0) curY += cellH;
    });
  }

  const fileName = onlyTeamId && targetTeams.length === 1
    ? `${safeFileName(targetTeams[0].name)}_squad.pdf`
    : `${safeFileName(league.name)}_squads.pdf`;
  doc.save(fileName);
}
