import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LAYOUT_40HC, LAYOUT_PICKUP_KIT, UNPLACED_40HC } from "../../__fixtures__/layouts";

import { VehicleItemTable } from "./VehicleItemTable";

const rowOf = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("VehicleItemTable", () => {
  it("names the table for assistive tech with a caption", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC]} />);
    expect(screen.getByRole("table", { name: "Số kiện đã xếp theo xe" })).toBeInTheDocument();
  });

  it("lists one row per item with the nominal D×R×C in cm and the per-vehicle count", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC]} />);
    expect(screen.getByText("Số kiện đã xếp theo xe")).toBeInTheDocument();
    const row = within(rowOf("Thùng sofa"));
    expect(row.getByText("60×40×40")).toBeInTheDocument();
    expect(row.getByText("SF-A")).toBeInTheDocument();
    expect(row.getAllByText("120")).toHaveLength(3); // xe #1, đã xếp, tổng
  });

  it("has a column per vehicle, titled with its type", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC, { ...LAYOUT_PICKUP_KIT, seq: 2 }]} />);
    expect(screen.getByRole("columnheader", { name: "#1" })).toHaveAttribute(
      "title",
      "Xe #1 · 40HC",
    );
    expect(screen.getByRole("columnheader", { name: "#2" })).toHaveAttribute(
      "title",
      "Xe #2 · PICKUP-1T",
    );
  });

  it("flags rows that still have unplaced pieces and shows the requested total", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC]} unplaced={UNPLACED_40HC} />);
    const table = within(rowOf("Bàn trà"));
    expect(table.getByText("52")).toHaveClass("text-warning");
    expect(table.getByText("40", { selector: "td.font-medium" })).toBeInTheDocument();
    // dòng chỉ có hàng chưa xếp vẫn hiện đúng tên
    expect(within(rowOf("Tủ vải")).getByText("3")).toBeInTheDocument();
  });

  it("does not warn for a fully loaded item", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC]} unplaced={UNPLACED_40HC} />);
    const row = within(rowOf("Ghế ăn"));
    expect(row.getAllByText("96").at(-1)).not.toHaveClass("text-warning");
  });

  it("footer sums per vehicle, loaded and requested", () => {
    render(<VehicleItemTable layouts={[LAYOUT_40HC]} unplaced={UNPLACED_40HC} />);
    const footer = within(screen.getByRole("row", { name: /^Tổng/ }));
    expect(footer.getAllByText("438")).toHaveLength(2);
    expect(footer.getByText("453")).toBeInTheDocument();
  });

  it("renders nothing without items", () => {
    const { container } = render(<VehicleItemTable layouts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
