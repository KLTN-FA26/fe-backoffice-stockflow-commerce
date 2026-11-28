import { render, screen } from "@testing-library/react";
import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";

import { DetailSection, InfoRow } from "./DetailSection";

describe("DetailSection", () => {
  it("names its region by the title and shows its content", () => {
    render(
      <DetailSection title="Thông tin chung" icon={Layers}>
        <InfoRow label="SKU">SKU-1</InfoRow>
      </DetailSection>,
    );
    expect(screen.getByRole("heading", { name: "Thông tin chung" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Thông tin chung" })).toHaveTextContent("SKU-1");
  });

  it("never collapses: no toggle, and the content shows even when defaultOpen is false", () => {
    render(
      <DetailSection title="Số mặc định" defaultOpen={false}>
        <p>Nội dung</p>
      </DetailSection>,
    );
    expect(screen.queryByRole("button", { name: "Số mặc định" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Số mặc định" })).toHaveTextContent("Nội dung");
  });

  it("puts the actions on the title row, inside the region", () => {
    render(
      <DetailSection title="Biến thể" actions={<button type="button">Thêm biến thể</button>}>
        <p>x</p>
      </DetailSection>,
    );
    const region = screen.getByRole("region", { name: "Biến thể" });
    expect(region).toContainElement(screen.getByRole("button", { name: "Thêm biến thể" }));
  });

  it("a bare section has no card frame; a normal one does", () => {
    render(
      <>
        <DetailSection title="Khung">
          <p>a</p>
        </DetailSection>
        <DetailSection title="Trơn" bare>
          <p>b</p>
        </DetailSection>
      </>,
    );
    expect(screen.getByRole("region", { name: "Khung" })).toHaveClass("border", "bg-bg-surface");
    expect(screen.getByRole("region", { name: "Trơn" })).not.toHaveClass("border");
  });
});
