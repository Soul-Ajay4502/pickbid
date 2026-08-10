import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/seo';

// A 404 is never a page worth indexing, and without this the response would
// carry the site-wide `index: true` from the root layout.
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

const DESTINATIONS: { href: string; label: string; body: string }[] = [
  {
    href: '/leagues/discover',
    label: 'Discover public cricket leagues',
    body: 'Browse leagues other organizers have made public, or join one with a code.',
  },
  {
    href: '/cricket-auction',
    label: 'How a cricket auction works',
    body: 'Formats, budgets and the running order of a player auction.',
  },
  {
    href: '/cricket-league-management',
    label: 'Run a cricket league',
    body: 'Teams, squads, fixtures, results and the points table in one place.',
  },
  {
    href: '/tools/cricket-auction-budget-calculator',
    label: 'Cricket auction budget calculator',
    body: 'Work out per-team purses and the minimum bid your squad rules allow.',
  },
];

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 animate-fade-in-up">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        404
      </p>
      <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-4">
        We couldn&apos;t find that page
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-10">
        The link may be broken, or the league it pointed to was deleted or made
        private by its organizer. Here is where most people were heading.
      </p>

      <nav aria-label="Suggested pages">
        <ul className="space-y-4">
          {DESTINATIONS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors duration-200 hover:border-primary/30 hover:bg-card/70"
              >
                <span className="text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
                  {item.body}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-10 pt-6 border-t border-border/40 text-sm text-muted-foreground">
        Or head back to the{' '}
        <Link href="/" className="text-primary hover:underline underline-offset-2">
          {SITE_NAME} home page
        </Link>
        .
      </p>
    </div>
  );
}
