import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY } from "../src/modules/index.ts";
import { resolveSelectedModules } from "../src/modules/types.ts";

describe("resolveSelectedModules", () => {
  it("auto-selects auth when organizations is requested", () => {
    const result = resolveSelectedModules(["organizations"], MODULE_REGISTRY);

    expect(result.autoSelected).toEqual(["auth"]);
    expect(result.resolvedModules).toEqual(["auth", "organizations"]);
  });

  it("preserves deterministic module order", () => {
    const result = resolveSelectedModules(["redis", "auth", "stripe"], MODULE_REGISTRY);

    expect(result.resolvedModules).toEqual(["auth", "stripe", "redis"]);
  });
});
