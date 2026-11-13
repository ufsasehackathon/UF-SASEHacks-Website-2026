import { afterEach, describe, expect, it, vi } from "vitest";

// The flags are read when the module loads, so each test re-imports it with fresh env.
async function loadConstants(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/constants");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("feature flags", () => {
  it.each([
    ["true", true],
    ["TRUE", false],
    ["1", false],
    ["false", false],
    ["", false],
    [undefined, false],
  ] as const)('NEXT_PUBLIC_*_ENABLED=%s -> %s', async (value, expected) => {
    const c = await loadConstants({
      NEXT_PUBLIC_REGISTRATIONS_ENABLED: value,
      NEXT_PUBLIC_LOGIN_ENABLED: value,
    });
    expect(c.REGISTRATIONS_ENABLED).toBe(expected);
    expect(c.LOGIN_ENABLED).toBe(expected);
  });
});

describe("registrationsOpen", () => {
  it("is open before the deadline when enabled", async () => {
    const c = await loadConstants({ NEXT_PUBLIC_REGISTRATIONS_ENABLED: "true" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(c.APPLICATIONS_CLOSE) - 1000);
    expect(c.registrationsOpen()).toBe(true);
  });

  it("closes exactly at the deadline", async () => {
    const c = await loadConstants({ NEXT_PUBLIC_REGISTRATIONS_ENABLED: "true" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(c.APPLICATIONS_CLOSE));
    expect(c.registrationsOpen()).toBe(false);
  });

  it("is closed before the deadline when the flag is off", async () => {
    const c = await loadConstants({ NEXT_PUBLIC_REGISTRATIONS_ENABLED: "false" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(c.APPLICATIONS_CLOSE) - 1000);
    expect(c.registrationsOpen()).toBe(false);
  });

  it("re-checks the clock on every call (no redeploy needed)", async () => {
    const c = await loadConstants({ NEXT_PUBLIC_REGISTRATIONS_ENABLED: "true" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(c.APPLICATIONS_CLOSE) - 1);
    expect(c.registrationsOpen()).toBe(true);
    vi.setSystemTime(Date.parse(c.APPLICATIONS_CLOSE) + 1);
    expect(c.registrationsOpen()).toBe(false);
  });

  it("has a parseable deadline", async () => {
    const c = await loadConstants({});
    expect(Number.isNaN(Date.parse(c.APPLICATIONS_CLOSE))).toBe(false);
  });
});

describe("walkInsOpen", () => {
  it("is false before EVENT_START, true at EVENT_START and inside, false after EVENT_END", async () => {
    const c = await loadConstants({ NEXT_PUBLIC_REGISTRATIONS_ENABLED: "false" });
    const start = Date.parse(c.EVENT_START);
    const end = Date.parse(c.EVENT_END);
    expect(c.walkInsOpen(start - 1)).toBe(false);
    expect(c.walkInsOpen(start)).toBe(true);
    expect(c.walkInsOpen(start + 60 * 60 * 1000)).toBe(true);
    expect(c.walkInsOpen(end)).toBe(true);
    expect(c.walkInsOpen(end + 1)).toBe(false);
  });
});

describe("rsvpDeadlineFrom", () => {
  it("adds RSVP_WINDOW_DAYS days", async () => {
    const c = await loadConstants({});
    const sentAt = new Date("2027-02-03T12:00:00Z");
    expect(c.rsvpDeadlineFrom(sentAt).getTime()).toBe(sentAt.getTime() + c.RSVP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    expect(c.RSVP_WINDOW_DAYS).toBe(7);
    expect(c.rsvpDeadlineFrom(sentAt).toISOString()).toBe("2027-02-10T12:00:00.000Z");
  });
});
