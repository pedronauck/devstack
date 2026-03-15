import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI, organization } from "better-auth/plugins";
import {
  adminAc as betterAuthAdminAc,
  defaultRoles as betterAuthAdminRoles,
} from "better-auth/plugins/admin/access";
import { db } from "../../db";
import * as schema from "../../db/schema";
import { env } from "../../env";
import { generateId } from "../id";
import { ac, organizationRoles } from "./permissions";

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
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
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
    organization({
      ac,
      roles: organizationRoles,
      allowUserToCreateOrganization: true,
      schema: {
        session: {
          fields: {
            activeOrganizationId: "active_organization_id",
          },
        },
        organization: {
          fields: {
            createdAt: "created_at",
            updatedAt: "updated_at",
          },
        },
        member: {
          fields: {
            organizationId: "organization_id",
            userId: "user_id",
            createdAt: "created_at",
          },
        },
        invitation: {
          fields: {
            organizationId: "organization_id",
            inviterId: "inviter_id",
            expiresAt: "expires_at",
            createdAt: "created_at",
          },
        },
      },
    }),
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
