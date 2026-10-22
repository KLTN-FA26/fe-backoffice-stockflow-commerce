import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS as DISPATCH,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
  LOAD_STATUSES,
  SHIPMENT_PERMISSIONS,
} from "@/constants";
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

/** Bộ quyền theo seed BE PR #148 — tên chỉ để đọc test, FE không đọc tên vai trò. */
const READ = [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read];
const STAFF_PERMS = [...READ, ...Object.values(DISPATCH)];
const MANAGER_PERMS = [
  ...STAFF_PERMS,
  ...Object.values(FULFILLMENT_CARRIER_PERMISSIONS),
  ...Object.values(FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS),
  OUTCOME.update,
];
const COORDINATOR_PERMS = [...READ, ...Object.values(OUTCOME)];
const actor = (permissions: readonly string[]): ShippingActor => ({
  can: (code) => permissions.includes(code),
});
const STAFF = actor(STAFF_PERMS);
const MANAGER = actor(MANAGER_PERMS);
const COORDINATOR = actor(COORDINATOR_PERMS);
const ADMIN = actor([...MANAGER_PERMS, ...COORDINATOR_PERMS]);

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

describe("allowedLoadActions — mã quyền + trạng thái (BE PR #148)", () => {
  it("nhân viên kho đang xếp đủ kiện: thêm / bỏ lô, quét, gỡ, bàn giao; không huỷ chuyến", () => {
    expect(codes(gate(), STAFF)).toEqual([
      "addShipment",
      "removeShipment",
      "scan",
      "unscan",
      "handover",
    ]);
  });

  it("huỷ chuyến cần fulfillment-load-cancellations:UPDATE (quản lý kho), không phải quyền xếp xe", () => {
    expect(codes(gate(), MANAGER)).toContain("cancel");
    expect(codes(gate(), ADMIN)).toContain("cancel");
    expect(codes(gate(), ADMIN)).toContain("handover");
    expect(codes(gate(), STAFF)).not.toContain("cancel");
    // chỉ có quyền huỷ chuyến (vai trò tạo lúc chạy) → huỷ được, không quét / bàn giao
    expect(codes(gate(), actor([FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS.update]))).toEqual([
      "cancel",
    ]);
  });

  it("điều phối đơn hàng (chỉ quyền kết quả giao) không lên xe, không bàn giao, không huỷ chuyến", () => {
    expect(codes(gate(), COORDINATOR)).toEqual([]);
  });

  it("thiếu fulfillment-dispatch:UPDATE (chỉ xem; fulfillment-shipments:UPDATE cũ không còn tác dụng) → không thao tác nào", () => {
    expect(codes(gate(), actor(READ))).toEqual([]);
    expect(codes(gate(), actor([...READ, "fulfillment-shipments:UPDATE"]))).toEqual([]);
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

  it("đã bàn giao / đã huỷ → không còn thao tác (cả chuyến nguyên xe)", () => {
    expect(codes(gate({ status: "DISPATCHED" }), MANAGER)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED" }), MANAGER)).toEqual([]);
    expect(codes(gate({ status: "DISPATCHED", mode: "FULL_TRUCKLOAD" }), ADMIN)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED", mode: "FULL_TRUCKLOAD" }), ADMIN)).toEqual([]);
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

describe("allowedLoadActions — chuyến nguyên xe (FTL, BE PR #162)", () => {
  const ftl = (patch: Partial<LoadGateState> = {}) => gate({ mode: "FULL_TRUCKLOAD", ...patch });

  it("PLANNED: chỉ đặt xe; VEHICLE_BOOKED: đặt lại / huỷ đặt xe / bắt đầu xếp; LOADING: quét, gỡ, dỡ, bàn giao", () => {
    expect(codes(ftl({ status: "PLANNED" }), STAFF)).toEqual(["book"]);
    expect(codes(ftl({ status: "VEHICLE_BOOKED" }), STAFF)).toEqual([
      "book",
      "cancelBooking",
      "startLoading",
    ]);
    expect(codes(ftl({ status: "LOADING" }), STAFF)).toEqual([
      "scan",
      "unscan",
      "handover",
      "unload",
    ]);
  });

  it("gate theo mã quyền fulfillment-dispatch:UPDATE, không theo vai trò: chỉ xem / điều phối không có thao tác", () => {
    for (const status of ["PLANNED", "VEHICLE_BOOKED", "LOADING"] as const) {
      expect(codes(ftl({ status }), COORDINATOR)).toEqual([]);
      expect(codes(ftl({ status }), actor(READ))).toEqual([]);
    }
    // Mọi thao tác FTL cần đúng mã UPDATE: tập quyền chỉ có CREATE (mở chuyến) vẫn không đặt xe được
    expect(codes(ftl({ status: "PLANNED" }), actor([...READ, DISPATCH.create]))).toEqual([]);
    expect(codes(ftl({ status: "PLANNED" }), actor([...READ, DISPATCH.update]))).toEqual(["book"]);
  });

  it("lô của chuyến do kế hoạch quản lý: không thêm / bỏ lô, không huỷ chuyến — kể cả quản lý kho", () => {
    for (const status of ["PLANNED", "VEHICLE_BOOKED", "LOADING"] as const) {
      const list = codes(ftl({ status }), ADMIN);
      for (const blocked of ["addShipment", "removeShipment", "cancel"] as const) {
        expect(list).not.toContain(blocked);
      }
    }
  });

  it("chuyến gửi kiện không có thao tác đặt xe / dỡ kiện", () => {
    const parcel = codes(gate({ status: "LOADING" }), ADMIN);
    for (const only of ["book", "cancelBooking", "startLoading", "unload"] as const) {
      expect(parcel).not.toContain(only);
    }
    expect(codes(gate({ status: "VEHICLE_BOOKED" }), ADMIN)).not.toContain("book");
  });

  it("còn kiện của đơn đã huỷ trên xe: bàn giao bị khoá và nói lý do (BE 409 LOAD_UNLOAD_PENDING)", () => {
    const pending = [
      {
        packageId: "p1",
        labelCode: "PKG-1",
        shipmentId: "s1",
        shipmentCode: "S1",
      },
    ];
    const blocked = hasLoadAction(
      allowedLoadActions(ftl({ status: "LOADING", pendingUnloads: pending }), STAFF),
      "handover",
    );
    expect(blocked?.disabledReason).toMatch(/dỡ xuống/);
    const free = hasLoadAction(allowedLoadActions(ftl({ status: "LOADING" }), STAFF), "handover");
    expect(free?.disabledReason).toBeUndefined();
  });

  it("bảng chuyển trạng thái: huỷ đặt xe đưa VEHICLE_BOOKED về PLANNED", () => {
    expect(LOAD_TRANSITIONS.VEHICLE_BOOKED).toEqual(["PLANNED", "LOADING", "CANCELLED"]);
    expect(LOAD_TRANSITIONS.PLANNED).toEqual(["VEHICLE_BOOKED", "CANCELLED"]);
  });
});

describe("loadNoActionReason", () => {
  it("nói đúng vì sao không có ô quét / nút", () => {
    expect(loadNoActionReason(gate({ status: "DISPATCHED" }))).toMatch(/Đã bàn giao/);
    expect(loadNoActionReason(gate({ status: "CANCELLED" }))).toMatch(/huỷ/);
    expect(loadNoActionReason(gate({ mode: "FULL_TRUCKLOAD", status: "PLANNED" }))).toMatch(
      /Chưa đặt xe/,
    );
    expect(loadNoActionReason(gate({ mode: "FULL_TRUCKLOAD", status: "VEHICLE_BOOKED" }))).toMatch(
      /Bắt đầu xếp hàng/,
    );
    expect(loadNoActionReason(gate())).toMatch(/chỉ có quyền xem/);
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

  it("delivery-outcomes:APPROVE ghi đã giao / thất bại / hoàn; chỉ :UPDATE (quản lý kho) chỉ ghi hoàn hàng; không có quyền nào thì không ghi gì", () => {
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
    expect(allowedOutcomes({ status: "HANDED_OVER" }, actor(READ))).toEqual([]);
    // APPROVE mà thiếu UPDATE → endpoint từ chối (BE @RequiresPermission UPDATE)
    expect(allowedOutcomes({ status: "HANDED_OVER" }, actor([...READ, OUTCOME.approve]))).toEqual(
      [],
    );
    expect(noOutcomeReason({ status: "READY_TO_DISPATCH" }, COORDINATOR)).toMatch(/chưa bàn giao/);
    expect(noOutcomeReason({ status: "DELIVERED" }, COORDINATOR)).toMatch(/cuối/);
    expect(noOutcomeReason({ status: "HANDED_OVER" }, STAFF)).toMatch(/chỉ có quyền xem/);
    expect(noOutcomeReason({ status: "HANDED_OVER" }, MANAGER)).toMatch(/phê duyệt/);
  });
});

describe("canAssignCarrier", () => {
  it("fulfillment-dispatch:UPDATE (nhân viên / quản lý kho) chọn hãng cho lô chờ xuất chưa lên chuyến; điều phối đơn không", () => {
    const free = { status: "READY_TO_DISPATCH", loadId: undefined } as const;
    expect(canAssignCarrier(free, STAFF)).toBe(true);
    expect(canAssignCarrier(free, MANAGER)).toBe(true);
    expect(canAssignCarrier(free, COORDINATOR)).toBe(false);
    expect(canAssignCarrier({ ...free, loadId: "L1" }, STAFF)).toBe(false);
    expect(canAssignCarrier({ status: "HANDED_OVER", loadId: undefined }, STAFF)).toBe(false);
  });
});
