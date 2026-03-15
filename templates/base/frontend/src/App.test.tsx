import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the generated shell", async () => {
    render(<App />);

    expect(await screen.findByText("A full-stack workspace, ready to extend.")).toBeInTheDocument();
    expect(await screen.findByText("Starter workspace")).toBeInTheDocument();
  });
});
