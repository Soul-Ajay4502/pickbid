'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Trophy } from 'lucide-react';

// Friendly copy for the error codes Auth.js can redirect here with. Anything
// unmapped falls back to the generic line.
const ERROR_MESSAGES: Record<string, string> = {
  MissingCSRF: 'Your session expired before sign-in finished. Please try again.',
  OAuthSignin: "Couldn't start sign-in with Google. Please try again.",
  OAuthCallback: "Couldn't complete sign-in with Google. Please try again.",
  AccessDenied: 'Access was denied. Please try again with your Google account.',
  Configuration: 'Sign-in is temporarily unavailable. Please try again shortly.',
};

// Google "G" mark — inline so it works offline / behind a strict CSP.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);

  // Only allow same-site relative callbacks — never an absolute URL from the
  // query string (open-redirect guard). The proxy always sets a relative path.
  const rawCallback = params.get('callbackUrl') ?? '/';
  const callbackUrl = rawCallback.startsWith('/') ? rawCallback : '/';
  const errorCode = params.get('error');
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? 'Unable to sign in. Please try again.'
    : null;

  // Already signed in (e.g. landed here with a live session) → skip the page.
  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl);
  }, [status, callbackUrl, router]);

  function handleSignIn() {
    setLoading(true);
    // Client-side signIn fetches a fresh CSRF token in the same cycle, so the
    // `__Host-authjs.csrf-token` cookie is guaranteed present for the POST.
    signIn('google', { callbackUrl });
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-in-up">

        {/* Brand mark */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-green-500/20 to-emerald-600/20 border border-green-500/20 flex items-center justify-center mb-4">
            <Trophy className="w-6 h-6 text-green-500 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gradient-green">Sign in to Player Hunt</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Continue with your Google account to create and manage leagues.
          </p>
        </div>

        {/* Error banner (Auth.js redirects here with ?error=…) */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {/* Sign-in card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <button
            onClick={handleSignIn}
            disabled={loading || status === 'loading'}
            className="w-full inline-flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-background font-semibold text-sm text-foreground hover:bg-muted transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
            By continuing you agree to our{' '}
            <a href="/terms" className="underline hover:text-foreground transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary to keep the page prerenderable.
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
