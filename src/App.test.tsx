import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("processes the built-in screenshot sample", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "執行辨識遮蔽" }));

    expect(screen.getByTestId("redaction-rate")).toHaveTextContent("100%");
    expect(screen.getByText("已遮蔽 · phone · 160")).toBeInTheDocument();
    expect(screen.getByText("O987-65I-23B")).toBeInTheDocument();
  });
});
