import { ImageResponse } from 'next/og';

// High-resolution app icon (also used as the schema.org logo and PWA icon).
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)',
          borderRadius: 96,
        }}
      >
        {/* Auction gavel — PickIt puts players under the hammer */}
        <svg
          width={300}
          height={300}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.35))' }}
        >
          <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
          <path d="m16 16 6-6" />
          <path d="m8 8 6-6" />
          <path d="m9 7 8 8" />
          <path d="m21 11-8-8" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
