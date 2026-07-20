import { ImageResponse } from 'next/og';
import { getLeague, getPlayers } from '@/lib/store';
import { SITE_HOST } from '@/lib/seo';

export const runtime = 'nodejs';
export const alt = 'Cricket league on Pickbid';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Fetch a remote logo and inline it as a data URI so satori never fetches
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

function fontSizeFor(name: string): number {
  if (name.length > 28) return 56;
  if (name.length > 18) return 70;
  return 84;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 72,
      backgroundColor: '#0a0b10',
      overflow: 'hidden',
      fontFamily: 'sans-serif',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: 'radial-gradient(circle at 10% 6%, rgba(16,185,129,0.30), transparent 42%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: 'radial-gradient(circle at 95% 96%, rgba(56,189,248,0.18), transparent 40%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 6,
        backgroundImage: 'linear-gradient(90deg, #16a34a, #059669, #0d9488)',
      }}
    />
    {children}
  </div>
);

const Brand = () => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 52,
        height: 52,
        borderRadius: 9999,
        backgroundImage: 'linear-gradient(145deg, #fb7185, #9f1239)',
        boxShadow: '0 10px 30px rgba(225,29,72,0.45)',
      }}
    >
      <div style={{ width: 0, height: 34, borderLeft: '3px dashed rgba(255,255,255,0.9)', transform: 'rotate(10deg)' }} />
    </div>
    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: '#ffffff' }}>Pickbid</span>
  </div>
);

const Chip = ({ color, label }: { color: string; label: string }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 22px',
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}
  >
    <div style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: color }} />
    <span style={{ fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
  </div>
);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  let league: Awaited<ReturnType<typeof getLeague>> = null;
  let playerCount = 0;
  try {
    const { id } = await params;
    league = await getLeague(id);
    if (league) {
      try {
        // Before registration fills in, actual card rows can be 0 while the
        // league's declared size is what the OG description already quotes —
        // keep the card consistent with it rather than showing "0 players".
        playerCount = (await getPlayers(id)).length || (league.totalPlayers ?? 0);
      } catch {
        playerCount = league.totalPlayers ?? 0;
      }
    }
  } catch {
    league = null;
  }

  // Fallback to the brand card when the league can't be loaded.
  if (!league) {
    return new ImageResponse(
      (
        <Shell>
          <Brand />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color: '#f5f5f7' }}>
              Run cricket leagues
            </span>
            <span style={{ fontSize: 88, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, color: '#34d399' }}>
              like a pro.
            </span>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 14 }}>
            <Chip color="#34d399" label="Player Cards" />
            <Chip color="#fb7185" label="Live Auctions" />
            <Chip color="#fbbf24" label="Leaderboards" />
          </div>
        </Shell>
      ),
      { ...size },
    );
  }

  const logo = await loadImage(league.logoUrl);
  const initial = (league.name?.trim()?.[0] || 'C').toUpperCase();

  return new ImageResponse(
    (
      <Shell>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 9999,
              border: '1px solid rgba(34,197,94,0.35)',
              backgroundColor: 'rgba(34,197,94,0.1)',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#22c55e' }} />
            <span style={{ fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: '#86efac', fontWeight: 700 }}>
              Cricket League
            </span>
          </div>
        </div>

        {/* League identity */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 36 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              width={168}
              height={168}
              style={{ width: 168, height: 168, borderRadius: 32, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.12)' }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 168,
                height: 168,
                borderRadius: 32,
                backgroundImage: 'linear-gradient(145deg, rgba(16,185,129,0.35), rgba(13,148,136,0.35))',
                border: '1px solid rgba(16,185,129,0.4)',
                color: '#a7f3d0',
                fontSize: 90,
                fontWeight: 900,
              }}
            >
              {initial}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 800 }}>
            <span style={{ fontSize: fontSizeFor(league.name), fontWeight: 900, letterSpacing: -2, lineHeight: 1.02, color: '#f5f5f7' }}>
              {league.name}
            </span>
            {league.conductedBy ? (
              <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.6)', marginTop: 16 }}>
                Conducted by {league.conductedBy}
              </span>
            ) : null}
          </div>
        </div>

        {/* Footer chips */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <Chip color="#34d399" label={`${playerCount} player${playerCount === 1 ? '' : 's'}`} />
            <Chip color="#fb7185" label="Live auction" />
            <Chip color="#fbbf24" label="Leaderboard" />
          </div>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)' }}>{SITE_HOST}</span>
        </div>
      </Shell>
    ),
    { ...size },
  );
}
