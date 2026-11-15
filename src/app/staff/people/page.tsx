import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import { listRoleHolders } from "./actions";
import { RoleManager } from "@/components/staff/RoleManager";

export const dynamic = "force-dynamic";

/** Owner only (role management) */
export default async function StaffPeoplePage() {
  const { role } = await getCurrentRole();
  if (role !== "owner") redirect("/staff/applications");
  return <RoleManager holders={await listRoleHolders()} />;
}
