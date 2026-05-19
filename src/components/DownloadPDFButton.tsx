'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import PlayerCard, { CARD_W, CARD_H } from './PlayerCard';
import type { Player } from '@/lib/types';

interface DownloadPDFButtonProps {
  players: Player[];
  leagueName: string;
  conductedBy?: string;
  templateId?: string;
  logoUrl?: string;
}

export default function DownloadPDFButton({
  players,
  leagueName,
  conductedBy,
  templateId,
  logoUrl,
}: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function handleDownload() {
    if (players.length === 0) return;
    setLoading(true);

    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      // A4 portrait — matches the portrait card aspect ratio better
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      const container = containerRef.current;
      if (!container) return;

      for (let i = 0; i < players.length; i++) {
        const cardEl = container.querySelector<HTMLElement>(`[data-player-index="${i}"]`);
        if (!cardEl) continue;

        const canvas = await html2canvas(cardEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          onclone: (clonedDoc) => {
            // html2canvas can't parse modern CSS color functions (oklch, lab) used by
            // Tailwind v4 / shadcn. The card uses only inline styles, so stripping all
            // stylesheets from the clone is safe and prevents the parse error.
            clonedDoc
              .querySelectorAll('link[rel="stylesheet"], style')
              .forEach((el) => el.remove());
          },
        });

        const imgData = canvas.toDataURL('image/png');
        // Card aspect ratio (px): CARD_H / CARD_W
        const cardAspect = CARD_H / CARD_W;

        const margin = 20;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        let drawW = maxW;
        let drawH = drawW * cardAspect;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH / cardAspect;
        }

        const x = (pageWidth - drawW) / 2;
        const y = (pageHeight - drawH) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
      }

      const safeName = leagueName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${safeName}_player_cards.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleDownload}
        disabled={loading || players.length === 0}
        className="bg-amber-600 hover:bg-amber-500 text-white"
      >
        {loading ? 'Generating PDF…' : `Download PDF (${players.length} cards)`}
      </Button>

      {typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={containerRef}
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: '-9999px',
              left: '-9999px',
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            {players.map((player, i) => (
              <div key={player.id} data-player-index={i} style={{ width: CARD_W }}>
                <PlayerCard
                  player={player}
                  templateId={templateId}
                  leagueName={leagueName}
                  conductedBy={conductedBy}
                  logoUrl={logoUrl}
                  pdfMode
                />
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
