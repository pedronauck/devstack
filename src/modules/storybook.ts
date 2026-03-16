import type { ModuleDefinition } from "./types.ts";

export const storybookModule: ModuleDefinition = {
  name: "storybook",
  label: "Storybook",
  hint: "Component docs and visual preview tooling.",
  root: {
    devDependencies: {
      "@chromatic-com/storybook": "^5.0.1",
      "@storybook/addon-a11y": "^10.2.19",
      "@storybook/addon-docs": "^10.2.19",
      "@storybook/addon-onboarding": "^10.2.19",
      "@storybook/addon-themes": "^10.2.19",
      "@storybook/react": "^10.2.19",
      storybook: "^10.2.17",
    },
  },
  frontend: {
    scripts: {
      "build-storybook": "storybook build",
      storybook: "storybook dev -p 6006",
    },
  },
  skills: ["storybook"],
  skillMappings: [
    {
      domain: "Storybook",
      keywords: ["storybook", "story", "stories", "CSF", "component docs", "visual testing"],
      required: ["storybook"],
      conditional: ["react"],
    },
  ],
};
