'use client';

import { Marquee } from '@/components/ui/marquee';
import type { Sponsor } from '@/lib/types';

function SponsorTile({ sponsor }: { sponsor: Sponsor }) {
  const card = (
    <div className="w-48 h-28 sm:w-60 sm:h-32 rounded-2xl bg-white dark:bg-white/95 border border-black/5 shadow-xl flex items-center justify-center p-5 transition-transform duration-300 hover:scale-105">
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="max-w-full max-h-full object-contain"
        />
      ) : (
        <div title={sponsor.name}>{sponsor.name}</div>
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
 * into perspective, built from magicui's Marquee primitive (composition
 * matches magicui's "Marquee 3D" demo, just fed with sponsor logos instead
 * of static cards).
 */
export default function SponsorsMarquee3D({ sponsors }: { sponsors: Sponsor[] }) {
  const colCount = Math.min(4, sponsors.length) || 1;
  const columns: Sponsor[][] = Array.from({ length: colCount }, () => []);
  sponsors.forEach((s, i) => columns[i % colCount].push(s));

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black [perspective:900px]">
      <div
        className="flex flex-row items-center gap-6 sm:gap-8"
        style={{
          transform:
            'translateX(-60px) translateY(0px) translateZ(-100px) rotateX(20deg) rotateY(-10deg) rotateZ(20deg)',
        }}
      >
        {columns.map((col, i) => (
          <Marquee
            key={i}
            vertical
            reverse={i % 2 !== 0}
            pauseOnHover
            className="h-[75vh] [--duration:24s] [--gap:2rem]"
          >
            {col.map((sponsor) => (
              <SponsorTile key={sponsor.id} sponsor={sponsor} />
            ))}
          </Marquee>
        ))}
      </div>

      {/* Edge fades so the tilted grid dissolves into the background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-black to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-linear-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-linear-to-l from-black to-transparent" />
    </div>
  );
}
