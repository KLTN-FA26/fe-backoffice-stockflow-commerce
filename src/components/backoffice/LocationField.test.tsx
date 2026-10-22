import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { LocationField } from "./LocationField";

import type { TestRole } from "@/test/api-screen";

afterEach(() => vi.restoreAllMocks());

const LAYOUT = "/warehouses/wh-1/layout";
const AREAS = {
  areas: [
    { code: "PRD01", type: "PRODUCTION", name: "Xưởng in", locationCode: "HCM-PRD01" },
    { code: "PACK01", type: "PACKING", name: "Đóng gói", locationCode: "HCM-PACK01" },
  ],
};

function Harness({ onPick }: { onPick: (code: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <LocationField
      id="to"
      label="Khu sản xuất nhận phôi"
      warehouseId="wh-1"
      areaType="PRODUCTION"
      value={value}
      onChange={(code) => {
        setValue(code);
        onPick(code);
      }}
      required
    />
  );
}

const render = (role: TestRole, onPick = vi.fn()) =>
  renderScreen(<Harness onPick={onPick} />, role);

describe("LocationField — chọn khu trong kho của lệnh", () => {
  it("đang tải sơ đồ → select khoá, không hiện ô nhập tạm rồi tráo sang select", async () => {
    let release = () => {};
    mockApi("WAREHOUSE_STAFF", {
      get: { [LAYOUT]: () => new Promise((resolve) => (release = () => resolve(AREAS))) },
    });
    render("WAREHOUSE_STAFF");
    const busy = await screen.findByRole("combobox", { name: /Khu sản xuất nhận phôi/ });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("option", { name: "Đang tải vị trí…" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    release();
    expect(await screen.findByRole("option", { name: "HCM-PRD01 — Xưởng in" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Khu sản xuất nhận phôi/ })).toBeEnabled();
  });

  it("có sơ đồ → chỉ liệt kê khu đúng loại, chọn được", async () => {
    const onPick = vi.fn();
    mockApi("WAREHOUSE_MANAGER", { get: { [LAYOUT]: () => AREAS } });
    render("WAREHOUSE_MANAGER", onPick);
    await screen.findByRole("option", { name: "HCM-PRD01 — Xưởng in" });
    expect(screen.queryByRole("option", { name: /HCM-PACK01/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /Khu sản xuất nhận phôi/ }),
      "HCM-PRD01",
    );
    expect(onPick).toHaveBeenLastCalledWith("HCM-PRD01");
  });

  it("không có quyền xem sơ đồ (QC) → ô nhập / quét mã, không gọi layout", async () => {
    const onPick = vi.fn();
    const api = mockApi("QC_STAFF");
    render("QC_STAFF", onPick);
    const box = await screen.findByRole("textbox", { name: /Khu sản xuất nhận phôi/ });
    await userEvent.type(box, "hcm-prd01");
    expect(onPick).toHaveBeenLastCalledWith("HCM-PRD01");
    expect(api.get).not.toHaveBeenCalledWith(LAYOUT, expect.anything());
  });

  it("tải sơ đồ lỗi → quay về ô nhập / quét mã", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: {
        [LAYOUT]: () => {
          throw apiError(500, "INTERNAL_ERROR");
        },
      },
    });
    render("WAREHOUSE_STAFF");
    expect(
      await screen.findByRole("textbox", { name: /Khu sản xuất nhận phôi/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nhập hoặc quét mã vị trí/)).toBeInTheDocument();
  });
});
