"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

/**
 * Spinner on the clicked tab while its page loads. The old page stays up until the new one is ready
 * (no loading.tsx: its Suspense fallback holds even fast pages back for ~300 ms or more).
 */
function TabLabel({ name }: { name: string }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-2">
      {name}
      {pending && (
        <span
          role="status"
          aria-label={`Loading ${name}`}
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
    </span>
  );
}

/** Tab bar for /staff. People (role management) is owner-only. */
export function StaffTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { name: "Applications", href: "/staff/applications" },
    { name: "Check-in", href: "/staff/checkin" },
    { name: "Judging", href: "/staff/judging" },
    ...(isOwner ? [{ name: "People", href: "/staff/people" }] : []),
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-2 font-[family-name:var(--font-body)]">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border-2 border-[#560700] px-5 py-2 text-[#560700] transition-colors ${
              active ? "bg-[#560700] text-[#FFE4B3]" : "bg-white hover:bg-[#560700]/10"
            }`}
          >
            <TabLabel name={tab.name} />
          </Link>
        );
      })}
    </nav>
  );
}
