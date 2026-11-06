import Link from "next/link";
import { fetchStaffStats } from "./actions";
import { roleLabels } from "@/lib/roles";
import { getCurrentRole } from "@/lib/session";
import { EVENT_CAPACITY } from "@/lib/constants";
import { registrationStatuses, registrationStatusLabels } from "@/lib/validation";
import HackerLookup from "@/components/staff/HackerLookup";
import { Card, PageShell, StatTile } from "@/components/staff/Card";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [{ role }, statsRes] = await Promise.all([getCurrentRole(), fetchStaffStats()]);
  const isOwner = role === "owner";
  const stats = statsRes.ok ? statsRes.stats : null;
  const sortedEntries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  return (
    <PageShell title="Staff Dashboard" subtitle={<>Signed in as {role ? roleLabels[role] : "staff"}</>}>
      {isOwner && (
        <div className="flex flex-wrap gap-3 font-[family-name:var(--font-body)]">
          {[
            { href: "/admin", label: "Review applications" },
            { href: "/staff/roles", label: "Manage roles" },
            { href: "/staff/judging", label: "Judging" },
          ].map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] shadow-lg hover:shadow-xl transition-all"
            >
              {l.label} →
            </Link>
          ))}
        </div>
      )}

      {!stats ? (
        <Card title="Stats"><p className="text-sm text-red-700">{statsRes.ok ? "" : statsRes.error}</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatTile label="Checked in" value={`${stats.checkedIn} / ${stats.counts.confirmed}`} />
            <StatTile label="Confirmed" value={stats.counts.confirmed} />
            <StatTile label="Accepted (no RSVP)" value={stats.counts.accepted} />
            <StatTile label="To review" value={stats.counts.pending} />
            <StatTile label="Waitlist" value={stats.counts.waitlist} />
            <StatTile label={`Spots left (of ${EVENT_CAPACITY})`} value={EVENT_CAPACITY - stats.counts.accepted - stats.counts.confirmed} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Applications" subtitle={`${stats.total} accounts`}>
              <ul className="font-[family-name:var(--font-body)] text-sm space-y-1">
                {registrationStatuses.map(st => (
                  <li key={st} className="flex justify-between"><span>{registrationStatusLabels[st]}</span><span className="font-semibold">{stats.counts[st]}</span></li>
                ))}
              </ul>
            </Card>
            <Card title="T-shirts" subtitle="Confirmed hackers">
              <ul className="font-[family-name:var(--font-body)] text-sm space-y-1">
                {sortedEntries(stats.tshirts).map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{v}</span></li>
                ))}
                {Object.keys(stats.tshirts).length === 0 && <li className="text-gray-500">No confirmed hackers yet</li>}
              </ul>
            </Card>
            <Card title="Dietary" subtitle={`Confirmed hackers · ${stats.accessibilityNotes} with accessibility notes`}>
              <ul className="font-[family-name:var(--font-body)] text-sm space-y-1">
                {sortedEntries(stats.dietary).filter(([k]) => k !== "none").map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{v}</span></li>
                ))}
                {sortedEntries(stats.dietary).filter(([k]) => k !== "none").length === 0 && <li className="text-gray-500">No restrictions yet</li>}
              </ul>
            </Card>
          </div>
        </>
      )}

      <Card title="Hacker lookup & check-in" subtitle="Only confirmed hackers can be checked in.">
        <HackerLookup />
      </Card>
    </PageShell>
  );
}
