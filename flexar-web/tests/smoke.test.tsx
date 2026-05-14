import { render, screen } from "@testing-library/react";
import { App } from "../src/app/App";

describe("App", () => {
  it("renders the token showcase inside the theme provider", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Flexar Hub — Design Tokens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to .* theme/i }),
    ).toBeInTheDocument();
  });
});
