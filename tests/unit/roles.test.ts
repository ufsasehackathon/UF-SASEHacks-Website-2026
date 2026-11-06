import { describe, expect, it } from "vitest";
import { ROLE_HOME, roles, toRole } from "@/lib/roles";

describe("toRole", () => {
  it.each(roles)("keeps %s", role => {
    expect(toRole(role)).toBe(role);
  });

  it.each([null, undefined, "", "admin", "sponsor", "OWNER", 1, {}])("maps %o to hacker", value => {
    expect(toRole(value)).toBe("hacker");
  });
});

describe("ROLE_HOME", () => {
  it("routes each role to its dashboard", () => {
    expect(ROLE_HOME).toEqual({ owner: "/staff", staff: "/staff", judge: "/judge", hacker: "/portal" });
  });
});
