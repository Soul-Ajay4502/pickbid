// The downloadable/shareable "Auction Wrapped" summary poster, rendered
// server-side with satori via ImageResponse. Rendering on the server (instead
// of html2canvas on the client) makes the output identical on every device —
// no font-fallback word soup on Android, no viewport-dependent sizing — and
// lets the finale slide preview the exact image the user downloads.

import { ImageResponse } from 'next/og';
import { getTemplate } from '@/lib/templates';
import { teamOf, type WrappedStats } from '@/lib/recap';
import type { League } from '@/lib/types';

/** 4:5 portrait — the story/status-friendly format. */
export const POSTER_SIZE = { width: 1080, height: 1350 };

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

/** Cloudinary crop for poster-sized avatars. */
function thumb(url: string): string {
  if (url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_240,h_240,c_fill,g_auto/');
  }
  return url;
}

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

function nameSize(name: string): number {
  if (name.length > 30) return 38;
  if (name.length > 20) return 46;
  return 54;
}

const GOLD = '#fbbf24';

function Crown({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={GOLD}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    </svg>
  );
}

function Label({ children, color = 'rgba(255,255,255,0.4)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', color, fontSize: 22, letterSpacing: 7, textTransform: 'uppercase', fontWeight: 700 }}>
      {children}
    </div>
  );
}

export async function renderWrappedPoster(league: League, stats: WrappedStats): Promise<ImageResponse> {
  const t = getTemplate(league.templateId);
  const top = stats.topBuys[0] ?? null;
  const topTeam = top ? teamOf(top, stats.teamSpends) : null;
  const spender = stats.teamSpends[0] ?? null;

  const [logo, topPhoto] = await Promise.all([
    loadImage(league.logoUrl),
    loadImage(top?.photo ? thumb(top.photo) : null),
  ]);

  const tiles = [
    { v: String(stats.soldPlayers.length), l: 'Sold' },
    { v: fmt(stats.avgPrice), l: 'Avg Bid' },
    { v: String(stats.teamSpends.filter((ts) => ts.count > 0).length), l: 'Squads' },
    { v: String(stats.unsoldCount), l: 'Unsold' },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 64px 48px',
          backgroundImage: `linear-gradient(160deg, ${t.rootBg} 0%, #05070d 100%)`,
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent glow + top strip (radial falloff instead of blur — satori has no filters) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `radial-gradient(circle at 88% 4%, rgba(${t.accentRgb},0.22), transparent 45%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 10,
            backgroundImage: `linear-gradient(90deg, transparent, ${t.borderColor}, transparent)`,
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              width={116}
              height={116}
              style={{ width: 116, height: 116, borderRadius: 24, objectFit: 'contain' }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 116,
                height: 116,
                borderRadius: 24,
                backgroundColor: `rgba(${t.accentRgb},0.15)`,
                border: `2px solid rgba(${t.accentRgb},0.4)`,
                fontSize: 56,
                fontWeight: 900,
                color: t.awardColor,
              }}
            >
              {(league.name.trim()[0] || 'C').toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', fontSize: nameSize(league.name), fontWeight: 900, lineHeight: 1.1 }}>
              {league.name}
            </div>
            <div style={{ display: 'flex', marginTop: 10 }}>
              <Label color={t.awardColor}>Auction Wrapped · {stats.season}</Label>
            </div>
          </div>
        </div>

        {/* Middle block — centred in the leftover space so the fixed canvas
            stays balanced however many rows the league produces */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
          {/* Total spend */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 44,
              paddingTop: 40,
              borderTop: '2px solid rgba(255,255,255,0.1)',
            }}
          >
            <Label>Total Spend</Label>
            <div style={{ display: 'flex', fontSize: 116, fontWeight: 900, color: GOLD, marginTop: 6, lineHeight: 1.05 }}>
              {fmt(stats.totalSpend)}
            </div>
          </div>

          {/* Record buy */}
          {top && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 32,
                padding: '30px 36px',
                borderRadius: 32,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                marginTop: 48,
              }}
            >
              {topPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={topPhoto}
                  width={124}
                  height={124}
                  style={{ width: 124, height: 124, borderRadius: 9999, objectFit: 'cover', border: `4px solid ${GOLD}` }}
                  alt=""
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 124,
                    height: 124,
                    borderRadius: 9999,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: `4px solid ${GOLD}`,
                    fontSize: 52,
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  {(top.name.trim()[0] || '?').toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Crown />
                  <Label color={GOLD}>Record Buy</Label>
                </div>
                <div style={{ display: 'flex', fontSize: 42, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>
                  {top.name}
                </div>
                {topTeam && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9999, backgroundColor: topTeam.colorHex }} />
                    <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>{topTeam.name}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', fontSize: 46, fontWeight: 900, color: GOLD }}>{fmt(top.soldPrice ?? 0)}</div>
            </div>
          )}

          {/* Biggest spender */}
          {spender && spender.spent > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '26px 36px',
                borderRadius: 32,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                marginTop: 24,
              }}
            >
              <div style={{ display: 'flex', width: 26, height: 26, borderRadius: 9999, backgroundColor: spender.colorHex }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <Label>Biggest Spender</Label>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, marginTop: 6 }}>{spender.name}</div>
              </div>
              <div style={{ display: 'flex', fontSize: 38, fontWeight: 900, color: '#4ade80' }}>{fmt(spender.spent)}</div>
            </div>
          )}

        </div>

        {/* Mini stats */}
        <div style={{ display: 'flex', gap: 20 }}>
          {tiles.map((s) => (
            <div
              key={s.l}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                padding: '26px 8px',
                borderRadius: 24,
                backgroundColor: `rgba(${t.accentRgb},0.08)`,
                border: `2px solid rgba(${t.accentRgb},0.18)`,
              }}
            >
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 900 }}>{s.v}</div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 19,
                  letterSpacing: 5,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: 8,
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255,255,255,0.1)',
            marginTop: 32,
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.45)' }}>
            Conducted by {league.conductedBy}
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: t.awardColor, letterSpacing: 3 }}>
            pickbid.vercel.app

          </div>
        </div>
      </div>
    ),
    {
      ...POSTER_SIZE,
      headers: {
        // The recap changes while an auction is being (re)run — don't let the
        // default immutable ImageResponse caching pin a stale poster
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    },
  );
}
