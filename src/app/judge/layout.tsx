import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";

/** Judges (and owners, for testing) only */
export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getCurrentRole();
  if (!user) redirect(`/login?next=${encodeURIComponent("/judge")}`);
  if (role !== "judge" && role !== "owner") redirect(ROLE_HOME[role ?? "hacker"]);
  return <>{children}</>;
}
