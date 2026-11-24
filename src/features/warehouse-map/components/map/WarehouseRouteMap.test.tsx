import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { mockApi, renderScreen } from "@/test/api-screen";

import { LAYOUT } from "@/features/warehouse-map/__fixtures__/layout";

import { WarehouseRouteMap } from "./WarehouseRouteMap";

import type { TestRole } from "@/test/api-screen";
import type { RouteMapPath } from "./RouteOverlay";

const R = UI_LABELS.warehouseMap.route;

beforeAll(() => {
  // jsdom không có ResizeObserver (đo khung bản đồ + tooltip Radix của thanh zoom)
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const PATH: RouteMapPath = {
  start: { locationCode: "HCM-RCV01", x: 3, y: 35 },
  stops: [
    { sequence: 1, locationCode: "HCM-A01-1-A", x: 2.5, y: 6, state: "done" },
    { sequence: 2, locationCode: "HCM-A01-2-A", x: 2.5, y: 6, state: "next" },
    { sequence: 3, locationCode: "HCM-OVF01", x: 50, y: 30, state: "todo" },
  ],
};

function show(role: TestRole, path: RouteMapPath = PATH) {
  const spies = mockApi(role, { get: { "/warehouses/wh-hcm/layout": () => LAYOUT } });
  renderScreen(<WarehouseRouteMap warehouseId="wh-hcm" path={path} />, role);
  return spies;
}

describe("WarehouseRouteMap — lộ trình chuyến cất trên Kho Map 2D (docs 05 §4.5 bước 14)", () => {
  it("vẽ mặt bằng kho + điểm xuất phát + điểm dừng đánh số theo thứ tự, kèm trạng thái", async () => {
    show("WAREHOUSE_STAFF");
    const map = await screen.findByRole("region", { name: R.label });
    expect(within(map).getByRole("group", { name: /Bản đồ 2D kho Kho Hồ Chí Minh/ })).toBeVisible();
    expect(within(map).getByRole("img", { name: "Xuất phát — HCM-RCV01" })).toBeInTheDocument();
    expect(
      within(map)
        .getAllByRole("img", { name: /^Điểm \d/ })
        .map((marker) => marker.getAttribute("aria-label")),
    ).toEqual([
      "Điểm 1 — HCM-A01-1-A — đã cất xong",
      "Điểm 2 — HCM-A01-2-A — nên tới tiếp",
      "Điểm 3 — HCM-OVF01",
    ]);
    // C46: đường chỉ là ước lượng từ bản đồ, thứ tự vẫn theo khoảng cách thẳng — phải nói rõ
    expect(within(map).getByText(R.note)).toBeVisible();
  });

  it("hai điểm dừng trùng điểm đứng (bin khác tầng cùng cột) không chồng lên nhau", async () => {
    show("WAREHOUSE_STAFF");
    const [first, second] = await screen.findAllByRole("img", { name: /^Điểm [12] / });
    const cx = (marker: HTMLElement | undefined) =>
      marker?.querySelector("circle")?.getAttribute("cx");
    expect(cx(first)).not.toEqual(cx(second));
  });

  it("vẽ đúng đường đi BE trả (vòng qua kệ A01, BE #410); chặng không có đường thì nối thẳng", async () => {
    // Kệ A01: x 5–15, y 5–6,2. Chặng 1 BE vòng qua đầu kệ; chặng 2 BE không có lối → đoạn thẳng
    const walk = [
      { x: 10, y: 2 },
      { x: 15.25, y: 4.75 },
      { x: 15.25, y: 6.45 },
      { x: 10, y: 6.2 },
    ];
    show("WAREHOUSE_STAFF", {
      start: { locationCode: "HCM-RCV01", x: 10, y: 2 },
      origin: { locationCode: "HCM-RCV01", x: 10, y: 2 },
      stops: [
        { sequence: 1, locationCode: "HCM-A01-1-A", x: 10, y: 6.2, state: "next", path: walk },
        { sequence: 2, locationCode: "HCM-OVF01", x: 50, y: 30, state: "todo", path: null },
      ],
    });
    const map = await screen.findByRole("region", { name: R.label });
    // Đường vẽ không có role / nhãn (trang trí, pointer-events-none) — đọc thẳng thuộc tính `points`
    expect(map.querySelector("polyline")?.getAttribute("points")).toBe(
      "10,2 15.25,4.75 15.25,6.45 10,6.2 50,30",
    );
    // Điểm gốc trùng khu nguồn → không có chấm "Vừa cất"
    expect(within(map).queryByRole("img", { name: /^Vừa cất/ })).not.toBeInTheDocument();
  });

  it('đã cất thùng ở bin khác: chặng 1 đi từ điểm gốc BE dùng để sắp, có chấm + chú giải "Vừa cất"', async () => {
    show("WAREHOUSE_STAFF", {
      start: { locationCode: "HCM-RCV01", x: 3, y: 35 },
      origin: { locationCode: "HCM-A01-1-B", x: 12.5, y: 6.2 },
      stops: [{ sequence: 1, locationCode: "HCM-OVF01", x: 50, y: 30, state: "next" }],
    });
    const map = await screen.findByRole("region", { name: R.label });
    expect(map.querySelector("polyline")?.getAttribute("points")).toBe("12.5,6.2 50,30");
    expect(within(map).getByRole("img", { name: "Vừa cất — HCM-A01-1-B" })).toBeInTheDocument();
    expect(within(map).getByRole("img", { name: "Xuất phát — HCM-RCV01" })).toBeInTheDocument();
    expect(within(map).getByText(R.legendOrigin)).toBeVisible();
  });

  it("thiếu quyền xem bản đồ (warehouse-locations:READ) → chỉ một dòng nhắc, không gọi API bản đồ", async () => {
    const spies = show("PRODUCTION_STAFF");
    // Đợi quyền tải xong — trước đó mọi quyền đều đọc là chưa có
    await waitFor(() =>
      expect(spies.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.getByText(R.noRead)).toBeVisible();
    expect(screen.queryByRole("region", { name: R.label })).not.toBeInTheDocument();
    expect(spies.get).not.toHaveBeenCalledWith("/warehouses/wh-hcm/layout", expect.anything());
  });
});
