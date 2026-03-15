import type { ModuleDefinition } from "./types.ts";

export const inngestModule: ModuleDefinition = {
  name: "inngest",
  label: "Inngest",
  hint: "Background jobs and local dev server.",
  envVars: [
    { key: "INNGEST_EVENT_KEY", value: "replace_me_for_prod" },
    { key: "INNGEST_SIGNING_KEY", value: "replace_me_for_prod" },
  ],
  dockerServices: [
    {
      name: "inngest",
      image: "inngest/inngest",
      command: [
        "inngest",
        "dev",
        "--host",
        "0.0.0.0",
        "--port",
        "8288",
        "-u",
        "${INNGEST_EVENT_API_URL:-http://host.docker.internal:3000/api/inngest}",
      ],
      ports: ["8288:8288"],
      environment: {
        INNGEST_EVENT_API_URL:
          "${INNGEST_EVENT_API_URL:-http://host.docker.internal:3000/api/inngest}",
      },
      healthcheck: {
        test: ["CMD-SHELL", "curl -f http://localhost:8288/health || exit 1"],
        interval: "10s",
        timeout: "5s",
        retries: 20,
      },
    },
  ],
  backend: {
    dependencies: {
      inngest: "^3.52.6",
    },
  },
  skills: ["inngest"],
  skillMappings: [
    {
      domain: "Inngest",
      keywords: [
        "inngest",
        "background job",
        "event-driven",
        "workflow",
        "durable execution",
        "step function",
      ],
      required: ["inngest"],
    },
  ],
};
