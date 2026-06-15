import { ImageResponse } from 'next/og';

// Apple touch icon shown on iOS home screens.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          borderRadius: 38,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 108,
            height: 108,
            borderRadius: 9999,
            backgroundImage: 'linear-gradient(145deg, #fb7185, #9f1239)',
            boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: 0,
              height: 72,
              borderLeft: '5px dashed rgba(255,255,255,0.92)',
              transform: 'rotate(10deg)',
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
