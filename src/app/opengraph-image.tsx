import { ImageResponse } from 'next/og';
import { SITE_HOST, SHORT_DESCRIPTION } from '@/lib/seo';

// Image metadata
export const alt = 'Pickbid — Run cricket leagues like a pro';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHIPS = [
  { label: 'Player Cards', color: '#34d399' },
  { label: 'Live Auctions', color: '#fb7185' },
  { label: 'Leaderboards', color: '#fbbf24' },
  { label: 'PDF Export', color: '#38bdf8' },
];

// Branded social card. Pure flexbox + gradients only (satori subset) and no
// custom fonts/emoji, so it renders deterministically at build time.
export default function Image() {
  return new ImageResponse(
    (
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
        {/* Atmospheric glows */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage:
              'radial-gradient(circle at 12% 6%, rgba(16,185,129,0.30), transparent 42%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage:
              'radial-gradient(circle at 94% 98%, rgba(56,189,248,0.20), transparent 40%)',
          }}
        />
        {/* Top accent line */}
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

        {/* Header */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Cricket ball mark */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: 9999,
                backgroundImage: 'linear-gradient(145deg, #fb7185, #9f1239)',
                boxShadow: '0 12px 40px rgba(225,29,72,0.5)',
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 40,
                  borderLeft: '3px dashed rgba(255,255,255,0.9)',
                  transform: 'rotate(10deg)',
                }}
              />
            </div>
            <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, color: '#ffffff' }}>
              Pickbid
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 9999,
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 20,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#22c55e' }} />
            {SITE_HOST}
          </div>
        </div>

        {/* Headline block */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <div style={{ width: 9, height: 9, borderRadius: 9999, backgroundColor: '#22c55e' }} />
            <span
              style={{
                fontSize: 20,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#34d399',
                fontWeight: 700,
              }}
            >
              The all-in-one cricket league platform
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color: '#f5f5f7' }}>
              Run cricket leagues
            </span>
            <span style={{ fontSize: 90, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, color: '#34d399' }}>
              like a pro.
            </span>
          </div>
          <span
            style={{
              fontSize: 30,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.62)',
              marginTop: 30,
              maxWidth: 840,
            }}
          >
            {SHORT_DESCRIPTION}
          </span>
        </div>

        {/* Feature chips */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {CHIPS.map((c) => (
            <div
              key={c.label}
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
              <div style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: c.color }} />
              <span style={{ fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
