import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safeNext";

describe("safeNextPath", () => {
  it.each(["/portal", "/portal/onboarding", "/staff?tab=1", "/"])("allows same-site path %s", path => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "portal",
    "//evil.com",
    "//evil.com/portal",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
  ])("falls back to /portal for %o", value => {
    expect(safeNextPath(value)).toBe("/portal");
  });

  it("uses a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/")).toBe("/");
  });
});
