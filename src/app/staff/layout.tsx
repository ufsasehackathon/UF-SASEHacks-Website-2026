import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";

/** Owners and staff only */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getCurrentRole();
  if (!user) redirect(`/login?next=${encodeURIComponent("/staff")}`);
  if (role !== "owner" && role !== "staff") redirect("/portal");
  return <>{children}</>;
}
