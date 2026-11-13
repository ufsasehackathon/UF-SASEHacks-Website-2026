import { describe, expect, it, vi } from "vitest";
import { actAs } from "../helpers/next";
import { createUser } from "../helpers/users";
import { OWNER_ROLES, STAFF_ROLES } from "@/lib/roles";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);

const { requireRole } = await import("@/lib/session");

describe("requireRole", () => {
  it("rejects a signed-out caller", async () => {
    actAs(null);
    expect(await requireRole(STAFF_ROLES)).toEqual({ ok: false, error: "Not authenticated" });
  });

  it("rejects roles outside the allowed list", async () => {
    actAs(await createUser());
    expect(await requireRole(STAFF_ROLES)).toEqual({ ok: false, error: "Not allowed" });
    actAs(await createUser({ role: "judge" }));
    expect(await requireRole(STAFF_ROLES)).toEqual({ ok: false, error: "Not allowed" });
    actAs(await createUser({ role: "staff" }));
    expect(await requireRole(OWNER_ROLES)).toEqual({ ok: false, error: "Not allowed" });
  });

  it("returns the client, user and role for an allowed caller", async () => {
    const staff = await createUser({ role: "staff" });
    actAs(staff);
    const res = await requireRole(STAFF_ROLES);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.role).toBe("staff");
    expect(res.user.id).toBe(staff.id);
    expect(res.supabase).toBe(staff.client);

    actAs(await createUser({ role: "owner" }));
    const owner = await requireRole(OWNER_ROLES);
    expect(owner.ok && owner.role).toBe("owner");
  });
});
