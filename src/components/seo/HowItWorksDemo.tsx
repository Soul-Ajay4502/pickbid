'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * The screenshot walkthrough on /how-it-works: one real screen per step, in a
 * browser frame, stepped through with tabs or the arrows.
 *
 * The images are static files in `public/how-it-works/`, captured from a real
 * public league — never mock-ups. They are all 1920×1200 (a 1280×800 window at
 * 1.5×), which is what `SHOT_W`/`SHOT_H` reserve so nothing shifts as they
 * load. To refresh one, replace the file at the same size; to add a step, add
 * it to the page's `STEPS` and drop its image alongside the others.
 */

export type DemoStep = {
  /** Step title, shared with the written list further down the page. */
  name: string;
  /** File name inside `public/how-it-works/`. */
  image: string;
  /** What the screenshot actually shows — also its alt text. */
  caption: string;
};

const SHOT_W = 1920;
const SHOT_H = 1200;

/**
 * `host` comes from the server page rather than an import of `SITE_HOST` here:
 * this is a client component, and `seo.ts` resolves the host partly from a
 * server-only env var, so the client could compute a different string and
 * fail hydration.
 */
export default function HowItWorksDemo({
  steps,
  source,
  host,
}: {
  steps: DemoStep[];
  source: string;
  host: string;
}) {
  const [active, setActive] = useState(0);
  const step = steps[active];
  const go = (i: number) => setActive((i + steps.length) % steps.length);

  return (
    <section aria-label="Product walkthrough" className="mt-10 lg:-mx-24">
      {/* Step tabs — scroll sideways on a phone rather than wrapping */}
      <div role="tablist" aria-label="Steps" className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none]">
        {steps.map((s, i) => (
          <button
            key={s.name}
            role="tab"
            id={`demo-tab-${i}`}
            aria-selected={i === active}
            aria-controls="demo-panel"
            onClick={() => setActive(i)}
            className={`shrink-0 inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-xs font-semibold transition-colors ${
              i === active
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] tabular-nums ${
              i === active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </span>
            {s.name}
          </button>
        ))}
      </div>

      <figure id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`} className="m-0">
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl shadow-black/10">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-muted/50" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
            <span className="ml-3 text-[11px] text-muted-foreground truncate">{host}</span>
          </div>
          {/* Every shot stays mounted so stepping is instant once loaded; only
              the first is fetched eagerly, the rest when the browser is idle */}
          <div className="relative" style={{ aspectRatio: `${SHOT_W} / ${SHOT_H}` }}>
            {steps.map((s, i) => (
              <Image
                key={s.image}
                src={`/how-it-works/${s.image}`}
                alt={i === active ? s.caption : ''}
                aria-hidden={i !== active}
                width={SHOT_W}
                height={SHOT_H}
                sizes="(min-width: 1024px) 960px, 100vw"
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4">
          <figcaption className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">
              Step {active + 1} of {steps.length} — {step.name}.
            </span>{' '}
            {step.caption}
          </figcaption>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => go(active - 1)}
              aria-label="Previous step"
              className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => go(active + 1)}
              aria-label="Next step"
              className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/70">{source}</p>
      </figure>
    </section>
  );
}
