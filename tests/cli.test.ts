import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@clack/prompts");
});

describe("runCli", () => {
  it("collects the full generator configuration from prompts", async () => {
    const intro = vi.fn();
    const cancel = vi.fn();
    const isCancel = vi.fn(() => false);
    const text = vi.fn().mockResolvedValueOnce("acme-app").mockResolvedValueOnce("./acme-app");
    const select = vi.fn().mockResolvedValue("tanstack-start");
    const multiselect = vi.fn().mockResolvedValue(["auth", "redis"]);
    const confirm = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    vi.doMock("@clack/prompts", () => ({
      intro,
      cancel,
      isCancel,
      text,
      select,
      multiselect,
      confirm,
    }));

    const { runCli } = await import("../src/cli.ts");
    const config = await runCli();

    expect(config).toEqual({
      projectName: "acme-app",
      targetDir: "./acme-app",
      stackModel: "tanstack-start",
      selectedModules: ["auth", "redis"],
      installDependencies: true,
      initGit: false,
    });

    const projectPrompt = text.mock.calls[0]?.[0];
    const targetPrompt = text.mock.calls[1]?.[0];

    expect(projectPrompt?.validate("")).toBe("App name is required");
    expect(projectPrompt?.validate("Acme")).toBe("Must be lowercase with hyphens only");
    expect(projectPrompt?.validate("acme-app")).toBeUndefined();
    expect(targetPrompt?.initialValue).toBe("./acme-app");
    expect(targetPrompt?.validate("")).toBe("Target directory is required");
    expect(targetPrompt?.validate("./custom-dir")).toBeUndefined();

    expect(intro).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels immediately when a prompt returns the clack cancel symbol", async () => {
    const cancelSymbol = Symbol("cancel");
    const intro = vi.fn();
    const cancel = vi.fn();
    const isCancel = vi.fn(value => value === cancelSymbol);
    const text = vi.fn().mockResolvedValue(cancelSymbol);
    const select = vi.fn();
    const multiselect = vi.fn();
    const confirm = vi.fn();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    vi.doMock("@clack/prompts", () => ({
      intro,
      cancel,
      isCancel,
      text,
      select,
      multiselect,
      confirm,
    }));

    const { runCli } = await import("../src/cli.ts");

    await expect(runCli()).rejects.toThrow("process.exit");
    expect(cancel).toHaveBeenCalledWith("Cancelled.");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(select).not.toHaveBeenCalled();
    expect(multiselect).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});
