import { authModule } from "./auth.ts";
import { emailModule } from "./email.ts";
import { inngestModule } from "./inngest.ts";
import { observabilityModule } from "./observability.ts";
import { organizationsModule } from "./organizations.ts";
import { redisModule } from "./redis.ts";
import { storybookModule } from "./storybook.ts";
import { storageModule } from "./storage.ts";
import { stripeModule } from "./stripe.ts";
import {
  resolveSelectedModules as resolveModuleSelection,
  type ModuleDefinition,
  type ModuleName,
} from "./types.ts";

export const MODULE_REGISTRY: Record<ModuleName, ModuleDefinition> = {
  auth: authModule,
  organizations: organizationsModule,
  stripe: stripeModule,
  storage: storageModule,
  email: emailModule,
  inngest: inngestModule,
  observability: observabilityModule,
  redis: redisModule,
  storybook: storybookModule,
};

export function resolveSelectedModules(selectedModules: string[]) {
  return resolveModuleSelection(selectedModules, MODULE_REGISTRY).resolvedModules;
}
