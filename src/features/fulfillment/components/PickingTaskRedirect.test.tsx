import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
import { TASK_ID, WAREHOUSE_ID, apiTask, bePage } from "../__fixtures__/task";
import { PickingTaskRedirect } from "./PickingTaskRedirect";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe("link cũ /admin/picking/{id} → task trong tab theo kho (spec §5.5)", () => {
  it("chuyển sang kho của task (kho xuất của đơn)", async () => {
    mockFulfillmentApi(IDENTITIES.warehouseManager, {
      [`/fulfillment/tasks/${TASK_ID}`]: () => apiTask(),
      "/warehouses": () =>
        bePage([{ id: WAREHOUSE_ID, prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }]),
    });
    renderFulfillmentScreen(<PickingTaskRedirect id={TASK_ID} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/admin/warehouse-map/HCM/picking/${TASK_ID}`),
    );
  });
});
