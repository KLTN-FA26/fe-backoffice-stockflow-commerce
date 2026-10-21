import { describe, expect, it } from "vitest";

import { LOAD_STATUSES, SHIPMENT_PERMISSIONS } from "@/constants";
import { LOAD_TRANSITIONS, SHIPMENT_TRANSITIONS } from "@/lib/domain/lifecycle";

import {
  allowedLoadActions,
  hasLoadAction,
  isFullyLoaded,
  isLoadOpen,
  loadNoActionReason,
} from "./lifecycle";
import { allowedOutcomes, canAssignCarrier, noOutcomeReason } from "./shipment-lifecycle";

import type { LoadGateState, ShippingActor } from "./lifecycle";

const ALL_PERMS = Object.values(SHIPMENT_PERMISSIONS);
const actor = (roles: string[], permissions: readonly string[] = ALL_PERMS): ShippingActor => ({
  roles,
  can: (code) => permissions.includes(code),
});
const STAFF = actor(["WAREHOUSE_STAFF"]);
const MANAGER = actor(["WAREHOUSE_MANAGER"]);
const COORDINATOR = actor(["ORDER_COORDINATOR"]);
const ADMIN = actor(["SYSTEM_ADMIN"]);

const gate = (patch: Partial<LoadGateState> = {}): LoadGateState => ({
  status: "LOADING",
  mode: "PARCEL",
  shipmentCount: 2,
  expectedPackageCount: 3,
  loadedPackageCount: 3,
  ...patch,
});
const codes = (g: LoadGateState, a: ShippingActor) =>
  allowedLoadActions(g, a).map(({ action }) => action.code);

