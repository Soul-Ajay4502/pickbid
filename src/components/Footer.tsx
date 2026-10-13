'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Anchor text is the label, so each one describes its destination on its own —
// these are the site's primary internal links for both visitors and crawlers.
const LINK_GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/leagues/discover', label: 'Discover Leagues' },
      { href: '/leaderboard', label: 'Global Leaderboard' },
      { href: '/leagues/new', label: 'Create a League' },
    ],
  },
  {
    heading: 'Cricket',
    links: [
      { href: '/cricket-auction', label: 'Cricket Auction' },
      { href: '/online-cricket-auction', label: 'Online Cricket Auction' },
      { href: '/cricket-league-management', label: 'League Management' },
      { href: '/cricket-tournament-management', label: 'Tournament Management' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '/resources/how-to-organize-cricket-auction', label: 'Auction Guide' },
      { href: '/resources/cricket-auction-rules', label: 'Auction Rules' },
      { href: '/tools/cricket-auction-budget-calculator', label: 'Budget Calculator' },
      { href: '/tools/cricket-fixture-generator', label: 'Fixture Generator' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/faq', label: 'FAQ' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Use' },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  // The auction, watch, wrapped, sponsors marquee and squad-reveal screens run
  // as immersive full-screen experiences with no app chrome
  if (
    /^\/leagues\/[^/]+\/(auction|watch|wrapped|sponsors)$/.test(pathname) ||
    /^\/leagues\/[^/]+\/teams\/[^/]+\/reveal$/.test(pathname)
  ) return null;

  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          {/* Brand. `lp-display` is the landing's serif — the footer only
              renders inside `.landing-scope`, which is where that font loads. */}
          <div className="max-w-xs">
            <p className="lp-display text-3xl">Pickbid</p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Player cards, live auctions and league tables for cricket leagues
              of every size — shared with one link. Free to start.
            </p>
          </div>

          {/* Link columns — a grid rather than a row, so four columns wrap on
              narrow screens instead of scrolling the page sideways. */}
          <div className="grid flex-1 grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-10">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
                  {group.heading}
                </p>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-foreground/75 hover:text-foreground transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-border flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Pickbid</p>
          <p>Made for cricket lovers everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
