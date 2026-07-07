import { cn } from '@/lib/utils';

/**
 * Aceternity UI — Bento Grid
 * Responsive masonry-style grid. Items can span multiple columns via
 * className (e.g. `md:col-span-2`). Surfaces are deliberately quiet —
 * hairline border, flat card, no glow — to match the landing's art
 * direction.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 md:auto-rows-[15rem] lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'group/bento relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-5 transition-colors duration-200 hover:border-foreground/20',
        className,
      )}
    >
      {header}
      <div className="relative z-10">
        {icon}
        <div className="mt-3 text-[15px] font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
