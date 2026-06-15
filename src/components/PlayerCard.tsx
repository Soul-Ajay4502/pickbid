'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Player } from '@/lib/types';
import { getTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/templates';
import { QRCodeSVG } from 'qrcode.react';

export const CARD_W = 340;
export const CARD_H = Math.round(CARD_W * 297 / 210);

function rgba(rgb: string, alpha: number) {
  return `rgba(${rgb}, ${alpha})`;
}

interface PlayerCardProps {
  player: Player;
  templateId?: string;
  leagueName?: string;
  conductedBy?: string;
  logoUrl?: string;
  showEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  pdfMode?: boolean;
}

function hasStats(p: Player) {
  return p.statsMatches != null || p.statsRuns != null || p.statsWickets != null;
}

export default function PlayerCard({
  player,
  templateId = DEFAULT_TEMPLATE_ID,
  leagueName = 'Cricket League',
  conductedBy = 'League Organiser',
  logoUrl = '',
  showEdit,
  onEdit,
  onDelete,
  pdfMode,
}: PlayerCardProps) {
  const t = getTemplate(templateId);
  const hasPhoto = !!player.photo;
  const showStats = hasStats(player);

  const [qrUrl, setQrUrl] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined' && player.leagueId && player.leagueId !== 'preview') {
      // setQrUrl(`${window.location.origin}/leagues/${player.leagueId}`);
    }
  }, [player.leagueId]);

  const formattedDate = new Date(player.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const season = new Date(player.createdAt).getFullYear().toString();
  const extraDetails = `${player.battingType}  ·  ${player.bowlingType}${player.isWicketKeeper ? '  ·  WK' : ''}`;

  const card = (
    <div
      style={{
        width: CARD_W, height: CARD_H,
        background: t.rootBg,
        border: `3px solid ${t.borderColor}`,
        borderRadius: 16,
        fontFamily: "'Arial', 'Helvetica', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 20px 80px ${rgba(t.accentRgb, 0.45)}`,
        flexShrink: 0,
      }}
    >
      {/* Full-bleed photo */}
      {hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={player.photo} alt={player.name} crossOrigin="anonymous"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
      )}

      {/* No-photo decorative fill */}
      {!hasPhoto && (
        <>
          <div style={{ position: 'absolute', top: -70, right: -70, width: 260, height: 260, borderRadius: '50%', border: `50px solid ${rgba(t.accentRgb, 0.07)}` }} />
          <div style={{ position: 'absolute', top: 90, left: -55, width: 200, height: 200, borderRadius: '50%', border: `36px solid ${rgba(t.accentRgb, 0.05)}` }} />
          <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center', fontSize: 120, lineHeight: 1, opacity: 0.08, userSelect: 'none', pointerEvents: 'none' }}>🏏</div>
        </>
      )}

      {/* Top vignette */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to bottom, rgba(0,0,0,0.80), rgba(0,0,0,0))', pointerEvents: 'none' }} />

      {/* Bottom vignette */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: hasPhoto ? Math.round(CARD_H * 0.71) : Math.round(CARD_H * 0.54),
        background: hasPhoto
          ? 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.78) 82%, rgba(0,0,0,0.6))'
          : 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.60))',
        pointerEvents: 'none',
      }} />

      {/* Inner border */}
      <div style={{ position: 'absolute', inset: 7, border: `1px solid ${rgba(t.accentRgb, 0.22)}`, borderRadius: 11, pointerEvents: 'none' }} />

      {/* Bottom accent strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, ${rgba(t.accentRgb, 0)}, ${t.borderColor}, ${rgba(t.accentRgb, 0)})` }} />

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="League Logo" crossOrigin="anonymous"
            style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6 }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 6, border: `1px dashed ${rgba(t.accentRgb, 0.40)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: rgba(t.accentRgb, 0.5), fontSize: 7.5, lineHeight: 1.4, textAlign: 'center' }}>
            <span style={{ fontSize: 14, marginBottom: 1 }}>🏅</span>Logo
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.90)', fontSize: 9, fontWeight: 'bold', letterSpacing: 3, textTransform: 'uppercase', padding: '0 8px' }}>
          {leagueName}
        </div>
        {/* QR code in top-right */}
        {qrUrl && (
          <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <QRCodeSVG value={qrUrl} size={34} level="L" />
          </div>
        )}
        {!qrUrl && <div style={{ width: 40, height: 40, flexShrink: 0 }} />}
      </div>

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 14px' }}>

        {/* Stats section (if player has stats) */}
        {showStats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '6px 8px', background: rgba(t.accentRgb, 0.12), borderRadius: 8, border: `1px solid ${rgba(t.accentRgb, 0.2)}` }}>
            {player.statsMatches != null && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>{player.statsMatches}</div>
                <div style={{ color: rgba(t.accentRgb, 0.6), fontSize: 6, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>M</div>
              </div>
            )}
            {player.statsRuns != null && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>{player.statsRuns}</div>
                <div style={{ color: rgba(t.accentRgb, 0.6), fontSize: 6, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Runs</div>
              </div>
            )}
            {player.statsWickets != null && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>{player.statsWickets}</div>
                <div style={{ color: rgba(t.accentRgb, 0.6), fontSize: 6, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Wkts</div>
              </div>
            )}
            {player.statsAverage != null && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>{player.statsAverage.toFixed(1)}</div>
                <div style={{ color: rgba(t.accentRgb, 0.6), fontSize: 6, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Avg</div>
              </div>
            )}
            {player.statsSR != null && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 14, fontWeight: 'bold', lineHeight: 1 }}>{player.statsSR.toFixed(0)}</div>
                <div style={{ color: rgba(t.accentRgb, 0.6), fontSize: 6, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>SR</div>
              </div>
            )}
          </div>
        )}

        {/* Player name */}
        <div style={{ color: '#ffffff', fontSize: 36, fontWeight: 'bold', letterSpacing: 0.3, lineHeight: 1.05, marginBottom: 6, textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
          {player.name}
        </div>

        {/* Role */}
        <div style={{ color: t.awardColor, fontSize: 13, fontStyle: 'italic', fontWeight: 600, lineHeight: 1.3, marginBottom: 8, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
          {player.role}
        </div>

        {/* Batting · Bowling · WK */}
        <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 10, lineHeight: 1.5, marginBottom: 8, fontStyle: 'italic' }}>
          {extraDetails}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `linear-gradient(to right, ${rgba(t.accentRgb, 0)}, ${rgba(t.accentRgb, 0.55)}, ${rgba(t.accentRgb, 0)})`, marginBottom: 8 }} />

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 70 }}>
            <div style={{ color: rgba(t.accentRgb, 0.55), fontSize: 7, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 2 }}>Season</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 600 }}>{season}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{conductedBy}</div>
            <div style={{ color: rgba(t.accentRgb, 0.55), fontSize: 7, letterSpacing: 2.5, textTransform: 'uppercase' }}>Conducted By</div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 70 }}>
            <div style={{ color: rgba(t.accentRgb, 0.55), fontSize: 7, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 2 }}>Date</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 600 }}>{formattedDate}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (pdfMode) return card;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {card}
      {showEdit && (
        <div style={{ display: 'flex', gap: 8, width: CARD_W }}>
          {onEdit && <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 text-xs">Edit</Button>}
          {onDelete && <Button size="sm" variant="outline" onClick={onDelete} className="flex-1 text-xs text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-950">Delete</Button>}
        </div>
      )}
    </div>
  );
}
