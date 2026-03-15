import type { ModuleName, StackModel } from "../modules/types.ts";
import type { buildTemplateTokens } from "../utils/template.ts";

export type GenerateContext = {
  projectName: string;
  stackModel: StackModel;
  resolvedModules: ModuleName[];
  targetDir: string;
  tokens: ReturnType<typeof buildTemplateTokens>;
};
