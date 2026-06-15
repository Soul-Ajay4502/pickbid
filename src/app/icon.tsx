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
        {/* Cricket ball */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 300,
            height: 300,
            borderRadius: 9999,
            backgroundImage: 'linear-gradient(145deg, #fb7185, #9f1239)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: 0,
              height: 200,
              borderLeft: '14px dashed rgba(255,255,255,0.92)',
              transform: 'rotate(10deg)',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
