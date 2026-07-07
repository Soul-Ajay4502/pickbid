import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/seo';

const PAGE_TITLE = 'Terms of Use';
const PAGE_DESCRIPTION =
  'The terms for using Pickbid: your account, the content you upload, fair ' +
  'use of the platform, and our responsibilities to you.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} · ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: '/terms',
    locale: 'en_US',
  },
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-2">Terms of Use</h1>
      <p className="text-xs text-muted-foreground/60 mb-8">Last updated: 7 July 2026</p>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <p>
          By using Pickbid you agree to these terms. They are deliberately short —
          Pickbid is a tool for running cricket leagues, and these terms exist to
          keep it fair and safe for everyone.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">Your account</h2>
        <p>
          You sign in with a Google account and are responsible for activity that
          happens under it. You must be able to enter into these terms under the
          laws that apply to you.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">Your content</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            League names, player details and photos you upload remain yours. You
            grant us the right to store, display and share them as needed to run
            the service — for example showing player cards to league members, or
            listing a league you made public on the Discover page.
          </li>
          <li>
            Only upload photos and details of people who are okay with them
            appearing in your league. If you make a league public, its content
            becomes visible to anyone, including search engines.
          </li>
          <li>
            Don&apos;t upload content that is unlawful, hateful or infringes
            someone else&apos;s rights. We may remove content or leagues that do.
          </li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-2">Fair use</h2>
        <p>
          Don&apos;t attempt to disrupt the service, access other people&apos;s
          private leagues, or use automated tools to scrape or overload the
          platform. Pickbid auctions use play budgets — no real-money gambling or
          wagering is offered or permitted on the platform.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">The service</h2>
        <p>
          Pickbid is provided free of charge, as-is and as-available. We work hard
          to keep it fast and reliable, but we can&apos;t guarantee uninterrupted
          availability and are not liable for lost data or indirect damages to the
          maximum extent permitted by law. We may update or discontinue features as
          the product evolves.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">Contact</h2>
        <p>
          Questions about these terms:{' '}
          <a href="mailto:arajayraj0@gmail.com" className="text-primary hover:underline underline-offset-2">
            arajayraj0@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
