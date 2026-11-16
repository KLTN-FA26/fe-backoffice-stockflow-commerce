import { describe, expect, it } from "vitest";

import {
  CARRIER_CONNECTION_TYPE,
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS as CONTROLLED,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS as DISPATCH,
  FULFILLMENT_WAYBILL_CORRECTION_PERMISSIONS as CORRECTION,
  LOAD_STATUSES,
  SHIPMENT_PERMISSIONS,
} from "@/constants";
import { LOAD_TRANSITIONS, SHIPMENT_TRANSITIONS } from "@/lib/domain/lifecycle";

import { allowedLoadActions, hasLoadAction, isFullyLoaded, loadNoActionReason } from "./lifecycle";
import { allowedOutcomes, noOutcomeReason } from "./shipment-lifecycle";

import type { LoadGateState, ShippingActor } from "./lifecycle";

/** Bộ quyền theo seed BE — tên chỉ để đọc test, FE không đọc tên vai trò. */
const READ = [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read];
const STAFF_PERMS = [...READ, DISPATCH.update];
const MANAGER_PERMS = [
  ...STAFF_PERMS,
  ...Object.values(FULFILLMENT_CARRIER_PERMISSIONS),
  CONTROLLED.update,
  CORRECTION.update,
  OUTCOME.update,
];
const COORDINATOR_PERMS = [...READ, ...Object.values(OUTCOME)];
const actor = (permissions: readonly string[]): ShippingActor => ({
  can: (code) => permissions.includes(code),
});
const STAFF = actor(STAFF_PERMS);
const MANAGER = actor(MANAGER_PERMS);
const COORDINATOR = actor(COORDINATOR_PERMS);
const VIEW_ONLY = actor(READ);
const ADMIN = actor([...MANAGER_PERMS, ...COORDINATOR_PERMS]);

const pending = { packageId: "p-1", labelCode: "PKG-1", reasonCode: "XE_HONG" as const };

const gate = (patch: Partial<LoadGateState> = {}): LoadGateState => ({
  status: "LOADING",
  shipmentCount: 2,
  expectedPackageCount: 3,
  loadedPackageCount: 3,
  carrierId: "car-ghn",
  carrierConnectionType: CARRIER_CONNECTION_TYPE.MANUAL,
  ...patch,
});
const codes = (g: LoadGateState, a: ShippingActor) =>
  allowedLoadActions(g, a).map(({ action }) => action.code);

