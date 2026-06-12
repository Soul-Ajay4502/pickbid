'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl select-none">🏏</span>
      <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        An unexpected error occurred. Try again, or head back home if it keeps happening.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => unstable_retry()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-500 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
