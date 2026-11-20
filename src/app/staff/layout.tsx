import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";
import { PageShell } from "@/components/PageShell";
import { StaffTabs } from "@/components/staff/StaffTabs";

/** Owners and staff only. Shell + tabs for every /staff page. */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getCurrentRole();
  if (!user) redirect(`/login?next=${encodeURIComponent("/staff")}`);
  if (role !== "owner" && role !== "staff") redirect(ROLE_HOME[role ?? "hacker"]);
  return (
    <PageShell title={role === "owner" ? "Owner Dashboard" : "Staff Dashboard"}>
      <div>
        <StaffTabs isOwner={role === "owner"} />
        {children}
      </div>
    </PageShell>
  );
}
