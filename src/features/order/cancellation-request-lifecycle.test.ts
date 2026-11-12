/**
 * Vòng đời yêu cầu huỷ (docs 17 §5.4) + gate thao tác theo trạng thái / mã quyền.
 */
import { describe, expect, it } from "vitest";

import { CANCELLATION_REQUEST_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { CANCELLATION_REQUEST_STATUSES } from "@/constants/statuses";

import {
  CANCELLATION_REQUEST_TRANSITIONS,
  allowedCancellationRequestActions,
} from "./cancellation-request-lifecycle";

import type { PermissionCode } from "@/lib/auth";

const holding =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);

describe("CANCELLATION_REQUEST_TRANSITIONS (docs 17 §5.4)", () => {
  it("đủ bốn trạng thái của docs: Pending / Approved / Rejected / Expired", () => {
    expect(Object.keys(CANCELLATION_REQUEST_TRANSITIONS).sort()).toEqual(
      [...CANCELLATION_REQUEST_STATUSES].sort(),
    );
  });

  it("Pending → Approved / Rejected / Expired", () => {
    expect(CANCELLATION_REQUEST_TRANSITIONS.PENDING).toEqual(["APPROVED", "REJECTED", "EXPIRED"]);
  });

  it("Approved, Rejected, Expired là terminal — không chuyển tiếp nào", () => {
    for (const status of ["APPROVED", "REJECTED", "EXPIRED"] as const) {
      expect(CANCELLATION_REQUEST_TRANSITIONS[status]).toEqual([]);
    }
  });
});

describe("allowedCancellationRequestActions — gate theo trạng thái + mã quyền", () => {
  it("Pending + sales-order-cancellations:UPDATE (Sale) → duyệt và từ chối", () => {
    expect(allowedCancellationRequestActions("PENDING", holding(ORDER_PERMISSIONS.cancel))).toEqual(
      ["approve", "reject"],
    );
  });

  it("Pending + chỉ đọc hàng đợi (…:READ) hoặc không có quyền → không thao tác nào", () => {
    expect(
      allowedCancellationRequestActions("PENDING", holding(CANCELLATION_REQUEST_PERMISSIONS.read)),
    ).toEqual([]);
    expect(allowedCancellationRequestActions("PENDING", holding())).toEqual([]);
  });

  it("trạng thái cuối (Approved / Rejected / Expired) → không nút mutating nào, kể cả đủ quyền", () => {
    for (const status of ["APPROVED", "REJECTED", "EXPIRED"]) {
      expect(allowedCancellationRequestActions(status, holding(ORDER_PERMISSIONS.cancel))).toEqual(
        [],
      );
    }
  });

  it("trạng thái BE lạ → không đoán, không mở nút", () => {
    expect(allowedCancellationRequestActions("ON_HOLD", holding(ORDER_PERMISSIONS.cancel))).toEqual(
      [],
    );
  });
});
