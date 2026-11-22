import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WAREHOUSE_COLUMNS } from "@/constants";

import { buildWarehouseColumns } from "./columns";

import type { Warehouse } from "@/features/warehouse-map/types";

const warehouse = (id: string, prefix: string, name: string): Warehouse => ({
  id,
  prefix,
  name,
  address: "12 Đường Demo",
  mapUnit: "M",
  mapWidth: 60,
  mapHeight: 40,
  status: "ACTIVE",
  version: 0,
});

const nameCell = (row: Warehouse) => {
  const columns = buildWarehouseColumns({
    canOpenMap: true,
    isAssigned: (prefix) => prefix === "BD",
  });
  const column = columns.find((c) => c.key === WAREHOUSE_COLUMNS.NAME);
  return render(<>{column?.cell?.(row)}</>);
};

describe("danh mục kho đánh dấu kho không được gán (spec §5.3)", () => {
  it("kho không được gán → nhãn Không được gán cạnh tên kho", () => {
    nameCell(warehouse("wh-hcm", "HCM", "Kho Hồ Chí Minh"));
    expect(screen.getByText("Kho Hồ Chí Minh")).toBeInTheDocument();
    expect(screen.getByText("Không được gán")).toBeInTheDocument();
  });

  it("kho được gán → không có nhãn", () => {
    nameCell(warehouse("wh-bd", "BD", "Kho Bình Dương"));
    expect(screen.queryByText("Không được gán")).not.toBeInTheDocument();
  });

  it("nút mở bản đồ vẫn có cho kho không được gán (bản đồ không giới hạn theo kho được gán — 06)", () => {
    const columns = buildWarehouseColumns({ canOpenMap: true, isAssigned: () => false });
    const actions = columns.find((c) => c.key === WAREHOUSE_COLUMNS.ACTIONS);
    render(<>{actions?.cell?.(warehouse("wh-hcm", "HCM", "Kho Hồ Chí Minh"))}</>);
    expect(screen.getByRole("link", { name: "Mở bản đồ HCM" })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM",
    );
  });
});
