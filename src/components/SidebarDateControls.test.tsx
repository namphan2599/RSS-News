import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarDateControls } from "./SidebarDateControls";

describe("SidebarDateControls", () => {
  it("renders date controls and forwards date changes", () => {
    const onChange = vi.fn();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <SidebarDateControls
        ariaLabel="Digest date controls"
        label="Digest date"
        onChange={onChange}
        onNext={onNext}
        onPrevious={onPrevious}
        value="2026-06-08"
      />,
    );

    expect(screen.getByLabelText("Digest date controls")).toBeInTheDocument();
    expect(screen.getByText("Digest date")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-06-08")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("2026-06-08"), { target: { value: "2026-06-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(onChange).toHaveBeenCalledWith("2026-06-07");
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
