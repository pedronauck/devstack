import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI } from "better-auth/plugins";
import {
  adminAc as betterAuthAdminAc,
  defaultRoles as betterAuthAdminRoles,
} from "better-auth/plugins/admin/access";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { env } from "../../env";
import { generateId } from "../id";

const trustedOrigins = [env.APP_URL, ...env.CORS_ORIGIN.split(",").map(origin => origin.trim())]
  .filter(Boolean);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  advanced: {
    cookiePrefix: "{{projectName}}",
    database: {
      generateId,
    },
    useSecureCookies: env.NODE_ENV === "production",
  },
  plugins: [
    admin({
      adminRoles: ["superadmin"],
      roles: {
        ...betterAuthAdminRoles,
        superadmin: betterAuthAdminAc,
      },
    }),
    openAPI(),
  ],
});

export type Auth = typeof auth;
