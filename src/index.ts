import { outro } from "@clack/prompts";
import color from "picocolors";
import { runCli } from "./cli.ts";
import { generateProject } from "./generator.ts";

export async function main() {
  const config = await runCli();
  const result = await generateProject(config);

  outro(
    [
      `${color.green("Project ready:")} ${result.targetDir}`,
      `Next steps:`,
      `  cd ${result.targetDir}`,
      `  docker compose up -d`,
      `  bun run dev`,
    ].join("\n")
  );
}

if (import.meta.main) {
  await main();
}
