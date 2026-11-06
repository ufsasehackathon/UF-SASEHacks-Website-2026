import { getCurrentRole } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";
import HeaderClient from "./HeaderClient";

export default async function Header() {
    const { user, role } = await getCurrentRole();

    // "Dashboard" goes to the role's home (/staff, /judge or /portal). Non-hackers also get a
    // "Portal" link, since they can apply too.
    return (
        <HeaderClient
            user={user}
            dashboardHref={role ? ROLE_HOME[role] : null}
            showPortalLink={!!role && role !== "hacker"}
        />
    );
}
