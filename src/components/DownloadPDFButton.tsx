'use client';

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import PlayerCard, { CARD_W, CARD_H } from './PlayerCard';
import type { Player } from '@/lib/types';

/**
 * Pages are JPEG, not PNG. A PNG page embeds every pixel losslessly plus an
 * alpha mask, which made a big league's PDF enormous; photographic cards come
 * out several times smaller as JPEG with no difference you can see at this
 * density. It is faster too — jsPDF decodes and re-deflates PNG data in
 * JavaScript, but embeds JPEG bytes as they are.
 */
const JPEG_QUALITY = 0.85;

/**
 * Cards mounted ahead of the one being captured, so the next photos are already
 * downloading while the current card rasterises. Bounded rather than the whole
 * roster: every mounted card holds a decoded full-size photo, and 100+ of them
 * at once is how a phone tab gets killed.
 */
const PREFETCH = 6;

const TOAST_ID = 'card-pdf';

interface CardPdfOptions {
  players: Player[];
  leagueName: string;
  conductedBy?: string;
  templateId?: string;
  logoUrl?: string;
}

interface DownloadPDFButtonProps extends CardPdfOptions {
  /** Overrides the default standalone-button styling (e.g. to render as a menu item) */
  className?: string;
}

// The job lives at module scope, not in component state. This button sits in
// the league's Share & Export menu, which unmounts it on any outside click — a
// capture owned by the component would die with the menu, and a remounted
// button would offer to start a second one alongside it.
type Job = { done: number; total: number };
let job: Job | null = null;
let cancelled = false;
const listeners = new Set<() => void>();

function setJob(next: Job | null) {
  job = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const percentOf = ({ done, total }: Job) => Math.round((done / total) * 100);

function reportProgress(next: Job) {
  setJob(next);
  toast.loading(`Generating card PDF… ${percentOf(next)}%`, {
    id: TOAST_ID,
    description: `${next.done} of ${next.total} cards`,
    action: { label: 'Cancel', onClick: () => { cancelled = true; } },
  });
}

/**
 * Blob bytes rather than a data URL, which would base64-encode every page only
 * for jsPDF to decode it again. The canvas's backing store is released straight
 * away: iOS Safari caps total canvas memory, and 100+ abandoned captures hit it.
 */
async function encodeJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Card could not be encoded');
  return new Uint8Array(await blob.arrayBuffer());
}

async function generateCardPdf({ players, leagueName, conductedBy, templateId, logoUrl }: CardPdfOptions) {
  if (job || players.length === 0) return;
  const total = players.length;
  cancelled = false;
  reportProgress({ done: 0, total });

  // Cards render into a throwaway root of their own rather than a portal owned
  // by the button, for the same reason the job state is module-scoped.
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;top:-9999px;left:-9999px;pointer-events:none;z-index:-1';
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    // html2canvas-pro (a maintained fork) understands modern CSS colour
    // functions (oklch, lab, lch, color()) that Tailwind v4 emits — the
    // original html2canvas throws "unsupported color function" on them.
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas-pro'),
    ]);

    // A4 portrait — matches the portrait card aspect ratio better
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

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

    for (let i = 0; i < total; i++) {
      if (cancelled) return;

      flushSync(() => root.render(
        players.slice(i, i + PREFETCH).map((player, offset) => (
          <div key={player.id} data-player-index={i + offset} style={{ width: CARD_W }}>
            <PlayerCard
              player={player}
              templateId={templateId}
              leagueName={leagueName}
              conductedBy={conductedBy}
              logoUrl={logoUrl}
              pdfMode
            />
          </div>
        )),
      ));
      const cardEl = host.querySelector<HTMLElement>(`[data-player-index="${i}"]`);
      if (!cardEl) continue;

      const canvas = await html2canvas(cardEl, {
        scale: 2,
        useCORS: true,
        // JPEG has no alpha channel: fill the card's rounded corners with the
        // page's white rather than letting them encode as black.
        backgroundColor: '#ffffff',
        logging: false,
        // html2canvas clones the entire document for every capture and waits
        // for every image in the clone to load. Left alone, each card dragged
        // the whole league page along — its own roster grid included — so a
        // 100-card export did quadratic work. Keep only the path to this card.
        ignoreElements: (el) =>
          (el.parentElement === document.body || el.parentElement === host) && !el.contains(cardEl),
        onclone: (clonedDoc) => {
          // The card is styled entirely with inline styles, so we drop the app's
          // stylesheets from the clone to render it in isolation — no global
          // Tailwind rules leaking into the off-screen capture.
          clonedDoc
            .querySelectorAll('link[rel="stylesheet"], style')
            .forEach((el) => el.remove());
        },
      });

      const jpeg = await encodeJpeg(canvas);
      if (cancelled) return;

      if (i > 0) pdf.addPage();
      pdf.addImage(jpeg, 'JPEG', x, y, drawW, drawH);
      reportProgress({ done: i + 1, total });
    }

    const safeName = leagueName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    pdf.save(`${safeName}_player_cards.pdf`);
    toast.success('Card PDF downloaded', { id: TOAST_ID, description: `${total} cards`, action: undefined });
  } catch (err) {
    console.error('PDF generation failed:', err);
    toast.error('Failed to generate PDF — please try again', { id: TOAST_ID, description: undefined, action: undefined });
  } finally {
    root.unmount();
    host.remove();
    setJob(null);
  }
}

export default function DownloadPDFButton({
  players,
  leagueName,
  conductedBy,
  templateId,
  logoUrl,
  className,
}: DownloadPDFButtonProps) {
  const current = useSyncExternalStore(subscribe, () => job, () => null);

  return (
    <button
      onClick={() => generateCardPdf({ players, leagueName, conductedBy, templateId, logoUrl })}
      disabled={!!current || players.length === 0}
      className={className ?? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'}
    >
      <FileDown className={`w-3.5 h-3.5 ${className ? 'text-muted-foreground' : ''} ${current ? 'animate-pulse' : ''}`} />
      {current ? `Generating PDF… ${percentOf(current)}%` : `Card PDF (${players.length} cards)`}
    </button>
  );
}
