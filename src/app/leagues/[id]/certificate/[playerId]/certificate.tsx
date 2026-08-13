// The participation certificate, rendered server-side with satori via
// ImageResponse — the same reasoning as the Auction Wrapped poster: rasterising
// on the client picks up whatever fonts the device happens to have and the
// layout falls apart on mobile. Rendering here makes every download identical,
// and it's what the profile page wraps into a PDF.
//
// Unlike the rest of the app this artwork is deliberately *light*: a certificate
// is meant to be printed and framed, and a dark full-bleed background is both
// wrong for the format and brutal on an inkjet. The league's card template only
// supplies the accent colour used for the frame and rules.

import { ImageResponse } from 'next/og';
import { getTemplate } from '@/lib/templates';
import type { LeagueCertificate } from '@/lib/types';

/** A4 landscape at 150 dpi — prints cleanly and stays a sane render cost. */
export const CERTIFICATE_SIZE = { width: 1754, height: 1240 };

const INK = '#1a2e22';
const MUTED = '#5b6b62';
const PAPER = '#fdfdfa';

/** Fetch a remote image and inline it as a data URI so satori never fetches
 *  (and never throws) at render time. Returns null on any problem. */
async function loadImage(url?: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/png';
    if (!type.startsWith('image/')) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Long names have to shrink or they collide with the frame. */
function nameSize(name: string): number {
  if (name.length > 34) return 78;
  if (name.length > 24) return 96;
  if (name.length > 16) return 116;
  return 132;
}

function leagueSize(name: string): number {
  if (name.length > 42) return 40;
  if (name.length > 28) return 50;
  return 60;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Article that reads correctly before a role ("an All-Rounder", "a Batter"). */
function article(role: string): string {
  return /^[AEIOU]/i.test(role) ? 'an' : 'a';
}

/** Small diamond ornament used to break up the rules. */
function Diamond({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        transform: 'rotate(45deg)',
      }}
    />
  );
}

/** A horizontal rule with a diamond at its centre. */
function Rule({ color, width }: { color: string; width: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width, height: 2, backgroundColor: `${color}55` }} />
      <Diamond color={color} />
      <div style={{ width, height: 2, backgroundColor: `${color}55` }} />
    </div>
  );
}

export async function renderCertificate(cert: LeagueCertificate): Promise<ImageResponse> {
  const t = getTemplate(cert.templateId);
  const accent = t.borderColor;
  const logo = await loadImage(cert.logoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 26,
          backgroundColor: PAPER,
          // Faint tint of the league accent, so the paper still belongs to the league
          backgroundImage: `radial-gradient(circle at 50% 0%, rgba(${t.accentRgb},0.10), transparent 62%)`,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Outer rule + inner frame — the classic double border */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            border: `6px solid ${accent}`,
            padding: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              border: `2px solid ${accent}99`,
              padding: '44px 80px 44px',
            }}
          >
            {/* Everything above the footer is centred in the leftover space, so
                the fixed canvas stays balanced whether the name runs to one
                line or two */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                justifyContent: 'center',
              }}
            >
            {/* Crest: league logo, or its initial when there's no logo */}
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                width={132}
                height={132}
                style={{ width: 132, height: 132, objectFit: 'contain' }}
                alt=""
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  backgroundColor: `rgba(${t.accentRgb},0.14)`,
                  border: `3px solid ${accent}`,
                  fontSize: 62,
                  fontWeight: 900,
                  color: accent,
                }}
              >
                {(cert.leagueName.trim()[0] || 'C').toUpperCase()}
              </div>
            )}

            {/* Title */}
            <div
              style={{
                display: 'flex',
                marginTop: 30,
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: 14,
                color: INK,
              }}
            >
              CERTIFICATE
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 10,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 12,
                color: MUTED,
              }}
            >
              OF PARTICIPATION
            </div>

            <div style={{ display: 'flex', marginTop: 26 }}>
              <Rule color={accent} width={210} />
            </div>

            {/* Recipient */}
            <div style={{ display: 'flex', marginTop: 30, fontSize: 26, color: MUTED }}>
              This is to certify that
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                fontSize: nameSize(cert.playerName),
                fontWeight: 900,
                color: INK,
                lineHeight: 1.1,
                textAlign: 'center',
              }}
            >
              {cert.playerName}
            </div>
            <div style={{ display: 'flex', width: 640, height: 2, marginTop: 16, backgroundColor: `${accent}44` }} />

            {/* Citation */}
            <div
              style={{
                display: 'flex',
                marginTop: 26,
                fontSize: 28,
                color: MUTED,
                textAlign: 'center',
              }}
            >
              participated as {article(cert.role)} {cert.role}
              {cert.teamName ? ` for ${cert.teamName}` : ''} in
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 14,
                fontSize: leagueSize(cert.leagueName),
                fontWeight: 800,
                color: accent,
                lineHeight: 1.15,
                textAlign: 'center',
              }}
            >
              {cert.leagueName}
            </div>
            </div>

            {/* Footer: issue date and the organizing body, on a shared baseline */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                paddingTop: 30,
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 400 }}>
                <div style={{ display: 'flex', fontSize: 26, color: INK }}>{formatDate(cert.releasedAt)}</div>
                <div style={{ display: 'flex', width: '100%', height: 2, marginTop: 10, backgroundColor: `${accent}66` }} />
                <div style={{ display: 'flex', marginTop: 10, fontSize: 18, letterSpacing: 4, color: MUTED }}>
                  DATE ISSUED
                </div>
              </div>

              <Diamond color={accent} size={18} />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 400 }}>
                <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: INK, textAlign: 'center' }}>
                  {cert.conductedBy}
                </div>
                <div style={{ display: 'flex', width: '100%', height: 2, marginTop: 10, backgroundColor: `${accent}66` }} />
                <div style={{ display: 'flex', marginTop: 10, fontSize: 18, letterSpacing: 4, color: MUTED }}>
                  CONDUCTED BY
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    CERTIFICATE_SIZE
  );
}
