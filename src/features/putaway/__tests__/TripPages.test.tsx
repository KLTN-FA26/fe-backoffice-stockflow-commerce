import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUTAWAY_TRIP_ERROR_MESSAGES, PUTAWAY_TRIP_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { MyTripPage, TripPage } from "../components/trip/TripPages";
import { trip, tripCarton } from "./trip-fixtures";

import type { TestRole } from "@/test/api-screen";
import type { PutawayTrip } from "../types";

const L = PUTAWAY_TRIP_LABELS;
const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const WAREHOUSES = page([{ id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }]);
const GOING = trip({
  status: "IN_PROGRESS",
  startLocationCode: "HCM-RCV01",
  startedAt: "2026-11-21T02:10:00Z",
  cartons: [
    tripCarton({ lpn: "LPN-1", assignedLocationCode: "BIN-1", stopSequence: 1, holding: true }),
    tripCarton({
      putawayTaskId: "t-2",
      lpn: "LPN-2",
      assignedLocationCode: "BIN-1",
      stopSequence: 1,
      holding: false,
    }),
  ],
  stops: [{ sequence: 1, locationCode: "BIN-1", lpns: ["LPN-1", "LPN-2"] }],
});

function setup(
  role: TestRole,
  current: PutawayTrip | null,
  post: Record<string, (p: unknown, b?: unknown) => unknown> = {},
) {
  const spies = mockApi(role, {
    get: {
      "/putaway-trips/current": () => current,
      "/putaway-trips/trip-1": () => current,
      "/warehouses": () => WAREHOUSES,
    },
    post,
  });
  return spies;
}

afterEach(() => vi.restoreAllMocks());

describe("MyTripPage (docs 05 §4.5)", () => {
  it("chưa có chuyến → thẻ mở chuyến, kho duy nhất chọn sẵn; Mở chuyến gửi warehouseId", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF", null, { "/putaway-trips": () => trip() });
    renderScreen(<MyTripPage />, "WAREHOUSE_STAFF");
    await user.click(await screen.findByRole("button", { name: L.start.submit }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[0]).toBe("/putaway-trips");
    expect(post.mock.calls[0]?.[1]).toEqual({ warehouseId: "wh-1" });
  });

  it("LOADING của mình: quét LPN + Enter → xếp lên xe; xe rỗng khoá Bắt đầu đi", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF", trip(), {
      "/putaway-trips/trip-1/cartons": () => trip({ cartons: [tripCarton()] }),
    });
    renderScreen(<MyTripPage />, "WAREHOUSE_STAFF");
    expect(await screen.findByRole("button", { name: L.load.depart })).toBeDisabled();
    expect(screen.getByText(L.load.emptyCart)).toBeInTheDocument();
    await user.type(screen.getByLabelText(L.load.field), "LPN-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).toEqual({ lpn: "LPN-1" });
  });

  it("thùng đang trên xe người khác → lỗi dưới ô quét (BR-15)", async () => {
    const user = userEvent.setup();
    setup("WAREHOUSE_STAFF", trip(), {
      "/putaway-trips/trip-1/cartons": () => {
        throw apiError(409, "PUTAWAY_TASK_ON_ANOTHER_TRIP");
      },
    });
    renderScreen(<MyTripPage />, "WAREHOUSE_STAFF");
    await user.type(await screen.findByLabelText(L.load.field), "LPN-9{Enter}");
    expect(
      await screen.findByText(PUTAWAY_TRIP_ERROR_MESSAGES.PUTAWAY_TASK_ON_ANOTHER_TRIP),
    ).toBeInTheDocument();
  });

  it("IN_PROGRESS: lộ trình + hết giữ chỗ; quét bin → Enter → LPN → gửi {locationCode, lpn}", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF", GOING, {
      "/putaway-trips/trip-1/placements": () => GOING,
    });
    renderScreen(<MyTripPage />, "WAREHOUSE_STAFF");
    expect(await screen.findByText(L.route.note)).toBeInTheDocument();
    expect(screen.getByText(L.cart.holdExpired)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.route.reassign("LPN-1") })).toBeInTheDocument();
    await user.type(screen.getByLabelText(L.place.bin), "BIN-1{Enter}");
    expect(screen.getByLabelText(L.place.lpn)).toHaveFocus();
    await user.type(screen.getByLabelText(L.place.lpn), "LPN-1{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).toEqual({ locationCode: "BIN-1", lpn: "LPN-1" });
  });

  it("đóng chuyến cần xác nhận (thùng còn trên xe trả về hàng chờ)", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF", GOING, {
      "/putaway-trips/trip-1/closure": () => ({ ...GOING, status: "CLOSED" }),
    });
    renderScreen(<MyTripPage />, "WAREHOUSE_STAFF");
    await user.click(await screen.findByRole("button", { name: L.close.action }));
    expect(screen.getByText(L.close.description(2))).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("vai trò không có quyền chuyến → báo không có quyền", async () => {
    setup("QC_STAFF", null);
    renderScreen(<MyTripPage />, "QC_STAFF");
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
  });
});

describe("TripPage — chuyến theo id", () => {
  it("quản lý kho xem chuyến người khác → chỉ có Đóng chuyến hộ", async () => {
    setup("WAREHOUSE_MANAGER", { ...GOING, operatorId: "someone" });
    renderScreen(<TripPage tripId="trip-1" />, "WAREHOUSE_MANAGER");
    expect(await screen.findByRole("button", { name: L.close.force })).toBeInTheDocument();
    expect(screen.queryByLabelText(L.place.bin)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: L.route.reassign("LPN-1") }),
    ).not.toBeInTheDocument();
  });

  it("nhân viên kho xem chuyến người khác → chỉ xem", async () => {
    setup("WAREHOUSE_STAFF", { ...GOING, operatorId: "someone" });
    renderScreen(<TripPage tripId="trip-1" />, "WAREHOUSE_STAFF");
    expect(await screen.findByText(L.notMine)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.close.force })).not.toBeInTheDocument();
  });

  it("chuyến đã đóng → không nút ghi nào, có đường về danh sách", async () => {
    setup(
      "WAREHOUSE_MANAGER",
      trip({ status: "CLOSED", cartons: [tripCarton({ status: "RETURNED" })] }),
    );
    renderScreen(<TripPage tripId="trip-1" />, "WAREHOUSE_MANAGER");
    expect(await screen.findByText(L.ended.CLOSED)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: new RegExp(L.close.force) }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.ended.backToList })).toBeInTheDocument();
  });
});
