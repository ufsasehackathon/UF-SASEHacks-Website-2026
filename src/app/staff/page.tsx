import { getCurrentRole } from "@/lib/session";
import { PageShell } from "@/components/PageShell";

export const dynamic = "force-dynamic";

/** Placeholder home for owners and staff. Features will be added once the layout is decided. */
export default async function StaffPage() {
  const { role } = await getCurrentRole();
  return <PageShell title={role === "owner" ? "Owner Dashboard" : "Staff Dashboard"} subtitle="Coming soon." />;
}
