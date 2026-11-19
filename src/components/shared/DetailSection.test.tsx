import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DetailSection, InfoRow } from "./DetailSection";

describe("DetailSection", () => {
  it("an open section names its region by the title and says it is expanded", () => {
    render(
      <DetailSection title="Thông tin chung" icon={Layers}>
        <InfoRow label="SKU">SKU-1</InfoRow>
      </DetailSection>,
    );
    const toggle = screen.getByRole("button", { name: "Thông tin chung" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Thông tin chung" })).toHaveTextContent("SKU-1");
  });

  it("a closed section shows nothing until its title is clicked", async () => {
    render(
      <DetailSection title="Số mặc định" defaultOpen={false}>
        <p>Nội dung</p>
      </DetailSection>,
    );
    const toggle = screen.getByRole("button", { name: "Số mặc định" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Nội dung")).not.toBeInTheDocument();
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Nội dung")).toBeInTheDocument();
  });

  it("the open title has no grey background: the ghost variant's expanded and hover fills are overridden", () => {
    render(
      <DetailSection title="Thông tin chung">
        <p>x</p>
      </DetailSection>,
    );
    const toggle = screen.getByRole("button", { name: "Thông tin chung" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const kept of [
      "aria-expanded:bg-transparent",
      "hover:bg-transparent",
      "active:bg-transparent",
      "aria-expanded:text-ink-primary",
      "hover:text-accent",
    ]) {
      expect(toggle).toHaveClass(kept);
    }
    for (const dropped of ["aria-expanded:bg-muted", "hover:bg-muted", "dark:hover:bg-muted/50"]) {
      expect(toggle).not.toHaveClass(dropped);
    }
    // the focus ring of the button stays (a ring, not a fill)
    expect(toggle).toHaveClass("focus-visible:ring-3");
  });
});
