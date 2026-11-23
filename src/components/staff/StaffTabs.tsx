"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
