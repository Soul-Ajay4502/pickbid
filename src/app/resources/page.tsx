import Link from 'next/link';
import { BookOpen, Calculator, CalendarRange, ScrollText } from 'lucide-react';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import { JsonLd, webPageSchema, breadcrumbSchema, itemListSchema } from '@/lib/jsonLd';

const PAGE_TITLE = 'Cricket Organizer Resources';
const PAGE_DESCRIPTION =
  'Guides and free tools for cricket organizers — how to run a player auction, ' +
  'auction rules to agree in advance, a budget calculator and a fixture generator.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: '/resources',
});

type Resource = {
  href: string;
  label: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
};

const GUIDES: Resource[] = [
  {
    href: '/resources/how-to-organize-cricket-auction',
    label: 'How to organize a cricket auction',
    body:
      'A run sheet working backwards from auction night: when to open registration, ' +
      'how to set purses and base prices, the order to run the evening in, and the ' +
      'three things that go wrong every time.',
    icon: BookOpen,
  },
  {
    href: '/resources/cricket-auction-rules',
    label: 'Cricket auction rules',
    body:
      'A complete set of rules to adapt and send to your team owners — purses, bid ' +
      'increments, squad minimums, icon players, unsold rounds and the tie-breaks ' +
      'that have stalled real auctions.',
    icon: ScrollText,
  },
];

const TOOLS: Resource[] = [
  {
    href: '/tools/cricket-auction-budget-calculator',
    label: 'Cricket auction budget calculator',
    body:
      'Enter your teams, squad size, purse and base price. Get the total money in ' +
      'play, the reserve each team must hold per unfilled slot, and the largest ' +
      'opening bid a team can legally make.',
    icon: Calculator,
  },
  {
    href: '/tools/cricket-fixture-generator',
    label: 'Cricket fixture generator',
    body:
      'Paste your team names and get a round-robin schedule, single or double leg, ' +
      'with each team’s matches spread across the rounds so nobody plays twice in a row.',
    icon: CalendarRange,
  },
];

function ResourceList({ items }: { items: Resource[] }) {
  return (
    <ul className="space-y-4">
      {items.map(({ href, label, body, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className="flex gap-4 rounded-xl border border-border/60 bg-card/40 p-5 transition-colors duration-200 hover:border-primary/30 hover:bg-card/70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{label}</span>
              <span className="mt-1.5 block text-sm text-muted-foreground leading-relaxed">
                {body}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ResourcesPage() {
  const all = [...GUIDES, ...TOOLS];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <JsonLd
        data={[
          webPageSchema({
            path: '/resources',
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Resources', path: '/resources' },
          ]),
          itemListSchema({
            name: 'Cricket organizer guides and tools',
            items: all.map((item) => ({ name: item.label, path: item.href })),
          }),
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors duration-200">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground/80">Resources</li>
        </ol>
      </nav>

      <header>
        <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-4">
          Cricket Organizer Resources
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Everything here comes out of running amateur cricket auctions and leagues
          and getting them wrong first. The guides are free to copy and adapt; the
          tools work in your browser with nothing to sign up for.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-5">Guides</h2>
        <ResourceList items={GUIDES} />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-2">Free tools</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          No account, no sign-in — they run entirely in your browser.
        </p>
        <ResourceList items={TOOLS} />
      </section>

      <section className="mt-14 pt-8 border-t border-border/50">
        <h2 className="text-lg font-bold text-foreground mb-2">Ready to run yours?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {SITE_NAME} handles the auction and the season that follows it — free.{' '}
          <Link href="/leagues/new" className="text-primary hover:underline underline-offset-2">
            Create a cricket league
          </Link>
          , or read how{' '}
          <Link href="/cricket-auction" className="text-primary hover:underline underline-offset-2">
            a cricket auction works
          </Link>{' '}
          first.
        </p>
      </section>
    </div>
  );
}
