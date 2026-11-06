/** No user_roles row = hacker. Source of truth: public.user_role() in supabase/schema.sql */
export const roles = ["owner", "staff", "judge", "hacker"] as const;
export type Role = typeof roles[number];

/** Where the header's "Dashboard" link sends each role */
export const ROLE_HOME: Record<Role, string> = {
  owner: "/staff",
  staff: "/staff",
  judge: "/judge",
  hacker: "/portal",
};

export function toRole(value: unknown): Role {
  return roles.includes(value as Role) ? (value as Role) : "hacker";
}
