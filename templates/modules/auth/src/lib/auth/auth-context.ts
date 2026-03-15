import type { Context } from "hono";
import { auth } from "./auth";

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;

export interface AuthContext {
  user: AuthUser | null;
  session: AuthSession | null;
}

export async function getAuthContext(c: Context): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return { user: null, session: null };
  }

  return {
    user: session.user,
    session: session.session,
  };
}
