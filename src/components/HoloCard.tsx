'use client';

// Holographic trading-card wrapper: tilts toward the pointer (or the phone's
// gyroscope) and lays a rainbow foil + moving glare over its children, scaled
// by rarity. Used by the squad pack-opening reveal.
//
// The dynamic tilt transform lives on its own inner div and no keyframe
// animation is ever applied to it — combining the two shifts the card on
// WebKit (see the cardDropIn/scale gotcha elsewhere in the app). Entry
// animations belong on an ancestor of this component.

import { useEffect, useRef, useState } from 'react';
import { RARITY_META, type Rarity } from '@/lib/recap';

const MAX_TILT_DEG = 11;

interface HoloCardProps {
  rarity: Rarity;
  width: number;
  height: number;
  /** Corner radius of the wrapped card so the foil clips with it */
  radius?: number;
  children: React.ReactNode;
}

export default function HoloCard({ rarity, width, height, radius = 16, children }: HoloCardProps) {
  const meta = RARITY_META[rarity];
  // Pointer position over the card, both in 0..1 (0.5,0.5 = resting flat)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [active, setActive] = useState(false);
  const gyroNeutral = useRef<{ beta: number; gamma: number } | null>(null);
  const pointerBusy = useRef(false);

  // Gyroscope tilt on devices that fire deviceorientation without a permission
  // prompt (Android). The first reading becomes "flat" so however the phone is
  // held feels neutral; iOS needs an explicit permission request, so it falls
  // back to touch tilt instead.
  useEffect(() => {
    function onOrient(e: DeviceOrientationEvent) {
      if (pointerBusy.current || e.beta == null || e.gamma == null) return;
      gyroNeutral.current ??= { beta: e.beta, gamma: e.gamma };
      const db = Math.max(-24, Math.min(24, e.beta - gyroNeutral.current.beta));
      const dg = Math.max(-24, Math.min(24, e.gamma - gyroNeutral.current.gamma));
      setPos({ x: 0.5 + dg / 48, y: 0.5 + db / 48 });
      setActive(true);
    }
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, []);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    pointerBusy.current = true;
    setPos({
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
    setActive(true);
  }

  function onPointerLeave() {
    pointerBusy.current = false;
    setPos({ x: 0.5, y: 0.5 });
    setActive(false);
  }

  const rotY = (pos.x - 0.5) * 2 * MAX_TILT_DEG;
  const rotX = -(pos.y - 0.5) * 2 * MAX_TILT_DEG;
  const shiny = rarity === 'legendary' || rarity === 'icon';

  return (
    <div
      style={{ width, height, perspective: 1100, touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerLeave}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: radius,
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: active ? 'transform .07s linear' : 'transform .5s cubic-bezier(.22,1,.36,1)',
          boxShadow: `0 0 ${shiny ? 70 : 44}px rgba(${meta.rgb},${shiny ? 0.4 : 0.26}), 0 24px 60px rgba(0,0,0,.55)`,
          willChange: 'transform',
        }}
      >
        {children}

        {/* Rainbow foil, sliding against the tilt */}
        {meta.foil > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
              background: `linear-gradient(115deg,
                transparent 18%,
                rgba(255,80,80,.85) 32%,
                rgba(255,220,90,.85) 41%,
                rgba(110,255,150,.85) 50%,
                rgba(90,200,255,.85) 59%,
                rgba(200,120,255,.85) 68%,
                transparent 82%)`,
              backgroundSize: '260% 260%',
              backgroundPosition: `${(1 - pos.x) * 100}% ${(1 - pos.y) * 100}%`,
              mixBlendMode: 'color-dodge',
              opacity: active ? meta.foil : meta.foil * 0.45,
              transition: 'opacity .35s ease',
            }}
          />
        )}

        {/* Sparkle dust on the top tiers */}
        {shiny && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
              backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,.9) 0 1.2px, transparent 2.4px),
                radial-gradient(circle at 70% 15%, rgba(255,255,255,.8) 0 1px, transparent 2px),
                radial-gradient(circle at 45% 65%, rgba(255,255,255,.9) 0 1.4px, transparent 2.6px),
                radial-gradient(circle at 85% 55%, rgba(255,255,255,.7) 0 1px, transparent 2px),
                radial-gradient(circle at 30% 85%, rgba(255,255,255,.8) 0 1.2px, transparent 2.2px)`,
              backgroundSize: '160px 160px',
              backgroundPosition: `${pos.x * 40}px ${pos.y * 40}px`,
              mixBlendMode: 'screen',
              opacity: active ? 0.5 : 0.25,
              transition: 'opacity .35s ease',
            }}
          />
        )}

        {/* Glare following the pointer */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
            background: `radial-gradient(circle at ${pos.x * 100}% ${pos.y * 100}%, rgba(255,255,255,.32) 0%, rgba(255,255,255,.08) 32%, transparent 62%)`,
            mixBlendMode: 'overlay',
            opacity: active ? 1 : 0.35,
            transition: 'opacity .35s ease',
          }}
        />
      </div>
    </div>
  );
}
