import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { PutawayTaskRedirect } from "../components/PutawayTaskRedirect";
import { task } from "./fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const WAREHOUSES = {
  items: [{ id: "wh-bd", prefix: "BD", name: "Kho Bình Dương", status: "ACTIVE" }],
  page: 0,
  size: 200,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe("link cũ /admin/putaway/{taskId} → nhiệm vụ trong tab theo kho (spec §5.5)", () => {
  it("BE trả warehouseId (BE #394) → kho của nhiệm vụ", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: {
        "/putaway-tasks/t-1": () => ({ ...task({ id: "t-1" }), warehouseId: "wh-bd" }),
        "/warehouses": () => WAREHOUSES,
      },
    });
    renderScreen(<PutawayTaskRedirect taskId="t-1" />, "WAREHOUSE_STAFF");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/putaway/t-1"),
    );
  });

  it("BE chưa trả warehouseId → prefix kho từ mã vị trí thùng đang đứng", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: { "/putaway-tasks/t-1": () => task({ id: "t-1", sourceLocationCode: "bd-rcv-01" }) },
    });
    renderScreen(<PutawayTaskRedirect taskId="t-1" />, "WAREHOUSE_STAFF");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/putaway/t-1"),
    );
  });
});