describe("LOAD_TRANSITIONS (BE LoadStatus)", () => {
  it("phủ đủ trạng thái; LOADING → DISPATCHED / CANCELLED; huỷ ở mọi trạng thái còn mở", () => {
    expect(Object.keys(LOAD_TRANSITIONS).sort()).toEqual([...LOAD_STATUSES].sort());
    expect(LOAD_TRANSITIONS.LOADING).toEqual(["DISPATCHED", "CANCELLED"]);
    expect(LOAD_TRANSITIONS.PLANNED).toEqual(["VEHICLE_BOOKED", "CANCELLED"]);
    expect(LOAD_TRANSITIONS.VEHICLE_BOOKED).toEqual(["PLANNED", "LOADING", "CANCELLED"]);
  });

  it("DISPATCHED và CANCELLED là trạng thái cuối", () => {
    expect(LOAD_TRANSITIONS.DISPATCHED).toEqual([]);
    expect(LOAD_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("allowedLoadActions — theo trạng thái, nhân viên kho (fulfillment-dispatch:UPDATE)", () => {
  it("PLANNED: chỉ đặt xe", () => {
    expect(codes(gate({ status: "PLANNED", carrierId: undefined }), STAFF)).toEqual(["book"]);
  });

  it("VEHICLE_BOOKED: đặt lại, huỷ đặt xe, bắt đầu xếp, nhập mã vận đơn", () => {
    expect(codes(gate({ status: "VEHICLE_BOOKED" }), STAFF)).toEqual([
      "book",
      "cancelBooking",
      "startLoading",
      "recordWaybill",
    ]);
  });

  it("LOADING: quét, gỡ, bàn giao, nhập mã vận đơn, dỡ kiện; không huỷ có kiểm soát", () => {
    expect(codes(gate(), STAFF)).toEqual(["scan", "unscan", "handover", "recordWaybill", "unload"]);
  });

  it("DISPATCHED / CANCELLED: không còn thao tác nào (nhân viên kho không sửa mã vận đơn)", () => {
    expect(codes(gate({ status: "DISPATCHED" }), STAFF)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED" }), STAFF)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED", pendingUnloads: [pending] }), STAFF)).toEqual([
      "unload",
    ]);
  });

  it("trạng thái lạ (BE thêm sau) → không mở thao tác nào, kể cả quản lý", () => {
    expect(codes(gate({ status: "UNKNOWN" }), MANAGER)).toEqual([]);
  });

  it("huỷ đặt xe đưa VEHICLE_BOOKED về PLANNED; bắt đầu xếp sang LOADING", () => {
    const booked = allowedLoadActions(gate({ status: "VEHICLE_BOOKED" }), STAFF);
    expect(hasLoadAction(booked, "cancelBooking")?.action.targetStatus).toBe("PLANNED");
    expect(hasLoadAction(booked, "startLoading")?.action.targetStatus).toBe("LOADING");
  });
});

describe("allowedLoadActions — quản lý kho (huỷ có kiểm soát + sửa mã vận đơn)", () => {
  it("LOADING: thêm huỷ có kiểm soát và xác nhận dỡ không quét", () => {
    expect(codes(gate(), MANAGER)).toEqual([
      "scan",
      "unscan",
      "handover",
      "recordWaybill",
      "unload",
      "controlledCancel",
      "overrideUnload",
    ]);
    expect(
      hasLoadAction(allowedLoadActions(gate(), MANAGER), "controlledCancel")?.action.targetStatus,
    ).toBe("CANCELLED");
  });

  it("DISPATCHED: chỉ còn sửa mã vận đơn (cần cả hai mã quyền)", () => {
    expect(codes(gate({ status: "DISPATCHED" }), MANAGER)).toEqual(["correctWaybill"]);
  });

  it("CANCELLED còn kiện bị khoá: dỡ + xác nhận dỡ; hết kiện thì không còn gì", () => {
    expect(codes(gate({ status: "CANCELLED", pendingUnloads: [pending] }), MANAGER)).toEqual([
      "unload",
      "overrideUnload",
    ]);
    expect(codes(gate({ status: "CANCELLED", pendingUnloads: [] }), MANAGER)).toEqual([]);
    expect(codes(gate({ status: "CANCELLED" }), MANAGER)).toEqual([]);
  });

  it("huỷ có kiểm soát chỉ khi đang xếp hàng", () => {
    for (const status of ["PLANNED", "VEHICLE_BOOKED", "DISPATCHED", "CANCELLED"] as const) {
      expect(codes(gate({ status, pendingUnloads: [pending] }), MANAGER)).not.toContain(
        "controlledCancel",
      );
    }
  });

  it("chỉ có mã controlled-cancellations (vai trò tạo lúc chạy): huỷ + xác nhận dỡ, không quét", () => {
    expect(codes(gate(), actor([CONTROLLED.update]))).toEqual([
      "controlledCancel",
      "overrideUnload",
    ]);
  });

  it("nhân viên kho / điều phối / chỉ xem không có huỷ có kiểm soát hay xác nhận dỡ", () => {
    for (const other of [STAFF, COORDINATOR, VIEW_ONLY]) {
      expect(codes(gate(), other)).not.toContain("controlledCancel");
      expect(codes(gate(), other)).not.toContain("overrideUnload");
    }
  });
});

describe("allowedLoadActions — nhập / sửa mã vận đơn (docs 09 §4.4, BR-24)", () => {
  it("nhập mã vận đơn: VEHICLE_BOOKED và LOADING, cần fulfillment-dispatch:UPDATE", () => {
    for (const status of ["VEHICLE_BOOKED", "LOADING"] as const) {
      expect(codes(gate({ status }), STAFF)).toContain("recordWaybill");
      expect(codes(gate({ status }), VIEW_ONLY)).not.toContain("recordWaybill");
    }
    for (const status of ["PLANNED", "DISPATCHED", "CANCELLED"] as const) {
      expect(codes(gate({ status }), STAFF)).not.toContain("recordWaybill");
    }
  });

  it("sửa mã vận đơn sau khi rời kho cần CẢ dispatch:UPDATE lẫn waybill-corrections:UPDATE", () => {
    const dispatched = gate({ status: "DISPATCHED" });
    expect(codes(dispatched, actor([...STAFF_PERMS, CORRECTION.update]))).toEqual([
      "correctWaybill",
    ]);
    expect(codes(dispatched, actor([...READ, CORRECTION.update]))).toEqual([]);
    expect(codes(dispatched, STAFF)).toEqual([]);
    expect(codes(dispatched, COORDINATOR)).toEqual([]);
  });

  it("chuyến chưa có hãng: không nhập / sửa mã vận đơn", () => {
    expect(codes(gate({ status: "LOADING", carrierId: undefined }), MANAGER)).not.toContain(
      "recordWaybill",
    );
    expect(codes(gate({ status: "DISPATCHED", carrierId: undefined }), MANAGER)).toEqual([]);
  });
});

describe("allowedLoadActions — hãng đặt xe qua API (BR-29)", () => {
  const api = { carrierConnectionType: CARRIER_CONNECTION_TYPE.API_BOOKING };

  it("VEHICLE_BOOKED: không đặt lại tay, không nhập mã vận đơn; vẫn huỷ đặt xe / bắt đầu xếp", () => {
    expect(codes(gate({ status: "VEHICLE_BOOKED", ...api }), MANAGER)).toEqual([
      "cancelBooking",
      "startLoading",
    ]);
  });

  it("PLANNED vẫn đặt xe được (chưa có đơn ở hãng)", () => {
    expect(codes(gate({ status: "PLANNED", carrierId: undefined, ...api }), STAFF)).toEqual([
      "book",
    ]);
  });

  it("LOADING: không nhập mã vận đơn tay; DISPATCHED: manager không sửa mã vận đơn", () => {
    expect(codes(gate(api), STAFF)).toEqual(["scan", "unscan", "handover", "unload"]);
    expect(codes(gate({ status: "DISPATCHED", ...api }), MANAGER)).toEqual([]);
  });

  it("hãng webhook theo chuyến vẫn nhập mã vận đơn tay", () => {
    const webhook = { carrierConnectionType: CARRIER_CONNECTION_TYPE.WEBHOOK_LOAD };
    expect(codes(gate({ status: "VEHICLE_BOOKED", ...webhook }), STAFF)).toContain("recordWaybill");
  });
});

describe("allowedLoadActions — gate theo mã quyền, không theo vai trò", () => {
  it("điều phối đơn hàng (chỉ quyền kết quả giao) và chỉ-xem: không thao tác nào ở mọi trạng thái", () => {
    for (const status of LOAD_STATUSES) {
      expect(codes(gate({ status, pendingUnloads: [pending] }), COORDINATOR)).toEqual([]);
      expect(codes(gate({ status, pendingUnloads: [pending] }), VIEW_ONLY)).toEqual([]);
    }
  });

  it("quyền fulfillment-shipments:UPDATE cũ không còn tác dụng", () => {
    expect(codes(gate(), actor([...READ, "fulfillment-shipments:UPDATE"]))).toEqual([]);
  });
});

describe("allowedLoadActions — bàn giao (BR-18)", () => {
  it("khoá có lý do khi chưa có lô, hoặc còn kiện chưa quét", () => {
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
    expect(isFullyLoaded(gate())).toBe(true);
    expect(
      hasLoadAction(allowedLoadActions(gate(), STAFF), "handover")?.disabledReason,
    ).toBeUndefined();
  });

  it("còn kiện của đơn đã huỷ trên xe: khoá và nói lý do (BE 409 LOAD_UNLOAD_PENDING)", () => {
    const blocked = hasLoadAction(
      allowedLoadActions(gate({ pendingUnloads: [pending] }), STAFF),
      "handover",
    );
    expect(blocked?.disabledReason).toMatch(/dỡ xuống/);
  });
});

describe("loadNoActionReason", () => {
  it("nói đúng vì sao không có ô quét / nút", () => {
    expect(loadNoActionReason({ status: "DISPATCHED" })).toMatch(/Đã bàn giao/);
    expect(loadNoActionReason({ status: "CANCELLED" })).toMatch(/huỷ/);
    expect(loadNoActionReason({ status: "PLANNED" })).toMatch(/Chưa đặt xe/);
    expect(loadNoActionReason({ status: "VEHICLE_BOOKED" })).toMatch(/Bắt đầu xếp hàng/);
    expect(loadNoActionReason({ status: "LOADING" })).toMatch(/chỉ có quyền xem/);
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
