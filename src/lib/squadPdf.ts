'use client';

import type { Player, Team } from '@/lib/types';

interface LeagueInfo {
  name: string;
  conductedBy: string;
}

/* jsPDF's built-in Helvetica has no ₹ glyph — use "Rs" in PDFs */
function fmtRs(n: number): string {
  if (n >= 10000000) return `Rs ${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `Rs ${(n / 100000).toFixed(1)} L`;
  return `Rs ${n.toLocaleString('en-IN')}`;
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
 * Squad posters — one A4 page per team, premium dark theme.
 * Player cards on a deep navy background with team-colour accents.
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

export async function downloadSquadPosters(
  league: LeagueInfo,
  teams: Team[],
  players: Player[],
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

  function drawTeamHeader(team: Team, squad: Player[], continued: boolean): number {
    const rgb = hexToRgb(team.colorHex);

    // Full-page dark background
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Team-colour accent bar across the very top
    doc.setFillColor(...rgb);
    doc.rect(0, 0, pageW, 2.2, 'F');

    if (continued) {
      doc.setTextColor(...TEXT_WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(team.name.toUpperCase(), GRID_X, 16);
      doc.setTextColor(...dim(rgb, 0.85));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('CONTINUED', pageW - GRID_X, 16, { align: 'right' });
      return 24;
    }

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

    // Squad meta
    const icons = squad.filter((p) => p.isIcon).length;
    doc.setTextColor(...TEXT_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `OFFICIAL SQUAD   ·   ${squad.length} PLAYER${squad.length !== 1 ? 'S' : ''}${icons > 0 ? `   ·   ${icons} ICON` : ''}`,
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

  for (const team of targetTeams) {
    const squad = players.filter((p) => p.teamId === team.id);
    const rgb = hexToRgb(team.colorHex);

    if (!firstPage) doc.addPage();
    firstPage = false;

    let gridTop = drawTeamHeader(team, squad, false);
    drawFooter();

    if (squad.length === 0) {
      doc.setTextColor(...TEXT_GRAY);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.text('No players in this squad yet', pageW / 2, pageH / 2, { align: 'center' });
      continue;
    }

    // Pre-render avatars in parallel — photo fetch is the slow part
    const avatars = await Promise.all(
      squad.map((p) => makeAvatar(p.photo, p.name, team.colorHex))
    );

    const rowsPerPage = () => Math.floor((pageH - gridTop - 18) / CELL_H);
    let rowCapacity = rowsPerPage();

    for (let i = 0; i < squad.length; i++) {
      const player = squad[i];
      const slot = i % (rowCapacity * COLS);

      // Overflow → continuation page
      if (i > 0 && slot === 0) {
        doc.addPage();
        gridTop = drawTeamHeader(team, squad, true);
        drawFooter();
        rowCapacity = rowsPerPage();
      }

      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const cellX = GRID_X + col * CELL_W;
      const top = gridTop + row * CELL_H;
      const cx = cellX + CELL_W / 2;

      // Player card surface
      const cardX = cellX + 2;
      const cardW = CELL_W - 4;
      const cardH = CELL_H - 5;
      doc.setFillColor(...CARD_BG);
      doc.setDrawColor(...(player.isIcon ? dim([217, 119, 6], 0.7) : CARD_BORDER));
      doc.setLineWidth(player.isIcon ? 0.5 : 0.3);
      doc.roundedRect(cardX, top, cardW, cardH, 3, 3, 'FD');
      // Team-colour accent strip along the card top
      doc.setFillColor(...rgb);
      doc.roundedRect(cardX + cardW / 2 - 7, top, 14, 1.1, 0.55, 0.55, 'F');

      // Avatar with team-colour ring
      const AV = 24;
      const avY = top + 5;
      doc.setDrawColor(...rgb);
      doc.setLineWidth(0.9);
      doc.circle(cx, avY + AV / 2, AV / 2 + 1.3, 'S');
      doc.addImage(avatars[i], 'PNG', cx - AV / 2, avY, AV, AV);

      // Name (+ WK tag)
      let textY = avY + AV + 7.5;
      doc.setTextColor(...TEXT_WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const displayName = player.name.length > 20 ? player.name.slice(0, 19) + '…' : player.name;
      doc.text(displayName + (player.isWicketKeeper ? '  (WK)' : ''), cx, textY, { align: 'center' });

      // Role in team colour
      textY += 4.8;
      doc.setTextColor(...dim(rgb, 0.95));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(player.role.toUpperCase(), cx, textY, { align: 'center', charSpace: 0.4 });

      // Batting / bowling
      textY += 4.4;
      doc.setTextColor(...TEXT_GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      const skill = player.bowlingType === 'N/A'
        ? batShort(player.battingType)
        : `${batShort(player.battingType)} · ${player.bowlingType}`;
      doc.text(skill, cx, textY, { align: 'center' });

      // Icon player chip (no bid prices on the poster)
      if (player.isIcon) {
        textY += 6.2;
        const label = 'ICON PLAYER';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const tw = doc.getTextWidth(label) + 1.5 /* charSpace */;
        doc.setFillColor(217, 119, 6);
        doc.roundedRect(cx - tw / 2 - 3, textY - 3.4, tw + 6, 5, 2.5, 2.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(label, cx, textY, { align: 'center', charSpace: 0.3 });
      }
    }
  }

  const fileName = onlyTeamId && targetTeams.length === 1
    ? `${safeFileName(targetTeams[0].name)}_squad.pdf`
    : `${safeFileName(league.name)}_squads.pdf`;
  doc.save(fileName);
}
