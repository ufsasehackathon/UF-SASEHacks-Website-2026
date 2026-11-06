import { getCurrentRole } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";
import HeaderClient from "./HeaderClient";

export default async function Header() {
    const { user, role } = await getCurrentRole();

    // One "Dashboard" link to the role's home: /staff, /judge or /portal
    return <HeaderClient user={user} dashboardHref={role ? ROLE_HOME[role] : null} />;
}
