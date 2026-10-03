import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "manager" | "employee";

export type OrgActor = {
  userId: string;
  companyId: string;
  role: OrgRole;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * Resolves the signed-in caller for organization-scoped API routes.
 *
 * Returns null when the caller is not signed in, has no organization, or is
 * no longer an ACTIVE member. A removed/disabled employee whose browser still
 * holds a valid access token must not keep using privileged APIs until the
 * token expires.
 */
export async function getOrgActor(): Promise<OrgActor | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("profiles")
    .select("company_id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.company_id) return null;
  if (me.status && me.status !== "active") return null;
  if (!["owner", "admin", "manager", "employee"].includes(me.role)) return null;

  return { userId: user.id, companyId: me.company_id, role: me.role as OrgRole, supabase };
}

export const isOrgAdmin = (role?: string | null) => role === "owner" || role === "admin";

/**
 * Role-assignment policy (enforced again in the database by
 * 20261004_p0_profile_privilege_guard.sql):
 *  - Nobody becomes "owner" through employee create/edit. Ownership moves only
 *    through the dedicated ownership-transfer flow.
 *  - Only the Owner may grant or remove the "admin" role.
 *  - Admins may assign manager/employee.
 */
export function canAssignRole(actorRole: OrgRole, fromRole: string | null, toRole: string): boolean {
  if (toRole === "owner") return false;
  if (fromRole === "owner") return false;
  const touchesAdmin = toRole === "admin" || fromRole === "admin";
  if (touchesAdmin) return actorRole === "owner";
  return isOrgAdmin(actorRole);
}

/** True when every non-empty id belongs to an ACTIVE-or-any profile of the same company. */
export async function idsBelongToCompany(
  admin: { from: (t: string) => any },
  companyId: string,
  table: "profiles" | "branches",
  ids: (string | null | undefined)[],
): Promise<boolean> {
  const wanted = Array.from(new Set(ids.filter((x): x is string => typeof x === "string" && x.length > 0)));
  if (!wanted.length) return true;
  const { data, error } = await admin.from(table).select("id").eq("company_id", companyId).in("id", wanted);
  if (error) return false;
  return (data || []).length === wanted.length;
}
