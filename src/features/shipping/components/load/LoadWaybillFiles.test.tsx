/**
 * File vận đơn trên chuyến (docs 09 §4.4, BR-28): gate theo mã quyền + trạng thái chuyến, và có mặt trên màn chuyến.
 */
import { screen, configure } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPPING_FILE_LABELS as L } from "@/constants/shipping-files";

import { LOAD_ID, apiLoad } from "../../__fixtures__/load";
import {
  SHIPPING_ACTORS as ACTORS,
  mockShippingApi,
  renderShippingScreen,
} from "../../__fixtures__/render";
import { LoadScreen } from "../LoadScreen";
import { LoadWaybillFiles } from "./LoadWaybillFiles";

import type { TestActor } from "../../__fixtures__/render";
import type { Load } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Màn có nhiều truy vấn nối tiếp (quyền → chuyến → file): chờ lâu hơn 1 s mặc định khi máy tải nặng
configure({ asyncUtilTimeout: 5000 });

afterEach(() => vi.restoreAllMocks());

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const FILE = {
  fileId: "11111111-1111-4111-8111-111111111111",
  loadId: LOAD_ID,
  fileName: "van-don-hang-NB.pdf",
  contentType: "application/pdf",
  sizeBytes: 48213,
  uploadedBy: "33333333-3333-4333-8333-333333333333",
  uploadedAt: "2026-11-17T13:24:10Z",
};
const input = () => document.querySelector<HTMLInputElement>("input[type='file']");

function renderCard(actor: TestActor, load: Pick<Load, "loadId" | "status">) {
  mockShippingApi(actor, { get: { [`${PATH}/waybill-files`]: () => [FILE] } });
  renderShippingScreen(<LoadWaybillFiles load={load} />);
}

describe("LoadWaybillFiles — gate quyền và trạng thái", () => {
  it.each(["PLANNED", "VEHICLE_BOOKED", "LOADING", "DISPATCHED"] as const)(
    "nhân viên kho (fulfillment-dispatch:UPDATE), chuyến %s: xem danh sách và có hộp tải lên",
    async (status) => {
      renderCard(ACTORS.warehouseStaff, { loadId: LOAD_ID, status });
      expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
      expect(input()).not.toBeNull();
    },
  );

  it("người chỉ có quyền đọc: xem và tải xuống được, không có hộp tải lên", async () => {
    renderCard(ACTORS.viewOnly, { loadId: LOAD_ID, status: "VEHICLE_BOOKED" });
    expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
    expect(input()).toBeNull();
    expect(screen.getByText(L.common.viewOnly)).toBeInTheDocument();
  });

  it("điều phối giao hàng (không có fulfillment-dispatch:UPDATE) không tải lên được dù có quyền kết quả giao", async () => {
    renderCard(ACTORS.orderCoordinator, { loadId: LOAD_ID, status: "VEHICLE_BOOKED" });
    expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
    expect(input()).toBeNull();
  });

  it("chuyến đã huỷ: không tải thêm (lý do tiếng Việt), file đã có vẫn xem được", async () => {
    renderCard(ACTORS.warehouseManager, { loadId: LOAD_ID, status: "CANCELLED" });
    expect(await screen.findByText("van-don-hang-NB.pdf")).toBeInTheDocument();
    expect(screen.getByText(L.waybill.cancelled)).toBeInTheDocument();
    expect(input()).toBeNull();
  });
});

describe("LoadScreen — thẻ File vận đơn", () => {
  it("màn chuyến có thẻ File vận đơn kèm file của chuyến đó", async () => {
    mockShippingApi(ACTORS.warehouseStaff, {
      get: {
        [PATH]: () => apiLoad({ status: "VEHICLE_BOOKED" }),
        [`${PATH}/waybill-files`]: () => [FILE],
      },
    });
    renderShippingScreen(<LoadScreen id={LOAD_ID} />);
    expect(
      await screen.findByRole("heading", { name: `${L.waybill.title} (1)` }),
    ).toBeInTheDocument();
    expect(screen.getByText("van-don-hang-NB.pdf")).toBeInTheDocument();
  });

  it("chuyến chưa có file: câu trạng thái rỗng", async () => {
    mockShippingApi(ACTORS.warehouseStaff, {
      get: { [PATH]: () => apiLoad({ status: "VEHICLE_BOOKED" }) },
    });
    renderShippingScreen(<LoadScreen id={LOAD_ID} />);
    expect(await screen.findByText(L.waybill.empty)).toBeInTheDocument();
  });
});
