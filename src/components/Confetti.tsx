'use client';

import { useMemo } from 'react';

const CONFETTI_COLORS = ['#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#ef4444', '#fcd34d', '#34d399'];

/** Pure deterministic pseudo-random in [0,1) — avoids impure Math.random in render */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A one-shot celebratory confetti burst. Fills its nearest positioned
 * ancestor by default, or the whole viewport with `fixed`. It plays once on
 * mount — remount it (change its `key`) to replay.
 */
export default function Confetti({ fixed = false }: { fixed?: boolean }) {
  const pieces = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: rand(i + 1) * 100,
      delay: rand(i + 2.3) * 0.5,
      dur: 2.2 + rand(i + 5.1) * 1.8,
      color: CONFETTI_COLORS[Math.floor(rand(i + 7.7) * CONFETTI_COLORS.length)],
      size: 7 + rand(i + 9.2) * 8,
      rot: rand(i + 11.4) * 360,
    })),
    []
  );
  return (
    <div className={`pointer-events-none overflow-hidden ${fixed ? 'fixed inset-0 z-50' : 'absolute inset-0 z-30'}`}>
      <style>{`@keyframes confettiFall { 0%{transform:translateY(-10vh) rotate(0);opacity:1} 100%{transform:translateY(115vh) rotate(720deg);opacity:.95} }`}</style>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', top: '-5vh', left: `${p.left}%`, width: p.size, height: p.size * 0.6,
          background: p.color, borderRadius: 2, transform: `rotate(${p.rot}deg)`,
          animation: `confettiFall ${p.dur}s cubic-bezier(.3,.6,.5,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  );
}
