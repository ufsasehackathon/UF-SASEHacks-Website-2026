import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import { fetchRoleHolders } from "../actions";
import RoleManager from "@/components/staff/RoleManager";
import { Card, PageShell } from "@/components/staff/Card";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const { role } = await getCurrentRole();
  if (role !== "owner") redirect("/staff");

  const res = await fetchRoleHolders();

  return (
    <PageShell title="Roles" subtitle={<Link href="/staff" className="hover:underline">← Staff dashboard</Link>}>
      <Card
        title="Manage roles"
        subtitle="Owners can do everything. Staff see stats, lookup and check-in. Judges score their assigned projects. Everyone else is a hacker."
      >
        {res.ok ? <RoleManager holders={res.rows} /> : <p className="text-sm text-red-700">{res.error}</p>}
      </Card>
    </PageShell>
  );
}
