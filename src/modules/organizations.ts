import type { ModuleDefinition } from "./types.ts";

export const organizationsModule: ModuleDefinition = {
  name: "organizations",
  label: "Organizations",
  hint: "Multi-tenant organizations, memberships and generic roles.",
  requires: ["auth"],
  claudeSection: `## Organizations Module

- Organization context is derived from the active Better Auth organization.
- Roles are generic: \`owner\`, \`admin\`, \`member\`.
- Superadmins can override org scope with \`X-Organization-Id\`.
`,
};
