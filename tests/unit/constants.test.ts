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
