import { describe, expect, it } from "vitest";

import { LOAD_STATUSES, SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { LOAD_TRANSITIONS } from "@/lib/domain/lifecycle";

import { SHIPPING_ROLE_PERMISSIONS as ROLES } from "./__fixtures__/render";
import { isScanQueueFatal, isStaleLoadError, shippingErrorMessage } from "./errors";
import {
  LOAD_NO_ACTION_REASON,
  allowedLoadActions,
  hasManifestView,
  isFullyLoaded,
  isLoadAwaitingStart,
  loadGateState,
} from "./lifecycle";

import type { LoadStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";

const canAs = (role: keyof typeof ROLES) => (code: PermissionCode) =>
  (ROLES[role] as readonly PermissionCode[]).includes(code);

const gate = (status: LoadStatus, loaded = 0, planned = 2) => ({
  status,
  loadedPackages: loaded,
  plannedPackages: planned,
});

describe("LOAD_TRANSITIONS (BE business-design 03 §11)", () => {
  it("đủ 5 trạng thái chuyến", () => {
    expect(Object.keys(LOAD_TRANSITIONS).sort()).toEqual([...LOAD_STATUSES].sort());
  });

  it("PLANNED → VEHICLE_BOOKED → LOADING → DISPATCHED; huỷ chỉ khi PLANNED", () => {
    expect(LOAD_TRANSITIONS.PLANNED).toEqual(["VEHICLE_BOOKED", "CANCELLED"]);
    expect(LOAD_TRANSITIONS.VEHICLE_BOOKED).toEqual(["LOADING"]);
    expect(LOAD_TRANSITIONS.LOADING).toEqual(["DISPATCHED"]);
  });

  it("DISPATCHED / CANCELLED là terminal", () => {
    expect(LOAD_TRANSITIONS.DISPATCHED).toEqual([]);
    expect(LOAD_TRANSITIONS.CANCELLED).toEqual([]);
  });
});

describe("allowedLoadActions — gating", () => {
  const codes = (status: LoadStatus, role: keyof typeof ROLES, loaded = 0) =>
    allowedLoadActions(gate(status, loaded), canAs(role)).map((a) => a.action.code);

  it("VEHICLE_BOOKED + NV kho → bắt đầu xếp hàng", () => {
    expect(codes("VEHICLE_BOOKED", "warehouseStaff")).toEqual(["startLoading"]);
  });

  it("LOADING + NV kho → quét kiện + bàn giao", () => {
    expect(codes("LOADING", "warehouseStaff")).toEqual(["scan", "handover"]);
  });

  it("03 §11: còn kiện chưa quét → bàn giao bị khoá kèm lý do", () => {
    const handover = allowedLoadActions(gate("LOADING", 1, 2), canAs("warehouseStaff")).find(
      (a) => a.action.code === "handover",
    );
    expect(handover?.disabledReason).toBe(UI_LABELS.shipping.disabledReason.notFullyLoaded);
    const ready = allowedLoadActions(gate("LOADING", 2, 2), canAs("warehouseStaff")).find(
      (a) => a.action.code === "handover",
    );
    expect(ready?.disabledReason).toBeUndefined();
  });

  it("chỉ quyền xem hoặc không được cấp → không có nút nào ở mọi trạng thái", () => {
    for (const status of LOAD_STATUSES) {
      expect(codes(status, "viewOnly")).toEqual([]);
      expect(codes(status, "noAccess")).toEqual([]);
    }
  });

  it("PLANNED / DISPATCHED / CANCELLED → không có thao tác ở màn này", () => {
    for (const status of ["PLANNED", "DISPATCHED", "CANCELLED"] as const) {
      expect(codes(status, "warehouseStaff", 2)).toEqual([]);
    }
  });

  it("chuyến rỗng không tính là đủ kiện", () => {
    expect(isFullyLoaded({ loadedPackages: 0, plannedPackages: 0 })).toBe(false);
  });
});

describe("helper trạng thái chuyến", () => {
  it("terminal: DISPATCHED / CANCELLED; còn lại không", () => {
    expect(LOAD_STATUSES.filter((status) => LOAD_TRANSITIONS[status].length === 0)).toEqual([
      "DISPATCHED",
      "CANCELLED",
    ]);
  });

  it("chờ bắt đầu xếp = VEHICLE_BOOKED; có biên bản = LOADING / DISPATCHED", () => {
    expect(LOAD_STATUSES.filter(isLoadAwaitingStart)).toEqual(["VEHICLE_BOOKED"]);
    expect(LOAD_STATUSES.filter(hasManifestView)).toEqual(["LOADING", "DISPATCHED"]);
  });

  it("mọi trạng thái có câu thay cho nút", () => {
    for (const status of LOAD_STATUSES) expect(LOAD_NO_ACTION_REASON[status]).toBeTruthy();
  });

  it("đếm kiện từ dòng (không tin số tổng của header)", () => {
    // Header nói 9/9 nhưng dòng thực tế 1/2 → gate theo dòng
    const header = { status: "LOADING" as const, plannedPackages: 9, loadedPackages: 9 };
    const lines = [{ loadedAt: "2026-10-12T01:00:00Z" }, { loadedAt: null }];
    const state = loadGateState({ ...header, lines });
    expect(state).toMatchObject({ plannedPackages: 2, loadedPackages: 1 });
  });
});

describe("errors — phân loại lỗi quét / chuyến", () => {
  it("lỗi dữ liệu cũ → tải lại", () => {
    for (const code of ["INVALID_LOAD_TRANSITION", "OPTIMISTIC_LOCK", "LOAD_NOT_FULLY_LOADED"]) {
      expect(isStaleLoadError(new ApiError(409, code, ""))).toBe(true);
    }
    expect(isStaleLoadError(new ApiError(409, "PACKAGE_NOT_IN_LOAD", ""))).toBe(false);
  });

  it("lỗi làm cả hàng đợi quét thất bại như nhau → dừng hàng đợi", () => {
    expect(isScanQueueFatal(new ApiError(0, "NETWORK_ERROR", ""))).toBe(true);
    expect(isScanQueueFatal(new ApiError(403, "FORBIDDEN", ""))).toBe(true);
    expect(isScanQueueFatal(new ApiError(409, "INVALID_LOAD_TRANSITION", ""))).toBe(true);
    expect(isScanQueueFatal(new ApiError(404, "LOAD_NOT_FOUND", ""))).toBe(true);
    expect(isScanQueueFatal(new Error("parse"))).toBe(true);
    // Lỗi của riêng mã đó → gửi tiếp mã sau
    expect(isScanQueueFatal(new ApiError(409, "PACKAGE_NOT_IN_LOAD", ""))).toBe(false);
    expect(isScanQueueFatal(new ApiError(409, "OPTIMISTIC_LOCK", ""))).toBe(false);
  });

  it("mã lỗi lạ (kể cả tên thuộc tính của Object) → câu chung", () => {
    expect(shippingErrorMessage(new ApiError(409, "PACKAGE_NOT_IN_LOAD", ""))).toBe(
      SHIPPING_ERROR_MESSAGES.PACKAGE_NOT_IN_LOAD,
    );
    expect(shippingErrorMessage(new ApiError(500, "constructor", ""))).toBe(
      SHIPPING_ERROR_MESSAGES.generic,
    );
  });
});
