import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, PRODUCTION_LABELS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { ProductionOrderList } from "../components/ProductionOrderList";
import { bePage, PRODUCTION_ACTORS, producerDto } from "../__fixtures__/production-order";

const L = PRODUCTION_LABELS.order;

function setup(permissions = PRODUCTION_ACTORS.coordinator) {
  mockProductionApi(permissions, {
    get: {
      "/production-orders": () => bePage([]),
      "/producers": () => bePage([producerDto]),
    },
  });
  renderProductionScreen(<ProductionOrderList />);
}

afterEach(() => vi.restoreAllMocks());

describe("ProductionOrderList — nút Lập Đơn sản xuất (docs 17 §4.3 bước 6)", () => {
  it("Điều phối sản xuất: nút Lập dẫn sang tab Cần lập của lịch, không còn trang lập riêng", async () => {
    setup();
    const link = await screen.findByRole("link", { name: new RegExp(L.drawUp) });
    expect(link).toHaveAttribute("href", ADMIN_ROUTES.productionScheduleDrawUp);
  });

  it("Sales Manager (không có quyền lập) không thấy nút Lập", async () => {
    setup(PRODUCTION_ACTORS.salesManager);
    await screen.findByRole("textbox", { name: L.searchPlaceholder });
    expect(screen.queryByRole("link", { name: new RegExp(L.drawUp) })).not.toBeInTheDocument();
  });
});
