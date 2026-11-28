import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHIPMENT_CANCELLATION_PERMISSIONS,
  SHIPMENT_FAILURE_REASON_PERMISSIONS,
  SHIPPING_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { apiShipment } from "../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { ShipmentScreen } from "./ShipmentScreen";

import type { TestActor } from "../__fixtures__/render";
import type { Shipment } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = "/fulfillment/shipments/shp-1";
const A = UI_LABELS.shipping.afterHandover;
const C = A.reasonCorrection;
const MANAGER: TestActor = {
  permissions: [
    ...ACTORS.warehouseManager.permissions,
    SHIPMENT_FAILURE_REASON_PERMISSIONS.correct,
  ],
};

function returned(patch: Partial<Shipment> = {}): Shipment {
  return {
    ...apiShipment({
      status: "RETURNED",
      failureReason: "OTHER",
      handedOverAt: "2026-10-21T03:00:00Z",
    }),
    failureNote: "hãng báo hoàn hàng",
    timeline: [
      {
        status: "READY_TO_DISPATCH",
        occurredAt: "2026-10-20T02:00:00Z",
        recordedByName: "Packer",
        source: "MANUAL",
      },
      {
        status: "DELIVERY_FAILED",
        occurredAt: "2026-10-22T02:00:00Z",
        source: "CARRIER_WEBHOOK",
        carrierEventId: "ev-1",
      },
      {
        status: "RETURNED",
        occurredAt: "2026-10-22T02:00:00Z",
        source: "CARRIER_WEBHOOK",
        carrierEventId: "ev-1",
      },
    ],
    ...patch,
  };
}

function render(actor: TestActor, data: Shipment, correct?: (body: unknown) => Shipment) {
  // Lô hiện tại phía "BE": sau khi sửa, lần tải lại (invalidate) trả bản đã sửa
  let current = data;
  const spies = mockShippingApi(actor, {
    get: { [PATH]: () => current },
    post: {
      [`${PATH}/failure-reason-correction`]: (_p, body) => {
        current = (correct ?? (() => current))(body);
        return current;
      },
    },
  });
  renderShippingScreen(<ShipmentScreen id="shp-1" />);
  return spies;
}

describe("Lô giao sau bàn giao — bước do hãng báo, sửa lý do thất bại", () => {
  it("docs 09 BR-02 (G14): bước do webhook ghi hiện 'Hãng báo (webhook)', bước ghi tay hiện người ghi", async () => {
    render(ACTORS.viewOnly, returned());
    expect(await screen.findAllByText(A.webhookSource)).toHaveLength(2);
    expect(screen.getByText(/Packer/)).toBeInTheDocument();
  });

  it("chỉ người có quyền sửa tay kết quả giao thấy nút; lô chưa thất bại thì không", async () => {
    render(ACTORS.warehouseManager, returned());
    await screen.findAllByText(A.webhookSource);
    expect(screen.queryByRole("button", { name: C.button })).not.toBeInTheDocument();
  });

  it("lô đang giao không có nút sửa lý do", async () => {
    render(
      MANAGER,
      returned({
        shipment: { ...returned().shipment, status: "HANDED_OVER", failureReason: null },
      }),
    );
    await screen.findAllByText(A.webhookSource);
    expect(screen.queryByRole("button", { name: C.button })).not.toBeInTheDocument();
  });

  it("sửa lý do: bắt buộc lý do sửa → POST {failureReason, reason}; 409 SHIPMENT_FAILURE_REASON_LOCKED hiện trong hộp thoại", async () => {
    const user = userEvent.setup();
    const fixed = returned({
      shipment: { ...returned().shipment, failureReason: "REFUSED" },
      reasonCorrections: [
        {
          fromReason: "OTHER",
          fromNote: "hãng báo hoàn hàng",
          toReason: "REFUSED",
          reason: "Hãng gọi lại: khách từ chối",
          correctedByName: "Quản lý kho",
          correctedAt: "2026-10-23T02:00:00Z",
        },
      ],
    });
    const { post } = render(MANAGER, returned(), () => fixed);
    await user.click(await screen.findByRole("button", { name: C.button }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Khách từ chối nhận" }));
    const save = within(dialog).getByRole("button", { name: C.confirm });
    expect(save).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText(new RegExp(C.reasonLabel)),
      "Hãng gọi lại: khách từ chối",
    );
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/failure-reason-correction`, {
        failureReason: "REFUSED",
        reason: "Hãng gọi lại: khách từ chối",
      }),
    );
    expect(await screen.findByText(C.historyTitle)).toBeInTheDocument();
    expect(screen.getByText(/Hãng gọi lại: khách từ chối/)).toBeInTheDocument();

    post.mockRejectedValueOnce(new ApiError(409, "SHIPMENT_FAILURE_REASON_LOCKED", "en"));
    await user.click(screen.getByRole("button", { name: C.button }));
    const again = await screen.findByRole("dialog");
    await user.click(within(again).getByRole("radio", { name: "Hàng hư hỏng" }));
    await user.type(within(again).getByLabelText(new RegExp(C.reasonLabel)), "x");
    await user.click(within(again).getByRole("button", { name: C.confirm }));
    expect(await within(again).findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.SHIPMENT_FAILURE_REASON_LOCKED,
    );
  });
});

describe("RTM-RTDCANCEL — QLK huỷ lô Sẵn sàng xuất", () => {
  const X = A.shipmentCancel;
  const CANCELLER: TestActor = {
    permissions: [...ACTORS.warehouseManager.permissions, SHIPMENT_CANCELLATION_PERMISSIONS.update],
  };
  const ready = () => apiShipment({ status: "READY_TO_DISPATCH" });

  it("chỉ người có quyền thấy nút; lô đã bàn giao thì không", async () => {
    render(ACTORS.warehouseManager, ready());
    await screen.findByText("PKG-SO-1-1");
    expect(screen.queryByRole("button", { name: X.button })).not.toBeInTheDocument();
  });

  it("nhập lý do, đánh dấu thùng hư → POST /cancellation {reason, damagedPackageIds}", async () => {
    const user = userEvent.setup();
    const cancelled = apiShipment({ status: "CANCELLED" });
    const spies = mockShippingApi(CANCELLER, {
      get: { [PATH]: () => ready() },
      post: { [`${PATH}/cancellation`]: () => cancelled },
    });
    renderShippingScreen(<ShipmentScreen id="shp-1" />);
    await user.click(await screen.findByRole("button", { name: X.button }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("checkbox", { name: `${X.damagedLabel}: PKG-SO-1-2` }),
    );
    await user.type(within(dialog).getByRole("textbox"), "Mọi thùng móp khi chờ xe");
    await user.click(within(dialog).getByRole("button", { name: X.confirm }));
    await waitFor(() =>
      expect(spies.post).toHaveBeenCalledWith(`${PATH}/cancellation`, {
        reason: "Mọi thùng móp khi chờ xe",
        damagedPackageIds: ["pkg-2"],
      }),
    );
  });
});
