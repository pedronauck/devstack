import type { Context } from "hono";
import { ValidationError } from "../errors";
import type { AuthSession, AuthUser } from "./auth-context";

type OrgVariables = {
  session: AuthSession | null;
  user: AuthUser | null;
};

export function getOrgId<Variables extends OrgVariables>(c: Context<{ Variables: Variables }>) {
  const user = c.get("user");
  const session = c.get("session");

  if ((user as { role?: string | null } | null)?.role === "superadmin") {
    const organizationId = c.req.header("x-organization-id");
    if (!organizationId) {
      throw new ValidationError("Superadmin must specify X-Organization-Id");
    }

    return organizationId;
  }

  const activeOrganizationId =
    session && "activeOrganizationId" in session && typeof session.activeOrganizationId === "string"
      ? session.activeOrganizationId
      : null;

  if (!activeOrganizationId) {
    throw new ValidationError("No active organization");
  }

  return activeOrganizationId;
}
