'use client';

// Paid / unpaid player lists as a PDF, for the organizer's document register.
//
// Text-rendered with jsPDF's built-in Helvetica rather than rasterised from the
// DOM: a name list has no layout worth screenshotting, and html2canvas would
// pick up the device's font fallbacks and give every organizer a slightly
// different page. Nothing from the register's documents goes in here — a chase
// list needs names, not ID scans or payment screenshots.

import type { PlayerDocuments } from '@/lib/types';

export type PaymentScope = 'paid' | 'unpaid';

const ACCENT: Record<PaymentScope, readonly [number, number, number]> = {
  paid: [34, 197, 94],    // green — settled
  unpaid: [234, 179, 8],  // amber — still to chase, matching the register's pills
};

function safeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/** Splits the register the same way the screen does, so the two never disagree. */
export function partitionByPayment(players: PlayerDocuments[], scope: PaymentScope): PlayerDocuments[] {
  return players.filter((p) => (scope === 'paid' ? p.paymentReceived : !p.paymentReceived));
}

export async function downloadPaymentListPdf(
  leagueName: string,
  players: PlayerDocuments[],
  scope: PaymentScope
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;
  const accent = ACCENT[scope];
  const heading = scope === 'paid' ? 'Paid Players' : 'Unpaid Players';

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(heading, margin, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(leagueName, margin, 24);
  doc.text(
    `${players.length} player${players.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    margin,
    31
  );

  let y = 48;

  const columnHeader = () => {
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('#', margin, y);
    doc.text('NAME', margin + 10, y);
    doc.text('RECEIPT', pageW - margin, y, { align: 'right' });
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };
  columnHeader();

  if (players.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text(
      scope === 'paid' ? 'No payments marked received yet.' : 'Everyone has been marked paid.',
      margin,
      y
    );
  }

  players.forEach((p, i) => {
    if (y > 272) {
      doc.addPage();
      y = margin;
      columnHeader();
    }
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(String(i + 1), margin, y);

    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(p.playerName, margin + 10, y);

    // Whether a screenshot is on file, which is a different question from
    // whether the fee was received — an organizer chasing a name wants both.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    if (p.paymentProofUrl) {
      doc.setTextColor(34, 197, 94);
      doc.text('On file', pageW - margin, y, { align: 'right' });
    } else {
      doc.setTextColor(150, 150, 150);
      doc.text('None', pageW - margin, y, { align: 'right' });
    }

    y += 4;
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, 290, { align: 'right' });
  }

  doc.save(`${safeFileName(leagueName)}_${scope}_players.pdf`);
}
