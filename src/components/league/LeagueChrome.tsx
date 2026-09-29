'use client';

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { isImmersiveLeaguePath } from '@/lib/leagueChrome';
import LeagueSidebar from './LeagueSidebar';
import type { LeagueNavSummary } from '@/lib/types';

/**
 * Bumped whenever the sidebar mutates the league. Pages in the content column
 * fetch their own data, so without a signal they'd keep rendering the state
 * from before a template change or a Make Public — `useLeagueRevision()` is how
 * they hear about it.
 */
const LeagueRevisionContext = createContext(0);

/**
 * Subscribe to league-level changes made from the sidebar. Put the returned
 * number in a `useEffect` dependency list next to your fetch.
 */
export function useLeagueRevision(): number {
  return useContext(LeagueRevisionContext);
}

/** The document's own scroller: what a page outside the league chrome uses. */
function documentScroller(): HTMLElement {
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

const LeagueScrollContext = createContext<() => HTMLElement>(documentScroller);

/**
 * Returns a getter for the element a league screen scrolls in. From `lg` up
 * that is the inset panel, which scrolls on its own while the rail and the nav
 * bar stay put, so `window.scrollY` stays 0 and `window.scrollTo` does
 * nothing there. Below `lg` the panel is plain flow and the document scrolls
 * as usual. Call the getter each time rather than caching what it returns:
 * resizing across the breakpoint swaps one for the other.
 *
 * The panel's `scroll` events don't bubble, so to hear both cases listen on
 * `document` with `capture: true` — see LeagueWorkspace's scroll buttons.
 */
export function useLeagueScroller(): () => HTMLElement {
  return useContext(LeagueScrollContext);
}

/**
 * Frames every `/leagues/[id]/*` screen with the league navigation rail.
 *
 * Rendered from the league layout, so one mount survives navigation between
 * league screens — the rail doesn't re-fetch or flash as you move around, and
 * the summary it draws from is a handful of scalars (see
 * `api/leagues/[id]/nav`), not the roster.
 *
 * Immersive screens — the auction console, the watch board, Wrapped, the
 * sponsor marquee, the squad reveal — get `children` bare, with no fetch at
 * all. That matters most on `/watch`, which a whole hall loads at once: the
 * early return below is what keeps the rail's request off that path.
 */
export default function LeagueChrome({
  leagueId,
  leagueName,
  children,
}: {
  leagueId: string;
  /**
   * The name the layout already read, so the rail's pinned header is in the
   * server HTML. Waiting for the summary instead made it appear late and push
   * the whole rail down — a layout shift on every league screen.
   */
  leagueName: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveLeaguePath(pathname);

  const panelRef = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState<LeagueNavSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    if (immersive) return;
    fetch(`/api/leagues/${leagueId}/nav`)
      .then((r) => (r.ok ? r.json() : null))
      // An error body is an object too — only a real summary carries an id.
      .then((d) => { if (d?.id) setNav(d); })
      .catch(() => { /* keep the last known rail rather than blanking it */ });
  }, [leagueId, immersive]);

  useEffect(() => { refresh(); }, [refresh]);

  const notifyChanged = useCallback(() => setRevision((r) => r + 1), []);

  // Close the drawer on Escape. Nothing closes it on navigation, because
  // nothing needs to: it covers the page, so the only links reachable while
  // it's open are its own, and every one of those calls `onNavigate`.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    // The drawer covers the page, so the page behind it must not scroll with it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  // Start each league screen at the top of the panel. Next only scrolls on
  // navigation when the new page's top is off screen, and it resets the
  // document, not this panel — so after a short scroll the next screen would
  // open partway down. A layout effect, so the old offset never paints.
  useLayoutEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // What `useLeagueScroller` hands out. The panel only scrolls from `lg` up —
  // below that its overflow is `visible` and the document is the scroller.
  const getScroller = useCallback((): HTMLElement => {
    const el = panelRef.current;
    if (el && getComputedStyle(el).overflowY !== 'visible') return el;
    return documentScroller();
  }, []);

  if (immersive) return <>{children}</>;

  // The summary is fresher — it follows a rename made from the rail itself.
  const name = nav?.name ?? leagueName;

  const sidebar = nav && (
    <LeagueSidebar
      leagueId={leagueId}
      nav={nav}
      refresh={refresh}
      notifyChanged={notifyChanged}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <LeagueRevisionContext.Provider value={revision}>
    <LeagueScrollContext.Provider value={getScroller}>
      {/* Mobile league bar. The rail is behind a button under `lg`, so this is
          also where the league's name lives on a phone — the content column
          below is full width. */}
      <div className="lg:hidden sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 h-12">
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 -ml-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open league menu"
            aria-expanded={drawerOpen}
          >
            <Menu className="w-4 h-4" />
            Menu
          </button>
          <span className="min-w-0 truncate text-sm font-bold text-foreground/80">
            {name ?? ''}
          </span>
        </div>
      </div>

      {/* Inset layout on desktop: the rail sits flat on the `--sidebar` tint
          and the page is the raised panel beside it. The tint is on this
          full-width wrapper, not the capped row inside, so an ultrawide
          monitor shows tint either side instead of a band of page background.
          Under `lg` there is no rail, so there is no tint and no panel. */}
      <div className="lg:bg-sidebar">
        {/* Capped and centred: without a max width the rail would sit against
            the left edge of an ultrawide monitor while the content drifted
            away from it. 96rem leaves room for the rail plus the `max-w-7xl`
            the league page already uses.

            From `lg` up the row is exactly the viewport below the nav bar, so
            the document never scrolls; the panel does instead. The height is
            the nav bar's `h-16` plus its 1px `border-b` — a pixel short and
            the window grows a scrollbar for that one pixel. */}
        <div className="mx-auto flex w-full max-w-[96rem] lg:h-[calc(100dvh-4rem-1px)]">
          {/* Desktop rail. It fills the fixed-height row, so it stays put
              without being sticky, and scrolls on its own once the groups
              outrun the viewport. */}
          <aside className="hidden lg:block w-60 shrink-0">
            {/* A fixed-height flex column, not a max-height block: the header
                below has to stay put while only the nav scrolls, and `flex-1`
                can't size against a max-height. */}
            <div className="h-full flex flex-col py-6 pl-4 pr-2 xl:pl-6">
              {/* Pinned. Which league you're in is the one thing that must
                  never scroll away — it's the only place the name appears once
                  the page header is out of view. */}
              <div className="shrink-0 pr-2">
                <Link
                  href="/"
                  className="rail-link mb-3 text-muted-foreground hover:text-foreground group"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                  All Leagues
                </Link>
                {name && (
                  <p className="px-3 pb-4 mb-1 text-sm font-black tracking-tight text-gradient-green line-clamp-2 border-b border-border/50">
                    {name}
                  </p>
                )}
              </div>

              {/* `min-h-0` lets this shrink below its content inside the flex
                  column — without it the box grows and the page scrolls instead. */}
              <div className="rail-scroll min-h-0 flex-1 pt-3 pr-1">
                {nav ? sidebar : (
                  <div className="flex flex-col gap-2 px-3" aria-hidden="true">
                    {[...Array(7)].map((_, i) => (
                      <div key={i} className="h-7 rounded-lg bg-sidebar-accent shimmer" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* The inset panel, and from `lg` up the page's scroller: only this
              box scrolls, inside its rounded frame, while the rail and the nav
              bar stay put. Two consequences for pages rendered in it. A
              `position: sticky` offset beneath it is measured from the panel's
              top edge, not the viewport's. And `window.scrollTo` no longer
              reaches the page — go through `useLeagueScroller`. Its background
              is `--background` rather than `--card`, so every page's own cards
              keep the contrast they were designed with. */}
          <div
            ref={panelRef}
            className="inset-scroll min-w-0 flex-1 lg:my-2 lg:mr-2 lg:overflow-y-auto lg:rounded-xl lg:border lg:border-sidebar-border/60 lg:bg-background lg:shadow-sm"
          >
            {children}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-fade-in-up"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="League menu"
            className="relative w-72 max-w-[85vw] h-full flex flex-col border-r border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl animate-slide-in-left"
          >
            <div className="shrink-0 flex items-start justify-between gap-2 mb-4">
              <p className="px-3 text-sm font-black tracking-tight text-gradient-green line-clamp-2">
                {name ?? 'League'}
              </p>
              <button
                onClick={() => setDrawerOpen(false)}
                className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close league menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Link
              href="/"
              onClick={() => setDrawerOpen(false)}
              className="rail-link shrink-0 mb-3 pb-3 text-muted-foreground hover:text-foreground border-b border-border/50"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              All Leagues
            </Link>
            <div className="rail-scroll min-h-0 flex-1 pr-1">{sidebar}</div>
          </div>
        </div>
      )}
    </LeagueScrollContext.Provider>
    </LeagueRevisionContext.Provider>
  );
}
