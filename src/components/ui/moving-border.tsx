'use client';

import { useRef } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useTransform,
} from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Aceternity UI — Moving Border (button)
 * A pill button with a light that orbits the border. The glowing dot
 * follows the rounded-rect path via getPointAtLength on each frame.
 */
export function MovingBorderButton({
  borderRadius = '1.75rem',
  children,
  duration = 2800,
  className,
  containerClassName,
  borderClassName,
  onClick,
}: {
  borderRadius?: string;
  children: React.ReactNode;
  duration?: number;
  className?: string;
  containerClassName?: string;
  borderClassName?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ borderRadius }}
      className={cn(
        'relative h-14 overflow-hidden bg-transparent p-[1.5px] text-base cursor-pointer',
        containerClassName,
      )}
    >
      <div className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={cn(
              'h-24 w-24 bg-[radial-gradient(#10b981_40%,transparent_60%)] opacity-90',
              borderClassName,
            )}
          />
        </MovingBorder>
      </div>

      <div
        className={cn(
          'relative flex h-full items-center justify-center gap-2 border border-emerald-500/20 bg-card/80 px-8 font-semibold text-foreground antialiased backdrop-blur-xl transition-colors',
          className,
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </button>
  );
}

function MovingBorder({
  children,
  duration = 2800,
  rx,
  ry,
}: {
  children: React.ReactNode;
  duration?: number;
  rx?: string;
  ry?: string;
}) {
  // useRef<any> mirrors Aceternity's source: the SVG path geometry methods
  // aren't in React's RefObject typings, so we keep it loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathRef = useRef<any>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).x);
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).y);

  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div
        style={{ position: 'absolute', top: 0, left: 0, display: 'inline-block', transform }}
      >
        {children}
      </motion.div>
    </>
  );
}
