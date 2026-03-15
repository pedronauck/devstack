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

export interface PackageContributions {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
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
  claudeSection?: string;
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
