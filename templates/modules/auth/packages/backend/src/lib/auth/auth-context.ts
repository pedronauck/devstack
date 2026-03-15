import type { Context } from "hono";
import { auth } from "./auth";

export type AuthUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"];

export async function getAuthContext(c: Context) {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    return {
      activeOrganizationId: null,
      session: null,
      user: null,
    };
  }

  const activeOrganizationId =
    "activeOrganizationId" in result.session && typeof result.session.activeOrganizationId === "string"
      ? result.session.activeOrganizationId
      : null;

  return {
    activeOrganizationId,
    session: result.session,
    user: result.user,
  };
}
