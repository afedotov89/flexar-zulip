import { render, screen } from "@testing-library/react";
import { App } from "../src/app/App";

describe("App scaffold", () => {
  it("renders the scaffold placeholder screen", () => {
    render(<App />);
    expect(screen.getByText("Flexar Hub Web — scaffold OK")).toBeInTheDocument();
  });
});
