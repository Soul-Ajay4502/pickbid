'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import {
  ChevronDown, Compass, Gavel, LayoutGrid, LogOut, Menu, Moon, Plus, Sun, Trophy, UserRound, X,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { isImmersiveLeaguePath } from '@/lib/leagueChrome';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Compass;
  isActive: (pathname: string) => boolean;
};

// Both are public; joining a league from Discover prompts sign-in.
const PRIMARY_LINKS: NavItem[] = [
  { href: '/leagues/discover', label: 'Discover', icon: Compass, isActive: (p) => p === '/leagues/discover' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, isActive: (p) => p === '/leaderboard' },
];

// The signed-in home. `proxy.ts` rewrites `/` onto `/dashboard`, and
// `usePathname` can report either depending on which side rendered — so both
// count, which is also what keeps this from being a hydration mismatch.
const MY_LEAGUES: NavItem = {
  href: '/', label: 'My Leagues', icon: LayoutGrid, isActive: (p) => p === '/' || p === '/dashboard',
};

const PROFILE: NavItem = {
  href: '/profile', label: 'Profile', icon: UserRound, isActive: (p) => p === '/profile',
};

// Whether the page has scrolled under the header. The snapshot is a boolean,
// so the header re-renders only when it flips, not on every scroll event.
function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
}
const getScrolled = () => window.scrollY > 4;
const getScrolledOnServer = () => false;

export default function NavBar() {
  const pathname = usePathname();
  // The auction, watch, wrapped, sponsors marquee and squad-reveal screens run
  // as immersive full-screen experiences with no app chrome. Shared with
  // `LeagueChrome` so the nav bar and the league rail can't disagree. Returning
  // before `SiteHeader` mounts also keeps its scroll and document listeners off
  // `/watch`, which a whole hall loads at once.
  if (isImmersiveLeaguePath(pathname)) return null;
  return <SiteHeader pathname={pathname} />;
}

