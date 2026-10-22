/**
 * Chỗ ghép chi tiết đơn + "Ước tính xếp xe" (SCRUM-287 F3): hai feature không import chéo nhau, nên đây là nơi duy nhất
 * nối nút ước tính của `load-planning` vào khe `estimateSlot` của `order`. Test đi qua chuỗi thật: quyền BE → thẻ hình
 * thức giao → nút → ngăn kéo (khung 3D thay bằng nút giả vì jsdom không có WebGL).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOAD_ESTIMATE_PERMISSIONS } from "@/constants";
import { apiEstimate } from "@/features/load-planning/__fixtures__/estimate";
import { apiOrder, apiOrderDelivery } from "@/features/order/__fixtures__/order";
import { DETAIL_PATH, HISTORY_PATH } from "@/features/order/__fixtures__/detail";
import {
  mockOrderApiGet,
  ORDER_PERMISSION_SETS,
  renderOrderScreen,
} from "@/features/order/__fixtures__/render";

import { OrderDetailWithLoadEstimate } from "./OrderDetailWithLoadEstimate";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/load-planning/components/viewer/VehicleViewer", () => ({
  VehicleViewer: ({ layout }: { layout: { code: string } }) => (
    <div data-testid="viewer">{layout.code}</div>
  ),
}));

afterEach(() => vi.restoreAllMocks());

const ESTIMATES = "/fulfillment/load-estimates";
const TYPES = "/fulfillment/vehicle-types";

async function renderScreen(
  status: Parameters<typeof apiOrderDelivery>[0],
  permissions: Parameters<typeof mockOrderApiGet>[0],
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () =>
      apiOrderDelivery(status, { deliveryMode: "FULL_TRUCKLOAD", deliveryModeLocked: false }),
    [HISTORY_PATH]: () => [],
    [ESTIMATES]: () => apiEstimate(),
    [TYPES]: () => ({
      items: [],
      page: 0,
      size: 200,
      totalElements: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    }),
  });
  await act(async () => {
    renderOrderScreen(
      <OrderDetailWithLoadEstimate params={Promise.resolve({ id: apiOrder.orderId })} />,
    );
  });
}

describe("OrderDetailWithLoadEstimate", () => {
  it("đơn đã release + fulfillment-load-estimates:READ → nút 'Ước tính xếp xe' trong thẻ hình thức giao mở ngăn kéo có ước tính hiện hành", async () => {
    await renderScreen("READY_TO_FULFILL", [
      ...ORDER_PERMISSION_SETS.readOnly,
      LOAD_ESTIMATE_PERMISSIONS.read,
    ]);
    const card = await screen.findByRole("region", { name: "Hình thức giao" });
    const user = userEvent.setup();
    await user.click(await within(card).findByRole("button", { name: "Ước tính xếp xe" }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getAllByText("Ước tính — chỉ để tham khảo").length).toBeGreaterThan(0);
    expect(await within(drawer).findByTestId("viewer")).toHaveTextContent("40HC");
  });

  it("thiếu cả hai mã fulfillment-load-estimates → không có nút (đơn chỉ đọc)", async () => {
    await renderScreen("READY_TO_FULFILL", ORDER_PERMISSION_SETS.readOnly);
    await screen.findByRole("region", { name: "Hình thức giao" });
    await waitFor(() => expect(screen.getByText("Nguyên xe (FTL)")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ước tính xếp xe" })).not.toBeInTheDocument();
  });

  it("đơn CONFIRMED: nút ước tính nằm trong hộp thoại release, khoá tới khi chọn kho", async () => {
    mockOrderApiGet(
      [...ORDER_PERMISSION_SETS.coordinatorWithModes, LOAD_ESTIMATE_PERMISSIONS.create],
      {
        [DETAIL_PATH]: () =>
          apiOrderDelivery("CONFIRMED", { deliveryMode: "PARCEL", deliveryModeLocked: false }),
        [HISTORY_PATH]: () => [],
        "/warehouses": () => ({
          items: [{ id: "wh-hn", prefix: "HN01", name: "Kho Hà Nội", status: "ACTIVE" }],
        }),
        [TYPES]: () => ({
          items: [],
          page: 0,
          size: 200,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      },
    );
    await act(async () => {
      renderOrderScreen(
        <OrderDetailWithLoadEstimate params={Promise.resolve({ id: apiOrder.orderId })} />,
      );
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Release đơn" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Ước tính xếp xe" }));
    // ngăn kéo mở TRÊN hộp thoại release (Radix ẩn hộp thoại bên dưới khỏi cây truy cập); chưa chọn kho nên khoá nút
    expect(await screen.findByText("Chọn kho trước khi ước tính.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Ước tính" })).toBeDisabled();
  });
});
