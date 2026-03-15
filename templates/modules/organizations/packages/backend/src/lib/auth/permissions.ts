export const organizationRoles = {
  admin: {
    description: "Can manage members and workspace settings.",
  },
  member: {
    description: "Can work with business modules inside the active organization.",
  },
  owner: {
    description: "Full access inside the organization.",
  },
} as const;

export type OrganizationRoleName = keyof typeof organizationRoles;
export type PermissionResource = "billing" | "items" | "settings";
export type PermissionAction = "create" | "delete" | "read" | "update";

export type PermissionStatement = Record<PermissionResource, PermissionAction[]>;

const roleMatrix: Record<OrganizationRoleName, PermissionStatement> = {
  admin: {
    billing: ["read", "update"],
    items: ["create", "delete", "read", "update"],
    settings: ["read", "update"],
  },
  member: {
    billing: ["read"],
    items: ["create", "read", "update"],
    settings: ["read"],
  },
  owner: {
    billing: ["create", "delete", "read", "update"],
    items: ["create", "delete", "read", "update"],
    settings: ["create", "delete", "read", "update"],
  },
};

export function hasPermission(
  role: OrganizationRoleName,
  resource: PermissionResource,
  action: PermissionAction
) {
  return roleMatrix[role][resource].includes(action);
}
