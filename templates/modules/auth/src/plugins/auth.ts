import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth/auth";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;

export type AuthVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
};

export const sessionMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
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

export const requireSuperadmin = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  if (c.get("user")?.role !== "superadmin") {
    throw new ForbiddenError();
  }

  await next();
});

export const authHandler = (c: { req: { raw: Request } }) => auth.handler(c.req.raw);

export { auth };
