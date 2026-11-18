/**
 * Biên bản giao nhận (POD) trên lô giao (docs 09 §4.3 bước 2, BR-28; BE `ShipmentPodController`): gate theo mã quyền
 * `fulfillment-delivery-outcomes:UPDATE` và trạng thái lô (chỉ lô đã giao), giải thích tiếng Việt khi chưa tải lên được,
 * và có mặt trên màn lô giao.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_FILE_LABELS as L } from "@/constants/shipping-files";
import { storageClient } from "@/lib/api/direct-upload";

import { apiShipment } from "../../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../../__fixtures__/render";
import { ShipmentScreen } from "../ShipmentScreen";
import { ShipmentPodFiles, podBlockedReason } from "./ShipmentPodFiles";

import type { TestActor } from "../../__fixtures__/render";
import type { ShipmentRow } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = "/fulfillment/shipments/shp-1";
const POD = {
  fileId: "11111111-1111-4111-8111-111111111111",
  shipmentId: "shp-1",
  fileName: "bien-ban-ky.png",
  contentType: "image/png",
  sizeBytes: 912,
  uploadedBy: "33333333-3333-4333-8333-333333333333",
  uploadedAt: "2026-11-17T15:00:00Z",
};
const input = () => document.querySelector<HTMLInputElement>("input[type='file']");

function renderCard(actor: TestActor, status: ShipmentRow["status"], files: unknown[] = [POD]) {
  const spies = mockShippingApi(actor, { get: { [`${PATH}/pod-files`]: () => files } });
  renderShippingScreen(<ShipmentPodFiles shipment={{ shipmentId: "shp-1", status }} />);
  return spies;
}

describe("podBlockedReason", () => {
  it("chỉ lô đã giao nhận biên bản; lô đang đi giải thích phải ghi nhận giao trước; hoàn / huỷ thì không áp dụng", () => {
    expect(podBlockedReason("DELIVERED")).toBeNull();
    for (const status of [
      "READY_TO_DISPATCH",
      "HANDED_OVER",
      "DELIVERY_FAILED",
      "UNKNOWN",
    ] as const) {
      expect(podBlockedReason(status)).toBe(L.pod.notDelivered);
    }
    for (const status of ["RETURNED", "CANCELLED"] as const) {
      expect(podBlockedReason(status)).toBe(L.pod.notApplicable);
    }
  });
});

describe("ShipmentPodFiles — gate quyền và trạng thái", () => {
  it("quản lý kho (fulfillment-delivery-outcomes:UPDATE), lô đã giao: xem danh sách và có hộp tải lên chỉ nhận PDF / ảnh", async () => {
    renderCard(ACTORS.warehouseManager, "DELIVERED");
    expect(await screen.findByText("bien-ban-ky.png")).toBeInTheDocument();
    expect(input()).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png");
  });

  it("điều phối giao hàng (UPDATE + APPROVE), lô đã giao: tải lên được", async () => {
    renderCard(ACTORS.orderCoordinator, "DELIVERED");
    expect(await screen.findByText("bien-ban-ky.png")).toBeInTheDocument();
    expect(input()).not.toBeNull();
  });

  it("lô đã bàn giao chưa giao: giải thích bằng tiếng Việt, không có hộp tải lên", async () => {
    renderCard(ACTORS.warehouseManager, "HANDED_OVER", []);
    expect(await screen.findByText(L.pod.notDelivered)).toBeInTheDocument();
    expect(screen.getByText(L.pod.empty)).toBeInTheDocument();
    expect(input()).toBeNull();
  });

  it("lô đã hoàn về kho: nói rõ không có biên bản", async () => {
    renderCard(ACTORS.warehouseManager, "RETURNED", []);
    expect(await screen.findByText(L.pod.notApplicable)).toBeInTheDocument();
    expect(input()).toBeNull();
  });

  it("người chỉ có quyền đọc: xem được biên bản đã có, không có hộp tải lên, không bị nhắc ghi nhận giao", async () => {
    renderCard(ACTORS.viewOnly, "HANDED_OVER", [POD]);
    expect(await screen.findByText("bien-ban-ky.png")).toBeInTheDocument();
    expect(input()).toBeNull();
    expect(screen.getByText(L.common.viewOnly)).toBeInTheDocument();
    expect(screen.queryByText(L.pod.notDelivered)).not.toBeInTheDocument();
  });

  it("nhân viên kho (có fulfillment-dispatch nhưng không có fulfillment-delivery-outcomes) không tải lên được", async () => {
    renderCard(ACTORS.warehouseStaff, "DELIVERED");
    expect(await screen.findByText("bien-ban-ky.png")).toBeInTheDocument();
    expect(input()).toBeNull();
  });

  it("tải biên bản lên cho lô đã giao: khai báo ảnh PNG rồi gắn bằng uploadId", async () => {
    const user = userEvent.setup();
    vi.spyOn(storageClient, "request").mockResolvedValue({ status: 200 });
    const spies = renderCard(ACTORS.warehouseManager, "DELIVERED", []);
    spies.post.mockImplementation(async (url: string) => ({
      data: url.endsWith("/uploads")
        ? {
            uploadId: "u-9",
            method: "PUT",
            url: "https://bucket.s3.amazonaws.com/u-9",
            headers: {},
          }
        : POD,
    }));
    await screen.findByText(L.pod.empty);
    await user.upload(input()!, new File(["png"], "bien-ban-ky.png", { type: "image/png" }));
    expect(await screen.findByText(L.common.uploaded("bien-ban-ky.png"))).toBeInTheDocument();
    expect(spies.post).toHaveBeenCalledWith(
      `${PATH}/pod-files/uploads`,
      expect.objectContaining({
        fileName: "bien-ban-ky.png",
        contentType: "image/png",
        sizeBytes: 3,
      }),
      expect.anything(),
    );
    expect(spies.post).toHaveBeenCalledWith(
      `${PATH}/pod-files`,
      { uploadId: "u-9" },
      expect.anything(),
    );
  });
});

describe("ShipmentScreen — thẻ Biên bản giao nhận (POD)", () => {
  it("lô đã giao: màn lô giao có thẻ POD kèm file của lô đó", async () => {
    mockShippingApi(ACTORS.warehouseManager, {
      get: {
        [PATH]: () => apiShipment({ status: "DELIVERED" }),
        [`${PATH}/pod-files`]: () => [POD],
      },
    });
    renderShippingScreen(<ShipmentScreen id="shp-1" />);
    expect(await screen.findByRole("heading", { name: `${L.pod.title} (1)` })).toBeInTheDocument();
    expect(screen.getByText("bien-ban-ky.png")).toBeInTheDocument();
  });

  it("lô đã bàn giao: thẻ POD giải thích vì sao chưa tải lên được", async () => {
    mockShippingApi(ACTORS.warehouseManager, {
      get: { [PATH]: () => apiShipment({ status: "HANDED_OVER" }) },
    });
    renderShippingScreen(<ShipmentScreen id="shp-1" />);
    expect(await screen.findByText(L.pod.notDelivered)).toBeInTheDocument();
  });
});
