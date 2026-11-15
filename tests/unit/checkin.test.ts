import { describe, expect, it } from "vitest";
import { checkinState, profileSearchFilter, type CheckinPerson, type CheckinState } from "@/lib/checkin";

function person(overrides: Partial<CheckinPerson> = {}): CheckinPerson {
  return {
    userId: "u1",
    name: "Jane Doe",
    email: "jane@example.com",
    discordUsername: "jane",
    hasDiscord: true,
    hasConsents: true,
    status: "pending",
    checkedInAt: null,
    waitlistedAt: null,
    ...overrides,
  };
}

describe("checkinState", () => {
  const cases: [string, Partial<CheckinPerson>, CheckinState][] = [
    ["checked in (wins over everything)", { checkedInAt: "2026-11-14T10:00:00Z", status: "waitlist", hasDiscord: false }, "checked_in"],
    ["confirmed", { status: "confirmed" }, "can_check_in"],
    ["confirmed without Discord", { status: "confirmed", hasDiscord: false, hasConsents: false }, "can_check_in"],
    ["on the waitlist", { status: "waitlist", waitlistedAt: "2026-11-14T10:00:00Z" }, "waitlisted"],
    ["no Discord", { hasDiscord: false }, "needs_discord"],
    ["no Discord and no registration", { hasDiscord: false, status: null, hasConsents: false }, "needs_discord"],
    ["no registration", { status: null, hasConsents: false }, "needs_agreements"],
    ["no consents", { status: "draft", hasConsents: false }, "needs_agreements"],
    ["pending with Discord and consents", { status: "pending" }, "can_waitlist"],
    ["accepted with Discord and consents", { status: "accepted" }, "can_waitlist"],
    ["declined with Discord and consents", { status: "declined" }, "can_waitlist"],
  ];

  it.each(cases)("%s", (_label, overrides, expected) => {
    expect(checkinState(person(overrides))).toBe(expected);
  });
});

describe("profileSearchFilter", () => {
  it("returns null under 2 chars", () => {
    expect(profileSearchFilter("")).toBeNull();
    expect(profileSearchFilter("a")).toBeNull();
    expect(profileSearchFilter("  b  ")).toBeNull();
    expect(profileSearchFilter("(%)")).toBeNull();
    expect(profileSearchFilter("a,")).toBeNull();
    expect(profileSearchFilter("ab")).not.toBeNull();
  });

  it("strips filter syntax", () => {
    const filter = profileSearchFilter("O'Brien, (x)%")!;
    expect(filter).toContain("ilike.%O'Brien x%");
    const terms = [...filter.matchAll(/ilike\.%([^%]*)%/g)].map(m => m[1]);
    expect(terms.length).toBeGreaterThan(0);
    for (const term of terms) {
      expect(term).not.toContain(",");
      expect(term).not.toContain("(");
    }
    for (const char of [")", "*", "\\", '"']) expect(profileSearchFilter(`ab${char}cd`)).toContain("ilike.%abcd%");
  });

  it("searches every name, email and Discord field", () => {
    expect(profileSearchFilter("  jane  ")).toBe(
      "first_name.ilike.%jane%,last_name.ilike.%jane%,full_name.ilike.%jane%,email.ilike.%jane%,discord_username.ilike.%jane%"
    );
  });

  it('adds a first+last clause for "Jane Doe"', () => {
    const filter = profileSearchFilter("Jane   Doe");
    expect(filter).toContain("full_name.ilike.%Jane Doe%");
    expect(filter).toContain("and(first_name.ilike.%Jane%,last_name.ilike.%Doe%)");
    expect(profileSearchFilter("Mary Ann Smith")).toContain("and(first_name.ilike.%Mary%,last_name.ilike.%Ann Smith%)");
    expect(profileSearchFilter("Jane")).not.toContain("and(");
  });
});
