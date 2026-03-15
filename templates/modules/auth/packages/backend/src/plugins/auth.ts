import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth/auth";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

type SessionResponse = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AuthUser = NonNullable<SessionResponse>["user"];
export type AuthSession = NonNullable<SessionResponse>["session"];

export type AuthVariables = {
  orgId: string | null;
  session: AuthSession | null;
  user: AuthUser | null;
};

function getActiveOrganizationId(session: AuthSession | null) {
  if (!session || typeof session !== "object") {
    return null;
  }

  if ("activeOrganizationId" in session && typeof session.activeOrganizationId === "string") {
    return session.activeOrganizationId;
  }

  return null;
}

export const sessionMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    c.set("user", null);
    c.set("session", null);
    c.set("orgId", null);
    await next();
    return;
  }

  c.set("user", result.user);
  c.set("session", result.session);
  c.set("orgId", getActiveOrganizationId(result.session));
  await next();
});

export const requireAuth = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  if (!c.get("user")) {
    throw new UnauthorizedError();
  }

  await next();
});

export const requireActiveOrg = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const orgId = c.get("orgId") ?? getActiveOrganizationId(c.get("session"));

  if (!orgId) {
    throw new ForbiddenError("No active organization");
  }

  c.set("orgId", orgId);
  await next();
});

export const requireSuperadmin = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const user = c.get("user") as { role?: string | null } | null;

  if (user?.role !== "superadmin") {
    throw new ForbiddenError();
  }

  await next();
});

export const authHandler = (c: { req: { raw: Request } }) => auth.handler(c.req.raw);
