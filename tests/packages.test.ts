import { describe, expect, it } from "vitest";
import { mergePackageJson } from "../src/utils/packages.ts";

describe("mergePackageJson", () => {
  it("merges and sorts dependencies", () => {
    const merged = mergePackageJson(
      {
        dependencies: {
          zod: "^4.0.0",
        },
        scripts: {
          dev: "bun dev",
        },
      },
      {
        dependencies: {
          hono: "^4.0.0",
        },
        scripts: {
          build: "bun build",
        },
      }
    );

    expect(merged.dependencies).toEqual({
      hono: "^4.0.0",
      zod: "^4.0.0",
    });
    expect(merged.scripts).toEqual({
      build: "bun build",
      dev: "bun dev",
    });
  });
});
