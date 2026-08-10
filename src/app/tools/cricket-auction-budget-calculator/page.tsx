import Link from 'next/link';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/jsonLd';
import BudgetCalculator from './BudgetCalculator';

const PAGE_TITLE = 'Cricket Auction Budget Calculator';
const PAGE_DESCRIPTION =
  'Free cricket auction budget calculator — set your teams, squad size, purse ' +
  'and base price to get the money in play, the reserve per unfilled slot and ' +
  'the largest legal opening bid.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: '/tools/cricket-auction-budget-calculator',
});

const FAQS = [
  {
    question: 'How do I calculate a cricket auction budget?',
    answer:
      'Start from the squad size and base price: squad size × base price is the ' +
      'minimum a team must spend to fill its squad. The purse has to exceed that, ' +
      'and the difference is the money available for bidding wars. A purse of ' +
      'roughly 10 to 15 times the base price per squad slot gives teams room for ' +
      'two or three expensive players while still filling the rest.',
  },
  {
    question: 'What is the maximum bid a team can make?',
    answer:
      'A team’s legal maximum is its remaining purse minus the base price for every ' +
      'squad slot it still has to fill after the current player. On the first player ' +
      'of the auction that is purse − (squad size − 1) × base price. Capping bids ' +
      'this way makes it impossible for a team to end up unable to complete its squad.',
  },
  {
    question: 'Should every team have the same purse?',
    answer:
      'Yes, unless you have a specific reason not to. Unequal purses need justifying ' +
      'to every owner individually, and they undermine the main appeal of an auction ' +
      '— that all the sides started level.',
  },
  {
    question: 'Does the currency matter?',
    answer:
      'No. The figures are shown in rupees because that is what most leagues using ' +
      `${SITE_NAME} work in, but the arithmetic is identical in any currency, or in ` +
      'points and tokens if no real money changes hands.',
  },
];

export default function BudgetCalculatorPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <JsonLd
        data={[
          webPageSchema({
            path: '/tools/cricket-auction-budget-calculator',
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Resources', path: '/resources' },
            {
              name: 'Auction budget calculator',
              path: '/tools/cricket-auction-budget-calculator',
            },
          ]),
          faqSchema(FAQS),
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors duration-200">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/resources"
              className="hover:text-foreground transition-colors duration-200"
            >
              Resources
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground/80">Auction budget calculator</li>
        </ol>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
          Free tool
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-4">
          Cricket Auction Budget Calculator
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Set the four numbers that define your auction and check they work together
          before you publish them to team owners. Nothing is saved or sent anywhere —
          the calculation runs in your browser.
        </p>
      </header>

      <section aria-labelledby="calculator-heading" className="mt-10">
        <h2 id="calculator-heading" className="sr-only">
          Calculator
        </h2>
        <BudgetCalculator />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-3">
          Reading the results
        </h2>
        <dl className="space-y-4 border-l border-border/60 pl-5">
          <div>
            <dt className="text-sm font-semibold text-foreground">
              Minimum to fill a squad
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Squad size × base price. If a purse is below this figure the auction
              cannot complete, because some team will run out of money with slots
              still empty.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-foreground">Spare money per team</dt>
            <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Everything above the squad minimum — the money that actually gets
              competed over. Expressed as a multiple of the base price, this is the
              single best predictor of how lively the bidding will be. Under about 5×
              the auction is an orderly draft; over about 20× a couple of teams will
              spend most of their purse on two players.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-foreground">
              Largest legal opening bid
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
              The cap on the first player of the auction, holding back base price for
              every other slot. Publish this — owners plan very differently once they
              know the ceiling on a single player.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-6">
          Frequently asked questions
        </h2>
        <dl className="space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <dt className="text-sm font-semibold text-foreground">{faq.question}</dt>
              <dd className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 pt-8 border-t border-border/50">
        <h2 className="text-lg font-bold text-foreground mb-2">
          Run the auction with these numbers
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Team purses and squad sizes are league settings, and {SITE_NAME} caps each
          team&apos;s bid using the same reserve rule as above — so the limits you
          worked out here are enforced during the auction rather than remembered.
        </p>
        <Link
          href="/leagues/new"
          className="btn-premium inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          Create a cricket league
        </Link>

        <ul className="mt-8 space-y-2.5 text-sm">
          <li>
            <Link
              href="/resources/how-to-organize-cricket-auction"
              className="text-primary hover:underline underline-offset-2"
            >
              How to organize a cricket auction
            </Link>
          </li>
          <li>
            <Link
              href="/resources/cricket-auction-rules"
              className="text-primary hover:underline underline-offset-2"
            >
              Cricket auction rules to agree in advance
            </Link>
          </li>
          <li>
            <Link
              href="/tools/cricket-fixture-generator"
              className="text-primary hover:underline underline-offset-2"
            >
              Generate your league fixtures
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
