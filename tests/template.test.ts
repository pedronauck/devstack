import { describe, expect, it } from "vitest";
import { replaceTemplateTokens } from "../src/utils/template.ts";

describe("replaceTemplateTokens", () => {
  it("replaces every known token", () => {
    const output = replaceTemplateTokens("{{projectName}} / {{projectTitle}}", {
      projectName: "my-saas",
      projectTitle: "My Saas",
    });

    expect(output).toBe("my-saas / My Saas");
  });

  it("keeps unknown tokens untouched", () => {
    const output = replaceTemplateTokens("{{projectName}} / {{missing}}", {
      projectName: "my-saas",
    });

    expect(output).toBe("my-saas / {{missing}}");
  });
});
