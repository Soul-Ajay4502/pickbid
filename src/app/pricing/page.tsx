import Link from 'next/link';
import { Check } from 'lucide-react';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/jsonLd';

const PAGE_PATH = '/pricing';
const PAGE_TITLE = 'Pricing';
const PAGE_DESCRIPTION =
  'Pickbid is free. Run unlimited cricket leagues, player cards, live auctions ' +
  'and leaderboards at no cost — no credit card, no trial period and no paid ' +
  'tier to upgrade to.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: PAGE_PATH,
});

// Everything the free plan covers. Kept in one list so the page and the
// structured data below can never drift apart.
const INCLUDED = [
  'Unlimited leagues, players and teams',
  'Premium player cards across 12 colour templates',
  'Real-time live auctions with budgets and icon players',
  'Public watch mode for spectators',
  'League and global leaderboards',
  'Squad, team and officials management',
  'PDF squad sheets and one-tap WhatsApp sharing',
  'Match fixtures, scores and results',
  'League ledger for income and expenses',
  'Auction Wrapped recap and squad reveals',
  'Sponsor marquee display board',
  'One-link sharing and a public league directory',
];

const FAQS = [
  {
    q: `Is ${SITE_NAME} really free?`,
    a:
      `Yes. Every feature is available at no cost, and there is no paid plan to ` +
      `upgrade to. You do not need to enter a card to use anything on the site.`,
  },
  {
    q: 'Is there a limit on leagues, players or auctions?',
    a:
      `No. You can create as many leagues as you like, add as many players as ` +
      `your league needs and run as many auctions as you want. Nothing is ` +
      `metered or capped.`,
  },
  {
    q: 'Do I need to install an app?',
    a:
      `No. ${SITE_NAME} runs in any modern browser on phone, tablet or desktop. ` +
      `Spectators can follow a live auction from a shared link without signing in.`,
  },
  {
    q: 'What do I need to sign up?',
    a:
      `A Google account, which is the only sign-in method. Players can be given ` +
      `a link to build their own card without an account at all.`,
  },
  {
    q: 'Is any real money involved in the auctions?',
    a:
      `No. Auctions use the budget you set for each team inside your league. ` +
      `${SITE_NAME} does not process payments and is not a betting product.`,
  },
];

// Page structured data. The site-wide SoftwareApplication offer (price 0) is
// already declared in the root layout, so this page only adds its own Q&As —
// each one rendered visibly in the FAQ section below.
const schemas = [
  webPageSchema({
    path: PAGE_PATH,
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  }),
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: PAGE_TITLE, path: PAGE_PATH },
  ]),
  faqSchema(FAQS.map((faq) => ({ question: faq.q, answer: faq.a }))),
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={schemas} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
        <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-3">
          Pricing
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          {SITE_NAME} is free. Run your whole league — player cards, live auction,
          leaderboards and sharing — without paying for anything.
        </p>

        {/* The one and only plan */}
        <div className="card-premium p-6 mb-10">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-foreground">Free</span>
            <span className="text-sm text-muted-foreground">every feature included</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            No credit card &middot; No trial period &middot; No paid tier
          </p>

          <ul className="mt-6 space-y-2.5">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/leagues/new"
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90"
          >
            Create your league
          </Link>
        </div>

        <h2 className="text-lg font-bold text-foreground mb-5">Frequently asked questions</h2>
        <div className="space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{faq.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground leading-relaxed">
          See what is included in more detail on the{' '}
          <Link href="/features" className="text-primary hover:underline underline-offset-2">
            features page
          </Link>
          , or browse{' '}
          <Link href="/leagues/discover" className="text-primary hover:underline underline-offset-2">
            public leagues
          </Link>{' '}
          already running on {SITE_NAME}.
        </p>
      </div>
    </>
  );
}
