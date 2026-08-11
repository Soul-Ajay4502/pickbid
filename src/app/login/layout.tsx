import type { Metadata } from 'next';
import { NOINDEX_METADATA } from '@/lib/seo';

/**
 * `/login` is a client component, so it cannot export metadata itself and was
 * falling back to the site-wide default title. It is already disallowed in
 * `robots.txt`; the noindex here is belt-and-braces, and the title is what
 * matters — it shows in the tab and in any link preview of a shared sign-in URL.
 */
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'Sign In',
  description: 'Sign in to Pickbid with your Google account to create and manage cricket leagues.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
