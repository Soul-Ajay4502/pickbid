'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINK_GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/leagues/discover', label: 'Discover Leagues' },
      { href: '/leaderboard', label: 'Global Leaderboard' },
      { href: '/leagues/new', label: 'Create a League' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Use' },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();
  // The auction, watch, wrapped and squad-reveal screens run as immersive
  // full-screen experiences with no app chrome
  if (
    /^\/leagues\/[^/]+\/(auction|watch|wrapped)$/.test(pathname) ||
    /^\/leagues\/[^/]+\/teams\/[^/]+\/reveal$/.test(pathname)
  ) return null;

  return (
    <footer className="border-t border-border/60 bg-card/40 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row gap-10 sm:gap-16">
          {/* Brand */}
          <div className="max-w-xs space-y-2">
            <p className="font-black text-sm tracking-tight text-gradient-green">Pickbid</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Premium cricket player cards, live auctions and leaderboards for
              your league — shared with one link. Free to start.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-16">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {group.heading}
                </p>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs text-muted-foreground/80 hover:text-foreground transition-colors duration-200"
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

        <p className="mt-10 pt-6 border-t border-border/40 text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} Pickbid. Made for cricket lovers everywhere.
        </p>
      </div>
    </footer>
  );
}
