'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { UserCircle, Sun, Moon, LogOut, Plus, Globe } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function NavBar() {
  const { data: session, status } = useSession();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const isAuctionPage = /^\/leagues\/[^/]+\/auction$/.test(pathname);
  const isWatchPage = /^\/leagues\/[^/]+\/watch$/.test(pathname);

  // The auction runs as an immersive full-screen experience
  if (isAuctionPage || isWatchPage) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-2xl">
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, oklch(0.62 0.19 150 / 0.35) 40%, oklch(0.58 0.18 220 / 0.2) 70%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-[0_0_16px_oklch(0.62_0.19_150/0.35)] transition-shadow duration-300 group-hover:shadow-[0_0_24px_oklch(0.62_0.19_150/0.5)]"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 55%, #0d9488 100%)' }}
          >
            🏏
          </div>
          <span className="hidden sm:block font-black text-[15px] tracking-tight text-gradient-green">Cricket Cards</span>
        </Link>

        {/* Nav links (logged in) */}
        {session && (
          <nav className="flex items-center gap-1">
            <Link href="/leagues/discover"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200">
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Discover</span>
            </Link>
          </nav>
        )}

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted transition-all duration-200"
          >
            {theme === 'dark' ? <Sun className="w-3.75 h-3.75" /> : <Moon className="w-3.75 h-3.75" />}
          </button>

          {status === 'loading' ? (
            <div className="w-9 h-9 rounded-xl bg-muted animate-pulse" />
          ) : session ? (
            <div className="flex items-center gap-2">
              <Link href="/leagues/new"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/60 bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted transition-all duration-200">
                <Plus className="w-3.5 h-3.5" />New League
              </Link>
              <Link href="/profile"
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted transition-colors duration-200 group"
                title="Edit your cricket profile">
                <div className="relative">
                  {session.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={session.user.image} alt={session.user.name ?? ''}
                      className="w-7 h-7 rounded-full ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                      referrerPolicy="no-referrer" />
                  ) : (
                    <UserCircle className="w-7 h-7 text-muted-foreground" />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                </div>
                <span className="hidden md:block text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors truncate max-w-32">
                  {session.user?.name}
                </span>
              </Link>
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/60 bg-card/60 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-all duration-200"
                title="Sign out">
                <LogOut className="w-3.75 h-3.75" />
              </button>
            </div>
          ) : (
            <button onClick={() => signIn('google')}
              className="btn-premium inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold">
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
