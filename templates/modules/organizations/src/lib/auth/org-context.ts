import type { Context } from "hono";
import { ValidationError } from "../errors";
import type { AuthSession, AuthUser } from "./auth-context";

type OrgContextVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

export function getOrgId<Variables extends OrgContextVariables>(
  c: Context<{ Variables: Variables }>
): string {
  const user = c.get("user");
  const session = c.get("session");

  if (user?.role === "superadmin") {
    const organizationId = c.req.header("x-organization-id");

    if (!organizationId) {
      throw new ValidationError("Superadmin must specify X-Organization-Id");
    }

    return organizationId;
  }

  const activeOrganizationId = session?.activeOrganizationId ?? null;

  if (!activeOrganizationId) {
    throw new ValidationError("No active organization");
  }

  return activeOrganizationId;
}
