import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import Providers from '@/components/Providers';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  TITLE_TEMPLATE,
  SITE_DESCRIPTION,
  SHORT_DESCRIPTION,
  SITE_KEYWORDS,
  AUTHOR,
  BRAND,
} from '@/lib/seo';
import {
  JsonLd,
  websiteSchema,
  organizationSchema,
  softwareApplicationSchema,
} from '@/lib/jsonLd';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [AUTHOR],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  category: 'sports',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SHORT_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SHORT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  other: { 'mobile-web-app-capable': 'yes' },
  // Add a Google Search Console token by setting GOOGLE_SITE_VERIFICATION.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: BRAND.green },
  ],
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Site-wide structured data. Every page inherits these three entities, and
 * page-level schemas reference them by `@id` instead of redeclaring them.
 */
const siteJsonLd = [
  websiteSchema(),
  organizationSchema(),
  softwareApplicationSchema([
    'Cricket player auctions with team budgets',
    'Premium cricket player cards',
    'Real-time live auctions',
    'Live leaderboards and squad analytics',
    'Public watch mode for fans',
    'Teams, budgets and officials management',
    'Fixtures, results and points table',
    'One-tap PDF squad sheets and WhatsApp sharing',
    'Auction Wrapped recap stories',
    'Holographic pack-opening squad reveals',
  ]),
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent flash: apply stored theme before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <JsonLd data={siteJsonLd} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-green-500/25 selection:text-green-100">
        <Providers>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Toaster richColors position="top-right" />
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
