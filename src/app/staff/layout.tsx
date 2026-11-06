import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";

/** Owners and staff only. Owner-only pages inside also check for themselves. */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getCurrentRole();
  if (!user) redirect(`/login?next=${encodeURIComponent("/staff")}`);
  if (role !== "owner" && role !== "staff") redirect("/portal");
  return <>{children}</>;
}
