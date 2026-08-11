import { buildPageMetadata } from '@/lib/seo';

const PAGE_TITLE = 'Privacy Policy';
const PAGE_DESCRIPTION =
  'How Pickbid handles your data: what we collect when you sign in with ' +
  'Google, how league and player information is stored and shared, and the ' +
  'choices you have.';

export const metadata = buildPageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 animate-fade-in-up">
      <h1 className="text-3xl font-black tracking-tight text-gradient-green mb-2">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground/60 mb-8">Last updated: 7 July 2026</p>

      <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-bold text-foreground">What we collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Account information.</strong> When you
            sign in with Google we receive your name, email address and profile
            photo. We use these to identify your account and show who created or
            joined a league. We never see your Google password.
          </li>
          <li>
            <strong className="text-foreground">League content.</strong> League names,
            team details, player names, roles, stats and player photos that you or
            your league organizer add to the platform.
          </li>
          <li>
            <strong className="text-foreground">Usage data.</strong> We use Vercel
            Analytics and Speed Insights to understand aggregate usage and
            performance. This data is anonymized and does not build advertising
            profiles.
          </li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-2">How your content is shared</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Public leagues</strong> are visible to
            anyone: they appear on the Discover page, can be found through search
            engines, and their league name and organizer name may appear in search
            results and on the Global Leaderboard.
          </li>
          <li>
            <strong className="text-foreground">Private leagues</strong> are reachable
            only by people who have the link or join code, and we ask search
            engines not to index them.
          </li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-2">Where data lives</h2>
        <p>
          The app is hosted on Vercel, league data is stored in a managed
          PostgreSQL database, and player photos are stored with Cloudinary. A
          session cookie keeps you signed in; your theme preference is stored in
          your browser. We do not sell your data, and we do not run third-party
          advertising.
        </p>

        <h2 className="text-lg font-bold text-foreground pt-2">Your choices</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>League creators can edit or delete their leagues, players and teams at any time.</li>
          <li>You can switch a league between public and private in its settings at any time.</li>
          <li>Signing out removes the session from your browser.</li>
          <li>
            To request deletion of your account and associated data, contact us at
            the address below.
          </li>
        </ul>

        <h2 className="text-lg font-bold text-foreground pt-2">Contact</h2>
        <p>
          Questions about this policy or your data:{' '}
          <a href="mailto:arajayraj0@gmail.com" className="text-primary hover:underline underline-offset-2">
            arajayraj0@gmail.com
          </a>
          .
        </p>

        <p className="pt-2 text-xs text-muted-foreground/60">
          We may update this policy as the product evolves; material changes will be
          reflected on this page with a new date.
        </p>
      </div>
    </div>
  );
}
