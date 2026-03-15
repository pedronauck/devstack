export interface EnvVar {
  key: string;
  value: string;
  comment?: string;
}

export interface DockerService {
  name: string;
  image: string;
  containerName?: string;
  ports: string[];
  command?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  dependsOn?: string[];
  healthcheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
  };
}

export type StackModel = "separated" | "tanstack-start";

export interface PackageContributions {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface SkillMapping {
  domain: string;
  keywords: string[];
  required: string[];
  conditional?: string[];
}

export interface ModuleDefinition {
  name: ModuleName;
  label: string;
  hint: string;
  requires?: ModuleName[];
  envVars?: EnvVar[];
  dockerServices?: DockerService[];
  templateDir?: string;
  root?: PackageContributions;
  frontend?: PackageContributions;
  backend?: PackageContributions;
  app?: PackageContributions;
  claudeSection?: string;
  skills?: string[];
  skillMappings?: SkillMapping[];
}

export type ModuleName = (typeof MODULE_ORDER)[number];

export interface ModuleResolution {
  autoSelected: ModuleName[];
  resolvedModules: ModuleName[];
}

export interface ModuleOption {
  value: ModuleName;
  label: string;
  hint: string;
}

export const MODULE_ORDER = [
  "auth",
  "organizations",
  "stripe",
  "storage",
  "email",
  "inngest",
  "observability",
  "redis",
  "storybook",
] as const;

export const MODULE_OPTIONS: ModuleOption[] = [
  { value: "auth", label: "Authentication", hint: "Better Auth with email/password sessions" },
  { value: "organizations", label: "Organizations", hint: "Multi-tenant org membership and roles" },
  { value: "stripe", label: "Stripe", hint: "Plans, subscriptions and Stripe webhook handling" },
  { value: "storage", label: "Storage", hint: "S3 or MinIO object storage helpers" },
  { value: "email", label: "Email", hint: "Resend + SMTP fallback + React Email" },
  { value: "inngest", label: "Inngest", hint: "Background jobs and local Inngest dev server" },
  { value: "observability", label: "Observability", hint: "OpenTelemetry tracing and Sentry" },
  { value: "redis", label: "Redis", hint: "Redis client plus rate limiting middleware" },
  { value: "storybook", label: "Storybook", hint: "Component documentation workspace" },
];

function isModuleName(value: string): value is ModuleName {
  return MODULE_ORDER.includes(value as ModuleName);
}

export function resolveSelectedModules(
  selectedModules: string[],
  registry: Record<ModuleName, ModuleDefinition>
): ModuleResolution {
  const selection = new Set<ModuleName>();
  const autoSelected = new Set<ModuleName>();

  function visit(moduleName: ModuleName) {
    const definition = registry[moduleName];
    selection.add(moduleName);

    for (const dependency of definition.requires ?? []) {
      if (!selection.has(dependency)) {
        autoSelected.add(dependency);
        selection.add(dependency);
        visit(dependency);
      }
    }
  }

  for (const moduleName of selectedModules) {
    if (!isModuleName(moduleName)) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    visit(moduleName);
  }

  return {
    autoSelected: MODULE_ORDER.filter(moduleName => autoSelected.has(moduleName)),
    resolvedModules: MODULE_ORDER.filter(moduleName => selection.has(moduleName)),
  };
}

const SHARED_BASE_SKILLS = [
  // Core stack (framework-agnostic)
  "react",
  "typescript-advanced",
  "vitest",
  "es-toolkit",
  "zod",
  "postgres-drizzle",
  "drizzle-orm",
  "drizzle-safe-migrations",
  // Frontend
  "tanstack-router-best-practices",
  "tanstack-query-best-practices",
  "zustand",
  "shadcn",
  "shadcn-ui",
  "building-components",
  "frontend-design",
  "ui-ux-pro-max",
  "web-design-guidelines",
  "bencium-innovative-ux-designer",
  "interface-design",
  "vercel-react-best-practices",
  "vercel-composition-patterns",
  "app-renderer-systems",
  // Process & quality
  "brainstorming",
  "executing-plans",
  "no-workarounds",
  "systematic-debugging",
  "test-antipatterns",
  "verification-before-completion",
  "adversarial-review",
  "architectural-analysis",
  "fix-coderabbit-review",
  "git-rebase",
  "skills-best-practices",
  "find-skills",
  // Tools
  "exa-web-search-free",
  "pal",
  "to-prompt",
] as const;

const STACK_SPECIFIC_SKILLS: Record<StackModel, readonly string[]> = {
  separated: ["hono"],
  "tanstack-start": ["tanstack-start-best-practices"],
};

export function getBaseSkills(stackModel: StackModel): string[] {
  return [...SHARED_BASE_SKILLS, ...STACK_SPECIFIC_SKILLS[stackModel]];
}

/** @deprecated Use getBaseSkills(stackModel) instead */
export const BASE_SKILLS = [...SHARED_BASE_SKILLS, "hono"] as const;

const SHARED_SKILL_MAPPINGS: SkillMapping[] = [
  {
    domain: "Validation / Zod",
    keywords: [
      "zod",
      "z.object",
      "z.string",
      "safeParse",
      "z.infer",
      "schema validation",
      "parse",
      "transform",
    ],
    required: ["zod"],
  },
  {
    domain: "Frontend + React",
    keywords: [
      "component",
      "hook",
      "JSX",
      "TSX",
      "render",
      "state",
      "props",
      "UI",
      "layout",
      "page",
      "form",
    ],
    required: ["react"],
    conditional: ["shadcn", "building-components"],
  },
  {
    domain: "Frontend + TanStack",
    keywords: ["query", "mutation", "TanStack Query", "cache", "invalidation", "refetch"],
    required: ["tanstack-query-best-practices", "react"],
    conditional: ["tanstack-router-best-practices"],
  },
  {
    domain: "Frontend + Design",
    keywords: ["UI design", "UX", "design system", "visual fidelity", "interface", "responsive"],
    required: ["frontend-design", "ui-ux-pro-max"],
    conditional: ["web-design-guidelines", "shadcn"],
  },
  {
    domain: "React performance",
    keywords: ["performance", "memoization", "lazy", "Suspense", "code splitting"],
    required: ["vercel-react-best-practices"],
    conditional: ["vercel-composition-patterns", "react"],
  },
  {
    domain: "State + Zustand",
    keywords: ["store", "state management", "zustand", "selector"],
    required: ["zustand"],
  },
  {
    domain: "es-toolkit / utilities",
    keywords: [
      "es-toolkit",
      "lodash",
      "utility function",
      "debounce",
      "throttle",
      "groupBy",
      "pick",
      "omit",
    ],
    required: ["es-toolkit"],
  },
  {
    domain: "Bug fix",
    keywords: ["bug", "fix", "error", "failure", "crash", "unexpected", "broken", "regression"],
    required: ["systematic-debugging", "no-workarounds"],
    conditional: ["test-antipatterns"],
  },
  {
    domain: "Writing tests",
    keywords: ["test", "spec", "mock", "stub", "fixture", "assertion", "coverage", "vitest"],
    required: ["vitest", "test-antipatterns"],
  },
  {
    domain: "Task completion",
    keywords: ["done", "complete", "finished", "ship"],
    required: ["verification-before-completion"],
  },
  {
    domain: "Architecture audit",
    keywords: ["architecture audit", "dead code", "code smell", "anti-pattern", "duplication"],
    required: ["architectural-analysis"],
  },
  {
    domain: "Interface/App design",
    keywords: ["dashboard", "admin panel", "app interface", "interactive product"],
    required: ["interface-design", "bencium-innovative-ux-designer"],
    conditional: ["frontend-design", "ui-ux-pro-max"],
  },
  {
    domain: "Creative/new features",
    keywords: ["brainstorm", "idea", "new feature", "creative"],
    required: ["brainstorming"],
  },
  {
    domain: "Plan execution",
    keywords: ["plan", "execute", "implement", "step by step"],
    required: ["executing-plans"],
  },
  {
    domain: "TypeScript advanced",
    keywords: [
      "generics",
      "conditional types",
      "mapped types",
      "template literals",
      "utility types",
    ],
    required: ["typescript-advanced"],
  },
];

const STACK_SPECIFIC_SKILL_MAPPINGS: Record<StackModel, SkillMapping[]> = {
  separated: [
    {
      domain: "Backend + Hono",
      keywords: [
        "route",
        "handler",
        "API",
        "usecase",
        "repository",
        "module",
        "Hono",
        "middleware",
        "plugin",
      ],
      required: ["hono", "postgres-drizzle", "drizzle-orm"],
      conditional: ["drizzle-safe-migrations"],
    },
  ],
  "tanstack-start": [
    {
      domain: "Server + TanStack Start",
      keywords: [
        "server function",
        "createServerFn",
        "API route",
        "loader",
        "server",
        "usecase",
        "repository",
        "middleware",
      ],
      required: ["tanstack-start-best-practices", "postgres-drizzle", "drizzle-orm"],
      conditional: ["drizzle-safe-migrations"],
    },
  ],
};

export function getBaseSkillMappings(stackModel: StackModel): SkillMapping[] {
  return [...STACK_SPECIFIC_SKILL_MAPPINGS[stackModel], ...SHARED_SKILL_MAPPINGS];
}

/** @deprecated Use getBaseSkillMappings(stackModel) instead */
export const BASE_SKILL_MAPPINGS: SkillMapping[] = [
  {
    domain: "Backend + Hono",
    keywords: [
      "route",
      "handler",
      "API",
      "usecase",
      "repository",
      "module",
      "Hono",
      "middleware",
      "plugin",
    ],
    required: ["hono", "postgres-drizzle", "drizzle-orm"],
    conditional: ["drizzle-safe-migrations"],
  },
  ...SHARED_SKILL_MAPPINGS,
];
