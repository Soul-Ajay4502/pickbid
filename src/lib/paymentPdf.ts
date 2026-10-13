'use client';

// Paid / unpaid player lists as a PDF, for the organizer's document register —
// one flat list, or the same names grouped under the team each player is in.
//
// Text-rendered with jsPDF's built-in Helvetica rather than rasterised from the
// DOM: a name list has no layout worth screenshotting, and html2canvas would
// pick up the device's font fallbacks and give every organizer a slightly
// different page. Nothing from the register's documents goes in here — a chase
// list needs names, not ID scans or payment screenshots.

import type { jsPDF } from 'jspdf';
import type { LeagueDocumentsResponse, PlayerDocuments } from '@/lib/types';

export type PaymentScope = 'paid' | 'unpaid';
/** The team-wise list can also carry everyone, each row marked paid or unpaid. */
export type TeamPaymentScope = PaymentScope | 'all';

type RGB = readonly [number, number, number];
type DocumentTeam = LeagueDocumentsResponse['teams'][number];

const PAGE_W = 210;
const MARGIN = 20;
/** Lowest baseline a row may sit on before the list moves to a new page. */
const LAST_ROW_Y = 272;
/** Right edge of the RECEIPT column when a FEE column sits beside it. */
const RECEIPT_X_WITH_FEE = PAGE_W - MARGIN - 26;

const ACCENT: Record<TeamPaymentScope, RGB> = {
  paid: [34, 197, 94],    // green — settled
  unpaid: [234, 179, 8],  // amber — still to chase, matching the register's pills
  all: [30, 41, 59],      // slate — the whole register, neither one nor the other
};
/** Darker than the accents, so the words stay readable on white paper. */
const PAID_TEXT: RGB = [22, 163, 74];
const UNPAID_TEXT: RGB = [202, 138, 4];
const NO_TEAM: RGB = [120, 120, 130];

function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return NO_TEAM;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

function generatedOn(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Trims `text` with an ellipsis until it fits `maxW` at the current font. */
function fit(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxW) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

/** Splits the register the same way the screen does, so the two never disagree. */
export function partitionByPayment(players: PlayerDocuments[], scope: PaymentScope): PlayerDocuments[] {
  return players.filter((p) => (scope === 'paid' ? p.paymentReceived : !p.paymentReceived));
}

/**
 * The register grouped the way the team-wise PDF lists it: teams by name —
 * numerically aware, so "Team 2" comes before "Team 10" — then the cards with
 * no team (not auctioned yet, or unsold) gathered last. Grouping runs over the
 * whole register, before any paid/unpaid filter, so a team whose players have
 * all paid still appears on the unpaid list saying so, instead of silently
 * dropping off it.
 */
export function groupByTeam(
  players: PlayerDocuments[],
  teams: DocumentTeam[]
): { team: DocumentTeam | null; players: PlayerDocuments[] }[] {
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  const known = new Set(teams.map((t) => t.id));
  const squad = (match: (p: PlayerDocuments) => boolean) =>
    players.filter(match).sort((a, b) => byName(a.playerName, b.playerName));

  const groups: { team: DocumentTeam | null; players: PlayerDocuments[] }[] = [...teams]
    .sort((a, b) => byName(a.name, b.name))
    .map((team) => ({ team, players: squad((p) => p.teamId === team.id) }));
  const teamless = squad((p) => !p.teamId || !known.has(p.teamId));
  if (teamless.length > 0) groups.push({ team: null, players: teamless });
  return groups;
}

function drawHeaderBand(doc: jsPDF, accent: RGB, heading: string, leagueName: string, summary: string) {
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, PAGE_W, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(heading, MARGIN, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(leagueName, MARGIN, 24);
  doc.text(summary, MARGIN, 31);
}

/** Draws the column labels with their rule at `y`; returns where the first row goes. */
function drawColumnHeader(doc: jsPDF, y: number, withFee: boolean): number {
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('#', MARGIN, y);
  doc.text('NAME', MARGIN + 10, y);
  doc.text('RECEIPT', withFee ? RECEIPT_X_WITH_FEE : PAGE_W - MARGIN, y, { align: 'right' });
  if (withFee) doc.text('FEE', PAGE_W - MARGIN, y, { align: 'right' });
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
  return y + 8;
}

/** Draws one player at `y`; returns where the next row goes. */
function drawPlayerRow(doc: jsPDF, p: PlayerDocuments, index: number, y: number, withFee: boolean): number {
  const receiptX = withFee ? RECEIPT_X_WITH_FEE : PAGE_W - MARGIN;

  doc.setTextColor(160, 160, 160);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(String(index + 1), MARGIN, y);

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(fit(doc, p.playerName, receiptX - 18 - (MARGIN + 10)), MARGIN + 10, y);

  // Whether a screenshot is on file, which is a different question from
  // whether the fee was received — an organizer chasing a name wants both.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (p.paymentProofUrl) {
    doc.setTextColor(PAID_TEXT[0], PAID_TEXT[1], PAID_TEXT[2]);
    doc.text('On file', receiptX, y, { align: 'right' });
  } else {
    doc.setTextColor(150, 150, 150);
    doc.text('None', receiptX, y, { align: 'right' });
  }

  if (withFee) {
    const tone = p.paymentReceived ? PAID_TEXT : UNPAID_TEXT;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(tone[0], tone[1], tone[2]);
    doc.text(p.paymentReceived ? 'Paid' : 'Unpaid', PAGE_W - MARGIN, y, { align: 'right' });
  }

  doc.setDrawColor(240, 240, 240);
  doc.line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
  return y + 9;
}

function drawPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, 290, { align: 'right' });
  }
}

