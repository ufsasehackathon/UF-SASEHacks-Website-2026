import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Owner only (role management) */
export default async function StaffPeoplePage() {
  const { role } = await getCurrentRole();
  if (role !== "owner") redirect("/staff/applications");
  return <p className="font-[family-name:var(--font-body)] text-[#560700]/70">Coming next.</p>;
}
