import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { db } from "../../db";
import { env } from "../../env";
import * as schema from "../../db/schema";
import { generateId } from "../id";

const trustedOrigins = [
  env.BETTER_AUTH_URL,
  ...env.CORS_ORIGIN.split(",").map(origin => origin.trim()),
].filter(Boolean);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account: schema.account,
      invitation: schema.invitation,
      member: schema.member,
      organization: schema.organization,
      session: schema.session,
      user: schema.user,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    cookiePrefix: "{{projectName}}",
    database: {
      generateId: () => generateId(),
    },
    useSecureCookies: env.NODE_ENV === "production",
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      schema: {
        invitation: {
          fields: {
            createdAt: "created_at",
            expiresAt: "expires_at",
            inviterId: "inviter_id",
            organizationId: "organization_id",
          },
        },
        member: {
          fields: {
            createdAt: "created_at",
            organizationId: "organization_id",
            userId: "user_id",
          },
        },
        organization: {
          fields: {
            createdAt: "created_at",
            updatedAt: "updated_at",
          },
        },
        session: {
          fields: {
            activeOrganizationId: "active_organization_id",
          },
        },
      },
    }),
    admin({
      adminRoles: ["superadmin"],
      schema: {
        session: {
          fields: {
            impersonatedBy: "impersonated_by",
          },
        },
        user: {
          fields: {
            banExpires: "ban_expires",
            banReason: "ban_reason",
          },
        },
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});