export async function downloadPaymentListPdf(
  leagueName: string,
  players: PlayerDocuments[],
  scope: PaymentScope
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeaderBand(
    doc,
    ACCENT[scope],
    scope === 'paid' ? 'Paid Players' : 'Unpaid Players',
    leagueName,
    `${plural(players.length, 'player')} · Generated ${generatedOn()}`
  );

  let y = drawColumnHeader(doc, 48, false);

  if (players.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text(
      scope === 'paid' ? 'No payments marked received yet.' : 'Everyone has been marked paid.',
      MARGIN,
      y
    );
  }

  players.forEach((p, i) => {
    if (y > LAST_ROW_Y) {
      doc.addPage();
      y = drawColumnHeader(doc, MARGIN, false);
    }
    y = drawPlayerRow(doc, p, i, y, false);
  });

  drawPageNumbers(doc);
  doc.save(`${safeFileName(leagueName)}_${scope}_players.pdf`);
}

/**
 * The same chase list, one section per team. `all` keeps every player and adds
 * a FEE column; `paid` / `unpaid` keep only that half, under the same headings.
 * Each team's heading carries its own paid count either way, so an organizer
 * collecting through team captains can see at a glance whose squad is settled.
 */
export async function downloadTeamPaymentPdf(
  leagueName: string,
  teams: DocumentTeam[],
  players: PlayerDocuments[],
  scope: TeamPaymentScope
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const withFee = scope === 'all';
  const paid = players.filter((p) => p.paymentReceived).length;

  drawHeaderBand(
    doc,
    ACCENT[scope],
    scope === 'all' ? 'Team-wise Payments' : scope === 'paid' ? 'Paid Players by Team' : 'Unpaid Players by Team',
    leagueName,
    `${plural(players.length, 'player')} · ${paid} paid · ${players.length - paid} unpaid · Generated ${generatedOn()}`
  );

  let y = 50;

  const drawTeamHeading = (name: string, rgb: RGB, summary: string, continued: boolean) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(MARGIN, y - 4.5, 2.4, 9, 1.2, 1.2, 'F');
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    const title = fit(doc, name, 120);
    doc.text(title, MARGIN + 6, y);
    if (continued) {
      const titleW = doc.getTextWidth(title);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('(continued)', MARGIN + 8 + titleW, y);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(summary, PAGE_W - MARGIN, y, { align: 'right' });
    y += 9;
  };

  groupByTeam(players, teams).forEach(({ team, players: squad }) => {
    const rows = scope === 'all' ? squad : partitionByPayment(squad, scope);
    const name = team?.name ?? 'No Team Yet';
    const rgb = team ? hexToRgb(team.colorHex) : NO_TEAM;
    const teamPaid = squad.filter((p) => p.paymentReceived).length;
    const summary = squad.length === 0 ? 'No players yet' : `${teamPaid}/${squad.length} paid`;

    // Keep a heading on the same page as its first row — a team name stranded
    // at the foot of a page reads as a team with nobody in it.
    if (y + 20 > LAST_ROW_Y) {
      doc.addPage();
      y = MARGIN;
    }
    drawTeamHeading(name, rgb, summary, false);

    if (rows.length === 0) {
      if (squad.length > 0) {
        doc.setTextColor(140, 140, 140);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.text(
          scope === 'paid' ? 'Nobody in this team has been marked paid yet.' : 'Everyone in this team has paid.',
          MARGIN + 6,
          y
        );
        y += 6;
      }
      y += 6;
      return;
    }

    y = drawColumnHeader(doc, y, withFee);
    rows.forEach((p, i) => {
      if (y > LAST_ROW_Y) {
        doc.addPage();
        y = MARGIN;
        drawTeamHeading(name, rgb, summary, true);
        y = drawColumnHeader(doc, y, withFee);
      }
      y = drawPlayerRow(doc, p, i, y, withFee);
    });
    y += 7;
  });

  drawPageNumbers(doc);
  doc.save(`${safeFileName(leagueName)}_teamwise_${scope === 'all' ? 'payments' : `${scope}_players`}.pdf`);
}
