import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        // No ?next=: after login the callback sends each role to its own dashboard (hackers to /portal)
        redirect("/login");
    }
    return <>{children}</>;
}