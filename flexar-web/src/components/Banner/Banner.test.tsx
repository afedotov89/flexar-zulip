import { render, screen, fireEvent } from "@testing-library/react";
import { Banner } from ".";

// Banner is an inline alert. Tone drives the ARIA role: info/success
// are polite (role="status"), warning/danger are assertive
// (role="alert"). An optional onDismiss renders a close button.

describe("Banner", () => {
  it("renders title and body content", () => {
    render(
      <Banner tone="info" title="Heads up">
        Something happened.
      </Banner>,
    );
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Something happened.")).toBeInTheDocument();
  });

  it("uses role=status for info and success tones", () => {
    const { rerender } = render(<Banner tone="info">i</Banner>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<Banner tone="success">s</Banner>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role=alert for warning and danger tones", () => {
    const { rerender } = render(<Banner tone="warning">w</Banner>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<Banner tone="danger">d</Banner>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows a leading status icon for every tone", () => {
    const tones = ["info", "success", "warning", "danger"] as const;
    for (const tone of tones) {
      const { container, unmount } = render(<Banner tone={tone}>x</Banner>);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("renders a dismiss button and fires onDismiss when activated", () => {
    const onDismiss = vi.fn();
    render(
      <Banner tone="info" onDismiss={onDismiss}>
        body
      </Banner>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("omits the dismiss button when onDismiss is not given", () => {
    render(<Banner tone="info">body</Banner>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses a custom dismiss label", () => {
    render(
      <Banner tone="info" onDismiss={() => {}} dismissLabel="Close banner">
        body
      </Banner>,
    );
    expect(
      screen.getByRole("button", { name: "Close banner" }),
    ).toBeInTheDocument();
  });
});
