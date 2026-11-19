/**
 * Action-gating file đính kèm (docs 09 §4.4, §4.3 bước 2, BR-28): quyền × trạng thái, bằng mã quyền (không tên vai trò).
 */
import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS as OUTCOME,
  FULFILLMENT_DISPATCH_PERMISSIONS as DISPATCH,
  LOAD_STATUSES,
  PACK_SHIPMENT_API_STATUSES,
} from "@/constants";
import { SHIPPING_FILE_LABELS as L } from "@/constants/shipping-files";

import { podFilesGate, waybillFilesGate } from "./attached-files-lifecycle";

import type { PermissionCode } from "@/lib/auth";

const actor = (...granted: PermissionCode[]) => ({
  can: (code: PermissionCode) => granted.includes(code),
});
const DISPATCHER = actor(DISPATCH.update);
const OUTCOME_UPDATER = actor(OUTCOME.update);
const COORDINATOR = actor(OUTCOME.update, OUTCOME.approve);
const READER = actor();

describe("waybillFilesGate", () => {
  it.each(["VEHICLE_BOOKED", "LOADING", "DISPATCHED"] as const)(
    "đã đặt xe (%s): người có fulfillment-dispatch:UPDATE tải lên được",
    (status) => {
      expect(waybillFilesGate(status, DISPATCHER)).toEqual({
        canUpload: true,
        blockedReason: null,
      });
    },
  );

  it("chưa đặt xe (PLANNED) hoặc trạng thái lạ: có quyền nhưng bị chặn, kèm lý do", () => {
    expect(waybillFilesGate("PLANNED", DISPATCHER)).toEqual({
      canUpload: true,
      blockedReason: L.waybill.notBooked,
    });
    expect(waybillFilesGate("UNKNOWN", DISPATCHER).blockedReason).toBe(L.waybill.notBooked);
  });

  it("chuyến đã huỷ: lý do riêng", () => {
    expect(waybillFilesGate("CANCELLED", DISPATCHER).blockedReason).toBe(L.waybill.cancelled);
  });

  it("thiếu fulfillment-dispatch:UPDATE (kể cả có quyền kết quả giao): không tải lên ở mọi trạng thái", () => {
    for (const status of LOAD_STATUSES) {
      expect(waybillFilesGate(status, READER).canUpload).toBe(false);
      expect(waybillFilesGate(status, COORDINATOR).canUpload).toBe(false);
    }
  });
});

describe("podFilesGate", () => {
  it("lô đã giao: chỉ cần fulfillment-delivery-outcomes:UPDATE (APPROVE không cần)", () => {
    expect(podFilesGate("DELIVERED", OUTCOME_UPDATER)).toEqual({
      canUpload: true,
      blockedReason: null,
    });
    expect(podFilesGate("DELIVERED", COORDINATOR)).toEqual({
      canUpload: true,
      blockedReason: null,
    });
  });

  it.each(["READY_TO_DISPATCH", "HANDED_OVER", "DELIVERY_FAILED", "UNKNOWN"] as const)(
    "%s: chưa giao, lý do ghi nhận giao trước",
    (status) => {
      expect(podFilesGate(status, OUTCOME_UPDATER).blockedReason).toBe(L.pod.notDelivered);
    },
  );

  it.each(["RETURNED", "CANCELLED"] as const)("%s: không có biên bản để tải lên", (status) => {
    expect(podFilesGate(status, OUTCOME_UPDATER).blockedReason).toBe(L.pod.notApplicable);
  });

  it("không có quyền: không tải lên, không bị nhắc ghi nhận giao; nhân viên kho chỉ có dispatch cũng không", () => {
    for (const status of PACK_SHIPMENT_API_STATUSES) {
      expect(podFilesGate(status, READER)).toEqual({ canUpload: false, blockedReason: null });
      expect(podFilesGate(status, DISPATCHER).canUpload).toBe(false);
    }
  });
});
