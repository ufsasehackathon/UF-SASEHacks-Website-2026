import { createSupabaseServerClient } from "@/lib/supabase/server";
import HeaderClient from "./HeaderClient";

export default async function Header() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Any signed-in user can reach /portal (that's where they start their application)
    return <HeaderClient user={user} showDashboard={!!user} />;
}
