import type { ModuleDefinition } from "./types.ts";

export const emailModule: ModuleDefinition = {
  name: "email",
  label: "Email",
  hint: "Resend delivery with SMTP fallback and React Email templates.",
  envVars: [
    { key: "RESEND_API_KEY", value: "re_replace_me" },
    { key: "EMAIL_FROM", value: "Devstack <noreply@example.com>" },
    { key: "MAILPIT_HOST", value: "127.0.0.1" },
    { key: "MAILPIT_PORT", value: "1025" },
  ],
  dockerServices: [
    {
      name: "mailpit",
      image: "axllent/mailpit",
      ports: ["1025:1025", "8025:8025"],
      healthcheck: {
        test: ["CMD-SHELL", "wget -qO- http://localhost:8025/livez >/dev/null 2>&1 || exit 1"],
        interval: "10s",
        timeout: "5s",
        retries: 20,
      },
    },
  ],
  backend: {
    dependencies: {
      "@react-email/components": "^1.0.9",
      nodemailer: "^8.0.2",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      resend: "^6.9.3",
    },
    devDependencies: {
      "@types/nodemailer": "^7.0.11",
    },
  },
};
