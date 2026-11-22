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

function show(role: TestRole) {
  const spies = mockApi(role, { get: { "/warehouses/wh-hcm/layout": () => LAYOUT } });
  renderScreen(<WarehouseRouteMap warehouseId="wh-hcm" path={PATH} />, role);
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
    // C46: đường thẳng không tránh kệ / tường — phải nói rõ
    expect(within(map).getByText(R.note)).toBeVisible();
  });

  it("hai điểm dừng trùng điểm đứng (bin khác tầng cùng cột) không chồng lên nhau", async () => {
    show("WAREHOUSE_STAFF");
    const [first, second] = await screen.findAllByRole("img", { name: /^Điểm [12] / });
    const cx = (marker: HTMLElement | undefined) =>
      marker?.querySelector("circle")?.getAttribute("cx");
    expect(cx(first)).not.toEqual(cx(second));
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