describe("LOAD_TRANSITIONS (BE LoadStatus)", () => {
  it("phủ đủ trạng thái; chuyến gửi kiện LOADING → DISPATCHED; huỷ ở mọi trạng thái còn mở", () => {
    expect(Object.keys(LOAD_TRANSITIONS).sort()).toEqual([...LOAD_STATUSES].sort());
    expect(LOAD_TRANSITIONS.LOADING).toEqual(["DISPATCHED", "CANCELLED"]);
    expect(LOAD_TRANSITIONS.PLANNED).toContain("CANCELLED");
    expect(LOAD_TRANSITIONS.VEHICLE_BOOKED).toContain("CANCELLED");
  });

  it("DISPATCHED và CANCELLED là trạng thái cuối", () => {
    expect(LOAD_TRANSITIONS.DISPATCHED).toEqual([]);
    expect(LOAD_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("allowedLoadActions — quyền + vai trò + trạng thái (BE gate kép)", () => {
  it("nhân viên kho đang xếp đủ kiện: thêm / bỏ lô, quét, gỡ, bàn giao; không huỷ chuyến", () => {
    expect(codes(gate(), STAFF)).toEqual([
      "addShipment",
      "removeShipment",
      "scan",
      "unscan",
      "handover",
    ]);
  });

  it("quản lý kho thêm được huỷ chuyến; SYSTEM_ADMIN qua mọi cổng vai trò", () => {
    expect(codes(gate(), MANAGER)).toContain("cancel");
    expect(codes(gate(), ADMIN)).toContain("cancel");
    expect(codes(gate(), ADMIN)).toContain("handover");
  });

  it("điều phối đơn hàng có UPDATE nhưng không lên xe, không bàn giao, không huỷ chuyến", () => {
    expect(codes(gate(), COORDINATOR)).toEqual([]);
  });

  it("thiếu UPDATE (chỉ xem) → không thao tác nào", () => {
    const viewOnly = actor(
      ["WAREHOUSE_STAFF"],
      [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read],
    );
    expect(codes(gate(), viewOnly)).toEqual([]);
  });

  it("bàn giao khoá có lý do khi chưa có lô, hoặc còn kiện chưa quét", () => {
    const empty = hasLoadAction(
      allowedLoadActions(
        gate({ shipmentCount: 0, expectedPackageCount: 0, loadedPackageCount: 0 }),
        STAFF,
      ),
      "handover",
    );
    expect(empty?.disabledReason).toMatch(/chưa có lô/);
    const partial = hasLoadAction(
      allowedLoadActions(gate({ loadedPackageCount: 1 }), STAFF),
      "handover",
    );
    expect(partial?.disabledReason).toMatch(/chưa quét/);
    expect(isFullyLoaded(gate({ loadedPackageCount: 1 }))).toBe(false);
    expect(
      hasLoadAction(allowedLoadActions(gate(), STAFF), "handover")?.disabledReason,
    ).toBeUndefined();
  });

  it("đã bàn giao / đã huỷ → không còn thao tác; chuyến nguyên xe không xử lý ở đây (trừ huỷ)", () => {
    expect(codes(gate({ status: "DISPATCHED" }), MANAGER)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED" }), MANAGER)).toEqual([]);
    expect(codes(gate({ mode: "FULL_TRUCKLOAD" }), STAFF)).toEqual([]);
    expect(codes(gate({ mode: "FULL_TRUCKLOAD" }), MANAGER)).toEqual(["cancel"]);
  });

  it("trạng thái lạ (BE thêm sau) → không mở thao tác nào", () => {
    expect(codes(gate({ status: "UNKNOWN" }), ADMIN)).toEqual([]);
    expect(isLoadOpen("UNKNOWN")).toBe(false);
  });

  it("thêm / bỏ lô cũng khi chuyến còn ở trạng thái mở khác LOADING (FTL sau này), quét chỉ khi LOADING", () => {
    expect(codes(gate({ status: "VEHICLE_BOOKED" }), STAFF)).toEqual([
      "addShipment",
      "removeShipment",
    ]);
  });
});

describe("loadNoActionReason", () => {
  it("nói đúng vì sao không có ô quét / nút", () => {
    expect(loadNoActionReason(gate({ status: "DISPATCHED" }), STAFF)).toMatch(/Đã bàn giao/);
    expect(loadNoActionReason(gate({ status: "CANCELLED" }), STAFF)).toMatch(/huỷ/);
    expect(loadNoActionReason(gate({ mode: "FULL_TRUCKLOAD" }), STAFF)).toMatch(/nguyên xe/);
    expect(loadNoActionReason(gate(), COORDINATOR)).toMatch(/nhân viên kho/);
    expect(loadNoActionReason(gate(), actor(["SALES_STAFF"], [SHIPMENT_PERMISSIONS.read]))).toMatch(
      /chỉ có quyền xem/,
    );
  });
});

describe("SHIPMENT_TRANSITIONS + allowedOutcomes (docs 09 §5, BR-02)", () => {
  it("HANDED_OVER → giao / thất bại; thất bại → giao lại / hoàn; còn lại là cuối", () => {
    expect(SHIPMENT_TRANSITIONS.HANDED_OVER).toEqual(["DELIVERED", "DELIVERY_FAILED"]);
    expect(SHIPMENT_TRANSITIONS.DELIVERY_FAILED).toEqual(["DELIVERED", "RETURNED"]);
    for (const terminal of ["DELIVERED", "RETURNED", "CANCELLED"] as const) {
      expect(SHIPMENT_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("điều phối đơn ghi đã giao / thất bại / hoàn; quản lý kho chỉ hoàn hàng; nhân viên kho không ghi gì", () => {
    expect(allowedOutcomes({ status: "HANDED_OVER" }, COORDINATOR)).toEqual([
      "DELIVERED",
      "DELIVERY_FAILED",
    ]);
    expect(allowedOutcomes({ status: "DELIVERY_FAILED" }, COORDINATOR)).toEqual([
      "DELIVERED",
      "RETURNED",
    ]);
    expect(allowedOutcomes({ status: "DELIVERY_FAILED" }, MANAGER)).toEqual(["RETURNED"]);
    expect(allowedOutcomes({ status: "HANDED_OVER" }, MANAGER)).toEqual([]);
    expect(allowedOutcomes({ status: "HANDED_OVER" }, STAFF)).toEqual([]);
    expect(allowedOutcomes({ status: "HANDED_OVER" }, ADMIN)).toEqual([
      "DELIVERED",
      "DELIVERY_FAILED",
    ]);
  });

  it("lô chưa bàn giao / đã kết thúc / thiếu quyền → không có kết quả nào, kèm lý do", () => {
    expect(allowedOutcomes({ status: "READY_TO_DISPATCH" }, COORDINATOR)).toEqual([]);
    expect(allowedOutcomes({ status: "DELIVERED" }, COORDINATOR)).toEqual([]);
    expect(allowedOutcomes({ status: "UNKNOWN" }, ADMIN)).toEqual([]);
    expect(
      allowedOutcomes(
        { status: "HANDED_OVER" },
        actor(["ORDER_COORDINATOR"], [SHIPMENT_PERMISSIONS.read]),
      ),
    ).toEqual([]);
    expect(noOutcomeReason({ status: "READY_TO_DISPATCH" }, COORDINATOR)).toMatch(/chưa bàn giao/);
    expect(noOutcomeReason({ status: "DELIVERED" }, COORDINATOR)).toMatch(/cuối/);
    expect(noOutcomeReason({ status: "HANDED_OVER" }, STAFF)).toMatch(/Điều phối/);
  });
});

describe("canAssignCarrier", () => {
  it("nhân viên / quản lý kho chọn hãng cho lô chờ xuất chưa lên chuyến; điều phối đơn không", () => {
    const free = { status: "READY_TO_DISPATCH", loadId: undefined } as const;
    expect(canAssignCarrier(free, STAFF)).toBe(true);
    expect(canAssignCarrier(free, MANAGER)).toBe(true);
    expect(canAssignCarrier(free, COORDINATOR)).toBe(false);
    expect(canAssignCarrier({ ...free, loadId: "L1" }, STAFF)).toBe(false);
    expect(canAssignCarrier({ status: "HANDED_OVER", loadId: undefined }, STAFF)).toBe(false);
  });
});
