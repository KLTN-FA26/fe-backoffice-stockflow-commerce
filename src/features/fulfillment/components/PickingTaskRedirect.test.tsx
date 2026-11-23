import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
import { apiSession } from "../__fixtures__/carton-check";
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

  it("link cũ /admin/packing/{id} → trạm kiểm thùng, kho đọc từ phiên kiểm thùng (không cần quyền lấy hàng)", async () => {
    mockFulfillmentApi(IDENTITIES.warehouseManager, {
      // Chỉ có phiên kiểm thùng: role chỉ có fulfillment-packages vẫn đi được (CartonCheckSessionResponse.warehouseId)
      [`/fulfillment/tasks/${TASK_ID}/packing-session`]: () => ({
        ...apiSession(),
        warehouseId: WAREHOUSE_ID,
      }),
      "/warehouses": () =>
        bePage([{ id: WAREHOUSE_ID, prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }]),
    });
    renderFulfillmentScreen(<PickingTaskRedirect id={TASK_ID} scope="packing" />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/admin/warehouse-map/HCM/packing/${TASK_ID}`),
    );
  });

  describe("task BE không trả kho (`warehouseId` null) — không đẩy về bước chọn kho mà không giải thích", () => {
    const noWarehouse = () => ({ ...apiTask(), warehouseId: null });

    it("có khu chờ xuất → prefix kho từ mã vị trí", async () => {
      mockFulfillmentApi(IDENTITIES.warehouseManager, {
        [`/fulfillment/tasks/${TASK_ID}`]: () => ({
          ...noWarehouse(),
          stagingLocationCode: "bd-stg-01",
        }),
      });
      renderFulfillmentScreen(<PickingTaskRedirect id={TASK_ID} />);
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(`/admin/warehouse-map/BD/picking/${TASK_ID}`),
      );
    });

    it("không có vị trí, người dùng được gán đúng một kho → mở trong tab của kho đó", async () => {
      mockFulfillmentApi(
        {
          ...IDENTITIES.warehouseStaff,
          dataScope: "WAREHOUSE",
          warehouses: [{ id: "wh-bd", prefix: "BD" }],
        },
        { [`/fulfillment/tasks/${TASK_ID}`]: noWarehouse },
      );
      renderFulfillmentScreen(<PickingTaskRedirect id={TASK_ID} />);
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(`/admin/warehouse-map/BD/picking/${TASK_ID}`),
      );
    });

    it("không suy ra được kho → báo rõ kèm link chọn kho, không tự chuyển trang", async () => {
      mockFulfillmentApi(IDENTITIES.warehouseManager, {
        [`/fulfillment/tasks/${TASK_ID}`]: noWarehouse,
      });
      renderFulfillmentScreen(<PickingTaskRedirect id={TASK_ID} />);
      expect(await screen.findByText(UI_LABELS.fulfillment.noWarehouseTitle)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: UI_LABELS.warehouseMap.workspace.backToChooser }),
      ).toHaveAttribute("href", "/admin/warehouse-map");
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
