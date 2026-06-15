import { cn } from '@/lib/utils';

/**
 * Aceternity UI — Bento Grid
 * Responsive masonry-style grid. Items can span multiple columns via
 * className (e.g. `md:col-span-2`). Styled to match the project's
 * premium card surface and emerald accent.
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
        'group/bento card-premium relative flex h-full flex-col justify-between overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-1',
        className,
      )}
    >
      {header}
      <div className="relative z-10 transition-transform duration-200 group-hover/bento:translate-x-1">
        {icon}
        <div className="mt-3 font-bold text-foreground">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
