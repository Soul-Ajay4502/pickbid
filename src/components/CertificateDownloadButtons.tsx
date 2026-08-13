'use client';

import { useState } from 'react';
import { FileDown, ImageDown } from 'lucide-react';
import { toast } from 'sonner';

/** A4 landscape in mm — the certificate PNG is rendered at exactly this ratio. */
const A4_LANDSCAPE = { w: 297, h: 210 };

type Format = 'png' | 'pdf';

interface CertificateDownloadButtonsProps {
  leagueId: string;
  playerId: string;
  /** Both only shape the download filename. */
  leagueName: string;
  playerName: string;
}

function fileStem(leagueName: string, playerName: string): string {
  return `${leagueName}_${playerName}_certificate`
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

/**
 * PNG / PDF download pair for one participation certificate.
 *
 * Shared by the player's own profile list and the organizer's player modal, so
 * both go through the same server-rendered artwork. The API decides who may
 * actually fetch it (the player themselves or a league organizer) — rendering
 * these buttons is never what grants access.
 */
export default function CertificateDownloadButtons({
  leagueId,
  playerId,
  leagueName,
  playerName,
}: CertificateDownloadButtonsProps) {
  const [busy, setBusy] = useState<Format | null>(null);

  /**
   * Both formats start from the same server-rendered PNG: the PDF is that image
   * placed full-bleed on an A4 landscape page. Nothing is re-drawn on the
   * client, so the printed certificate matches the shared one exactly.
   */
  async function handleDownload(format: Format) {
    if (busy) return;
    setBusy(format);
    try {
      const res = await fetch(`/leagues/${leagueId}/certificate/${playerId}`);
      if (!res.ok) throw new Error('Certificate is no longer available');
      const blob = await res.blob();
      const stem = fileStem(leagueName, playerName);

      if (format === 'png') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${stem}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const [{ default: jsPDF }, dataUrl] = await Promise.all([
          import('jspdf'),
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Could not read the certificate'));
            reader.readAsDataURL(blob);
          }),
        ]);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        pdf.addImage(dataUrl, 'PNG', 0, 0, A4_LANDSCAPE.w, A4_LANDSCAPE.h);
        pdf.save(`${stem}.pdf`);
      }
      toast.success(`Certificate downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Certificate download failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download certificate');
    } finally {
      setBusy(null);
    }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button onClick={() => handleDownload('png')} disabled={busy !== null} className={btn}>
        {busy === 'png'
          ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          : <ImageDown className="h-3.5 w-3.5" />}
        PNG
      </button>
      <button onClick={() => handleDownload('pdf')} disabled={busy !== null} className={btn}>
        {busy === 'pdf'
          ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          : <FileDown className="h-3.5 w-3.5" />}
        PDF
      </button>
    </div>
  );
}