function SiteHeader({ pathname }: { pathname: string }) {
  const { data: session, status } = useSession();
  const { theme, toggle } = useTheme();
  const user = status === 'authenticated' ? session.user : null;
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getScrolledOnServer);

  // The menu remembers the page it was opened on, so any navigation — a link
  // in it, the back button — closes it without an effect.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const closeMenu = () => setMenuOpenOn(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setMenuOpenOn(null);
      triggerRef.current?.focus();
    }
    // `click`, not `pointerdown`: on a phone the tap lands on the backdrop,
    // and closing on pointerdown would unmount it mid-tap and hand the click
    // to whatever was underneath.
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpenOn(null);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
    };
  }, [menuOpen]);

  const panelLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={closeMenu}
      aria-current={item.isActive(pathname) ? 'page' : undefined}
      className="rail-link"
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {item.label}
    </Link>
  );

  return (
    <>
      {/* A hairline at rest; once content slides under the bar it picks up a
          soft shadow so the edge still reads against cards of the same colour. */}
      <header
        data-scrolled={scrolled || undefined}
        className="sticky top-0 z-40 border-b border-border/50 bg-background/75 backdrop-blur-2xl transition-[box-shadow,background-color] duration-300 data-scrolled:bg-background/90 data-scrolled:shadow-[0_10px_30px_-20px_oklch(0.2_0.02_260/0.45)] dark:data-scrolled:shadow-[0_12px_32px_-18px_oklch(0_0_0/0.85)]"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 0%, oklch(0.62 0.19 150 / 0.35) 40%, oklch(0.58 0.18 220 / 0.2) 70%, transparent 100%)' }}
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">

          {/* Brand. Deliberately not wrapped in <MagneticButton>: the nav is in
              the root layout, so its imports land in the shared bundle of every
              route — that one hover effect was pulling all of Motion (~48KB
              brotli, ~142KB parsed) onto pages that never animate anything, for
              a mousemove trick that can't fire on the phones that are most of
              our traffic. The gavel's lift-and-strike below is pure CSS. */}
          <Link
            href="/"
            aria-label="Pickbid home"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-linear-135 from-green-600 via-emerald-600 to-teal-600 text-white shadow-[0_4px_14px_-4px_oklch(0.52_0.18_150/0.7)] ring-1 ring-inset ring-white/15">
              <Gavel
                className="h-4.5 w-4.5 origin-[25%_75%] transition-transform duration-200 ease-out motion-safe:group-hover:-rotate-12 motion-safe:group-active:rotate-6"
                strokeWidth={2.1}
              />
            </span>
            <span className="text-[17px] font-black tracking-tight text-foreground">Pickbid</span>
          </Link>

          {/* Desktop destinations. Below `md` they move into the menu. */}
          <nav
            aria-label="Primary"
            className="ml-3 lg:ml-5 hidden md:flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-1"
          >
            {PRIMARY_LINKS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-8 items-center gap-1.75 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 ${
                    active
                      ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border),0_1px_3px_oklch(0_0_0/0.08)] dark:bg-white/8 dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.06),0_0_0_1px_oklch(1_0_0/0.06)]'
                      : 'text-muted-foreground hover:bg-foreground/6 hover:text-foreground'
                  }`}
                >
                  <item.icon className={`w-3.75 h-3.75 shrink-0 ${active ? 'text-primary dark:text-green-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Both icons are rendered and CSS picks one off the `dark` class,
                which the inline script in the root layout sets before paint —
                reading `theme` here would show the wrong icon to light-mode
                visitors until the provider catches up. */}
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              className="hidden md:inline-flex w-9 h-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Sun className="hidden dark:block w-4 h-4" />
              <Moon className="dark:hidden w-4 h-4" />
            </button>

            {user && (
              <Link
                href="/leagues/new"
                className="btn-premium hidden md:inline-flex h-9 items-center gap-1.5 rounded-full pl-3 pr-4 text-[13px] font-semibold"
              >
                <Plus className="w-4 h-4" />
                New League
              </Link>
            )}

            {status === 'unauthenticated' && (
              <button
                type="button"
                onClick={() => signIn('google')}
                className="btn-premium inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold"
              >
                Sign in
              </button>
            )}

            {status === 'loading' && (
              <div className="w-9 h-9 rounded-full bg-muted animate-pulse" aria-hidden="true" />
            )}

            {/* The menu: account actions when signed in, plus — below `md` —
                everything the bar has no room for. A signed-out desktop visitor
                already sees all of it in the bar, so gets no trigger. */}
            {status !== 'loading' && (
              <div ref={menuRef} className={user ? 'relative' : 'relative md:hidden'}>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
                  aria-label={user ? 'Account menu' : 'Menu'}
                  aria-expanded={menuOpen}
                  aria-controls="site-menu"
                  className={
                    user
                      ? 'inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/60 pl-1 pr-2 text-muted-foreground hover:text-foreground hover:border-border transition-colors aria-expanded:text-foreground aria-expanded:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                      : 'inline-flex w-9 h-9 items-center justify-center rounded-full border border-border/60 bg-card/60 text-muted-foreground hover:text-foreground transition-colors aria-expanded:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                  }
                >
                  {user ? (
                    <>
                      <Avatar user={user} size={28} />
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                    </>
                  ) : menuOpen ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Menu className="w-4 h-4" />
                  )}
                </button>

                {menuOpen && (
                  // Full width under the bar on a phone, a dropdown from `md`.
                  // `fixed` resolves against the header, not the viewport,
                  // because the header's backdrop-filter makes it the
                  // containing block — it is pinned to the top, so the two agree.
                  <div
                    id="site-menu"
                    className="menu-panel fixed inset-x-3 top-17 max-h-[calc(100dvh-5rem)] overflow-y-auto p-1.5 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-64"
                  >
                    {user && (
                      <>
                        <div className="flex items-center gap-3 px-2.5 py-2.5">
                          <Avatar user={user} size={36} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="my-1 h-px bg-border" />
                        {panelLink(MY_LEAGUES)}
                        {panelLink(PROFILE)}
                      </>
                    )}

                    <div className="md:hidden">
                      {user && <div className="my-1 h-px bg-border" />}
                      {PRIMARY_LINKS.map(panelLink)}
                      <div className="my-1 h-px bg-border" />
                      <button type="button" onClick={toggle} className="rail-link">
                        {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                      </button>
                      {user && (
                        <Link
                          href="/leagues/new"
                          onClick={closeMenu}
                          className="btn-premium mt-1.5 mb-0.5 flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold"
                        >
                          <Plus className="w-4 h-4" />
                          New League
                        </Link>
                      )}
                    </div>

                    {user && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={() => signOut({ redirect: true, redirectTo: '/' })}
                          className="rail-link rail-link-danger"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          Sign out
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dims the page behind the phone menu. Outside the header on purpose:
          inside it, `fixed` would be trapped in the header's box by its
          backdrop-filter. Sits under the header (z-40) so the close button
          stays reachable, over the league bar (z-30). */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-16 bottom-0 z-35 bg-background/60 backdrop-blur-sm animate-fade-in"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
}

function Avatar({ user, size }: { user: NonNullable<Session['user']>; size: number }) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full ring-1 ring-border"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-linear-135 from-green-600 to-teal-600 font-bold text-white"
    >
      {initial}
    </span>
  );
}
