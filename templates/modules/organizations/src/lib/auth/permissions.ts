import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  billing: ["read", "manage"] as const,
  member: ["invite", "remove", "update-role"] as const,
  organization: ["read", "update", "delete"] as const,
  storage: ["read", "write"] as const,
} as const;

const internalStatement = {
  ...statement,
  invitation: ["create", "cancel"] as const,
} as const;

export const ac = createAccessControl(internalStatement);

export const owner = ac.newRole({
  billing: ["read", "manage"],
  member: ["invite", "remove", "update-role"],
  organization: ["read", "update", "delete"],
  storage: ["read", "write"],
  invitation: ["create", "cancel"],
});

export const admin = ac.newRole({
  billing: ["read", "manage"],
  member: ["invite", "remove", "update-role"],
  organization: ["read", "update"],
  storage: ["read", "write"],
  invitation: ["create", "cancel"],
});

export const member = ac.newRole({
  billing: ["read"],
  organization: ["read"],
  storage: ["read", "write"],
});

export const organizationRoles = {
  owner,
  admin,
  member,
} as const;

export type PermissionStatement = typeof statement;
export type PermissionResource = keyof PermissionStatement;
export type OrganizationRoleName = keyof typeof organizationRoles;
