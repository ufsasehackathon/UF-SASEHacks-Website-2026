import Link from "next/link";
import { getCurrentRole } from "@/lib/session";
import { getCheckinSummary } from "./actions";
import { CheckinSearch } from "@/components/staff/CheckinSearch";
import { WaitlistTable } from "@/components/staff/WaitlistTable";
import { CapacityEditor } from "@/components/staff/CapacityEditor";

/** Day-of check-in (owner + staff; the /staff layout checks the role): counter, search, waitlist. Owners can edit capacity. */
export default async function StaffCheckinPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ role }, summary, { view }] = await Promise.all([getCurrentRole(), getCheckinSummary(), searchParams]);
  const { checkedIn, capacity, waitlist, error } = summary;
  const showWaitlist = view === "waitlist";

  const subTab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm transition-colors ${
      active ? "bg-[#560700] text-[#FFE4B3]" : "border border-[#560700]/30 bg-white text-[#560700] hover:bg-[#560700]/10"
    }`;

  return (
    <div className="space-y-6 font-[family-name:var(--font-body)] text-[#560700]">
      {error && (
        <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn&apos;t load all check-in numbers: {error}. Refresh before admitting anyone.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-3xl bg-white/90 px-5 py-4 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <p data-testid="checkin-counter" className="text-lg">
          <strong>{checkedIn}</strong> checked in
          {capacity !== null && (
            <>
              {" / "}
              <strong>{capacity}</strong> capacity
            </>
          )}
          {" · "}
          <strong>{waitlist.length}</strong> on waitlist
          {capacity !== null && (
            <>
              {" · "}
              <strong>{Math.max(0, capacity - checkedIn)}</strong> spots open
            </>
          )}
        </p>
        {role === "owner" && <CapacityEditor capacity={capacity} />}
      </div>

      <nav className="flex gap-2">
        <Link href="/staff/checkin" aria-current={showWaitlist ? undefined : "page"} className={subTab(!showWaitlist)}>
          Search
        </Link>
        <Link href="/staff/checkin?view=waitlist" aria-current={showWaitlist ? "page" : undefined} className={subTab(showWaitlist)}>
          Waitlist ({waitlist.length})
        </Link>
      </nav>

      {showWaitlist ? <WaitlistTable people={waitlist} /> : <CheckinSearch waitlistIds={waitlist.map(p => p.userId)} />}
    </div>
  );
}
