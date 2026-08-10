'use client';

import { useEffect, useState } from 'react';
import { Marquee } from '@/components/ui/marquee';
import type { Sponsor } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Tilt of the wall, in degrees — the coverage math below depends on these. */
const TILT_X = 14;
const TILT_Y = -6;
const TILT_Z = 12;
/** Weak perspective: a stronger one shrinks the far edge and re-opens corner gaps. */
const PERSPECTIVE = 1600;
/** Slack for the perspective foreshortening the flat rotation math ignores. */
const OVERSCAN = 1.18;

const rad = (deg: number) => (deg * Math.PI) / 180;

type WallLayout = {
  tileW: number;
  tileH: number;
  gap: number;
  cols: number;
  rows: number;
  colHeight: number;
};

/**
 * Sizes the wall so its clipped edges always land outside the viewport.
 * A rotated rect covers the screen when its half-extents, measured in the
 * wall's own axes, reach the screen's furthest corner — solve that for the
 * tilt above, then fill it with whole tiles.
 */
function useWallLayout(): WallLayout | null {
  const [layout, setLayout] = useState<WallLayout | null>(null);

  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Size off the diagonal, not the width — a portrait screen still needs a
      // wide wall once it is tilted, and width-only sizing makes it tiny there.
      const tileW = Math.round(Math.min(420, Math.max(170, Math.hypot(vw, vh) * 0.18)));
      const tileH = Math.round(tileW * 0.56);
      const gap = Math.round(tileW * 0.12);

      const halfW =
        ((vw / 2) * Math.cos(rad(TILT_Z)) + (vh / 2) * Math.sin(rad(TILT_Z))) /
        Math.cos(rad(TILT_Y));
      const halfH =
        ((vw / 2) * Math.sin(rad(TILT_Z)) + (vh / 2) * Math.cos(rad(TILT_Z))) /
        Math.cos(rad(TILT_X));

      const cols = Math.min(10, Math.ceil((halfW * 2 * OVERSCAN) / (tileW + gap)));
      const rows = Math.min(24, Math.ceil((halfH * 2 * OVERSCAN) / (tileH + gap)) + 1);

      setLayout({ tileW, tileH, gap, cols, rows, colHeight: rows * (tileH + gap) });
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return layout;
}

function SponsorTile({ sponsor, width, height }: { sponsor: Sponsor; width: number; height: number }) {
  const style = {
    width,
    height,
    padding: Math.round(height * 0.14),
  };
  const card = (
    <div
      className={cn("flex items-center justify-center rounded-md border border-black/5  shadow-xl transition-transform duration-300 hover:scale-105", sponsor.logoUrl ? "bg-transparent" : "bg-white")}
      style={sponsor.logoUrl ? {} : style}
    >
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          draggable={false}
          className="max-h-full max-w-full object-contain border-2"
        />
      ) : (
        <div
          className="line-clamp-2 text-center font-semibold leading-tight text-black/80"
          style={{ fontSize: Math.round(height * 0.15) }}
        >
          {sponsor.name}
        </div>
      )}
    </div>
  );

  return sponsor.website ? (
    <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="block" title={sponsor.name}>
      {card}
    </a>
  ) : (
    <div title={sponsor.name}>{card}</div>
  );
}

/**
 * Full-viewport "3D wall" marquee — vertical columns of sponsor logos tilted
 * into perspective, built from magicui's Marquee primitive. Column count,
 * tile size and tile count are derived from the viewport so the wall always
 * overflows it; the edge gradients are then a pure vignette rather than a
 * mask hiding the columns' hard clip line.
 */
export default function SponsorsMarquee3D({ sponsors }: { sponsors: Sponsor[] }) {
  const layout = useWallLayout();

  if (!layout || sponsors.length === 0) return <div className="h-full w-full bg-black" />;
  const { tileW, tileH, gap, cols, rows, colHeight } = layout;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
      style={{ perspective: `${PERSPECTIVE}px` }}
    >
      <div
        className="flex flex-row items-center"
        style={{
          gap,
          transform: `rotateX(${TILT_X}deg) rotateY(${TILT_Y}deg) rotateZ(${TILT_Z}deg)`,
        }}
      >
        {Array.from({ length: cols }, (_, c) => (
          <Marquee
            key={c}
            vertical
            reverse={c % 2 !== 0}
            pauseOnHover
            repeat={2}
            className="p-0"
            style={
              {
                height: colHeight,
                '--gap': `${gap}px`,
                '--duration': `${26 + (c % 3) * 7}s`,
              } as React.CSSProperties
            }
          >
            {/* Every column carries the full roster, offset by one so neighbours
                never line up — that also keeps single-sponsor columns from
                repeating one logo down the whole strip. */}
            {Array.from({ length: rows }, (_, r) => (
              <SponsorTile
                key={`${c}-${r}`}
                sponsor={sponsors[(r + c) % sponsors.length]}
                width={tileW}
                height={tileH}
              />
            ))}
          </Marquee>
        ))}
      </div>

      {/* Vignette — multi-stop so the wall dissolves instead of stepping to black */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[20%] bg-[linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.9)_28%,rgba(0,0,0,0.5)_60%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%] bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,0.9)_28%,rgba(0,0,0,0.5)_60%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[12%] bg-[linear-gradient(to_right,#000_0%,rgba(0,0,0,0.9)_28%,rgba(0,0,0,0.5)_60%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[12%] bg-[linear-gradient(to_left,#000_0%,rgba(0,0,0,0.9)_28%,rgba(0,0,0,0.5)_60%,transparent_100%)]" />
    </div>
  );
}
