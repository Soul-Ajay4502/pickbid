import Link from 'next/link';
import { SITE_NAME, buildPageMetadata } from '@/lib/seo';
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
  faqSchema,
} from '@/lib/jsonLd';
import FixtureGenerator from './FixtureGenerator';

const PAGE_TITLE = 'Cricket Fixture Generator';
const PAGE_DESCRIPTION =
  'Free cricket fixture generator — paste your team names and get a round-robin ' +
  'schedule, single or home-and-away, with each team playing at most once per round.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: '/tools/cricket-fixture-generator',
});

const FAQS = [
  {
    question: 'How many matches are in a cricket round robin?',
    answer:
      'For N teams playing each other once, N×(N−1)/2 matches — six for four ' +
      'teams, ten for five, fifteen for six and twenty-eight for eight. Playing ' +
      'home and away doubles it.',
  },
  {
    question: 'How many rounds will my tournament need?',
    answer:
      'An even number of teams needs N−1 rounds, with every team playing in each ' +
      'round. An odd number needs N rounds, because one team rests each round. The ' +
      'generator shows which team is resting so you can plan the ground bookings.',
  },
  {
    question: 'Can a team end up playing twice in a row?',
    answer:
      'No. The schedule is built with the circle method, which guarantees each team ' +
      'appears at most once per round. Run the rounds in the order given and no side ' +
      'plays back-to-back matches.',
  },
  {
    question: 'Can I use this for a knockout tournament?',
    answer:
      'This generator produces round-robin schedules. For a knockout, the match count ' +
      'is simply N−1 for N teams, and the usual approach for a one-day event is two ' +
      'round-robin groups feeding semi-finals — generate a schedule per group and add ' +
      'the semi-finals and final yourself.',
  },
  {
    question: 'Does it handle an odd number of teams?',
    answer:
      'Yes. With an odd count, one team rests in each round and the generator names ' +
      'it, so nobody is accidentally scheduled into a fixture that does not exist.',
  },
];

export default function FixtureGeneratorPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <JsonLd
        data={[
          webPageSchema({
            path: '/tools/cricket-fixture-generator',
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Resources', path: '/resources' },
            { name: 'Fixture generator', path: '/tools/cricket-fixture-generator' },
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
          <li className="text-foreground/80">Fixture generator</li>
        </ol>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
          Free tool
        </p>
        <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-4">
          Cricket Fixture Generator
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Paste your team names and get a complete round-robin schedule. Every team
          plays every other, and no team plays twice in the same round — which is what
          makes the list usable for a one-day or one-weekend tournament.
        </p>
      </header>

      <section aria-labelledby="generator-heading" className="mt-10">
        <h2 id="generator-heading" className="sr-only">
          Generator
        </h2>
        <FixtureGenerator />
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-bold text-foreground mb-3">
          How the schedule is built
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The rounds come from the circle method: one team is held in place while the
          rest rotate around it. That is what guarantees the two properties you need —
          every pair meets exactly once, and no team appears twice in a single round.
          With an odd number of teams a placeholder opponent is added, so exactly one
          team rests per round and the generator tells you which.
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Which side is listed first alternates between rounds, so if you are using the
          first-named team as the home side or the one batting first, that duty is
          shared out rather than always falling to the same teams.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-3">
          Fitting the schedule into your day
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Once you know the match count, work backwards from sunset rather than forwards
          from the opening ceremony. Divide the daylight you have by the number of
          matches, subtract ten minutes per changeover, and that is your overs per
          innings — not the other way round. A round robin between eight teams is
          twenty-eight matches, which is a two-day event on one ground however short you
          make the innings.
        </p>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          If the count is too high for the time available, switch format rather than
          shortening matches further:{' '}
          <Link
            href="/cricket-tournament-management"
            className="text-primary hover:underline underline-offset-2"
          >
            groups plus a knockout
          </Link>{' '}
          cuts the match count sharply and still ends with a final.
        </p>
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
          Track the results too
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Record these fixtures in a {SITE_NAME} league and the points table builds
          itself as you enter each result — two points for a win, one for a tie or no
          result — on a page you can share with every player.
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
              href="/cricket-tournament-management"
              className="text-primary hover:underline underline-offset-2"
            >
              Cricket tournament management — formats and scheduling
            </Link>
          </li>
          <li>
            <Link
              href="/cricket-league-management"
              className="text-primary hover:underline underline-offset-2"
            >
              Cricket league management — squads, results and the table
            </Link>
          </li>
          <li>
            <Link
              href="/tools/cricket-auction-budget-calculator"
              className="text-primary hover:underline underline-offset-2"
            >
              Cricket auction budget calculator
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
