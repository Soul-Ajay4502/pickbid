/**
 * Skeleton for the trophy cabinet. Besides the instant navigation feedback, it
 * is the prefetch boundary that keeps `page.tsx` — which writes — from running
 * on a mere link prefetch.
 */
export default function RewardsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10" aria-busy="true">
      <div className="space-y-3">
        <div className="h-6 w-24 rounded-full bg-muted shimmer" />
        <div className="h-9 w-64 rounded-xl bg-muted shimmer" />
        <div className="h-4 w-full max-w-xl rounded-lg bg-muted shimmer" />
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className="h-72 rounded-2xl border border-border bg-card shimmer lg:col-span-3" />
        <div className="h-72 rounded-2xl border border-border bg-card shimmer lg:col-span-2" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-52 rounded-xl border border-border bg-card shimmer" />
        ))}
      </div>
    </div>
  );
}
