'use client';

import { signIn } from 'next-auth/react';

/**
 * The landing's only interactive element. Kept as its own client island so the
 * rest of the page can stay a server component and ship no JavaScript.
 */
export default function SignInButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => signIn('google')} className={className}>
      {children}
    </button>
  );
}
