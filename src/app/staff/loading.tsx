/**
 * Shown inside the /staff layout (tabs stay put) while a tab's server data loads, so a tab click
 * switches immediately with placeholders. In production it also lets <Link> prefetch these dynamic tabs.
 */
export default function StaffLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4 font-[family-name:var(--font-body)]">
      <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-[#560700]/10" />
      <div className="space-y-2 rounded-2xl bg-white/70 p-4 shadow">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-[#560700]/10" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
