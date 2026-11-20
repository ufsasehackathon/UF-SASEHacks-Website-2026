import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { actAs } from "../helpers/next";
import { createUser } from "../helpers/users";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);

const { GET } = await import("@/app/auth/callback/route");

async function landing(query = "") {
  const res = await GET(new NextRequest(`http://localhost:3100/auth/callback${query}`));
  return new URL(res.headers.get("location")!).pathname;
}

describe("/auth/callback", () => {
  it("sends each role to its own dashboard when no next is given", async () => {
    actAs(await createUser({ role: "owner" }));
    expect(await landing()).toBe("/staff");
    actAs(await createUser({ role: "staff" }));
    expect(await landing()).toBe("/staff");
    actAs(await createUser({ role: "judge" }));
    expect(await landing()).toBe("/judge");
    actAs(await createUser());
    expect(await landing()).toBe("/portal");
  });

  it("falls back to the portal when the session didn't stick", async () => {
    actAs(null);
    expect(await landing()).toBe("/portal");
  });

  it("honours a same-site next and refuses an off-site one", async () => {
    actAs(await createUser({ role: "owner" }));
    expect(await landing("?next=%2Fstaff%2Fcheckin")).toBe("/staff/checkin");
    expect(await landing("?next=%2F%2Fexample.com")).toBe("/staff");
  });
});
