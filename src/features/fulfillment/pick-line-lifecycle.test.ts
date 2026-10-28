import { describe, expect, it } from "vitest";

import { IDENTITIES } from "./__fixtures__/render";
import {
  allowedTaskActions,
  canConfirmPickLines,
  canPutBack,
  canReallocate,
  canReportShort,
  canViewPutBacks,
  isConfirmableLine,
  isReallocatableLine,
} from "./pick-line-lifecycle";

import type { PickStatus } from "@/constants";
import type { TestIdentity } from "./__fixtures__/render";
import type { FulfillmentActor, FulfillmentGateState } from "./lifecycle";

const PICKER = "picker-1";
const OTHER = "someone-else";

/** Người dùng = bộ mã quyền theo seed BE + userId (FE không đọc tên vai trò). */
const actor = (identity: TestIdentity, userId: string): FulfillmentActor => ({
  can: (code) => identity.permissions.includes(code),
  userId,
});

const gate = (pickStatus: PickStatus, assignedUserId = PICKER): FulfillmentGateState => ({
  pickStatus,
  packStatus: pickStatus === "Cancelled" ? "Cancelled" : "Pending",
  assignedUserId,
});

const assignee = actor(IDENTITIES.warehouseStaff, PICKER);
const otherStaff = actor(IDENTITIES.warehouseStaff, OTHER);
const manager = actor(IDENTITIES.warehouseManager, OTHER);
const coordinator = actor(IDENTITIES.orderCoordinator, OTHER);
const qc = actor(IDENTITIES.qcStaff, PICKER);

describe("canConfirmPickLines / canReportShort — BE picking:UPDATE + requireAssigned + task PICKING", () => {
  it.each([
    ["NV kho được gán, Picking", assignee, gate("Picking"), true],
    ["NV kho khác (không được gán), Picking", otherStaff, gate("Picking"), false],
    ["quản lý kho không được gán, Picking", manager, gate("Picking"), false],
    ["quản lý kho ĐƯỢC gán, Picking", manager, gate("Picking", OTHER), true],
    ["điều phối (không có picking:UPDATE) dù được gán", coordinator, gate("Picking", OTHER), false],
    ["QC chỉ đọc dù được gán", qc, gate("Picking"), false],
    ["NV được gán nhưng task Pending", assignee, gate("Pending"), false],
    ["NV được gán nhưng task Picked", assignee, gate("Picked"), false],
    ["NV được gán nhưng task Cancelled", assignee, gate("Cancelled"), false],
  ])("%s → %s", (_, who, task, expected) => {
    expect(canConfirmPickLines(task, who)).toBe(expected);
    expect(canReportShort(task, who)).toBe(expected);
  });
});

describe("canReallocate — BE reallocation: task-assignment:UPDATE (người phân việc, không phải người lấy)", () => {
  it.each([
    ["điều phối, Picking", coordinator, gate("Picking"), true],
    ["quản lý kho, Picking", manager, gate("Picking"), true],
    ["NV kho được gán (không có task-assignment:UPDATE)", assignee, gate("Picking"), false],
    ["QC", qc, gate("Picking"), false],
    ["điều phối nhưng task Picked", coordinator, gate("Picked"), false],
    ["điều phối nhưng task Cancelled", coordinator, gate("Cancelled"), false],
  ])("%s → %s", (_, who, task, expected) => {
    expect(canReallocate(task, who)).toBe(expected);
  });
});

describe("isConfirmableLine — BE PickList.confirm / reportShort: chỉ dòng OPEN", () => {
  it.each([
    ["Open", true],
    ["Picked", false],
    ["Short", false],
    ["Cancelled", false],
    ["Put Back", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isConfirmableLine({ status })).toBe(expected);
  });
});

describe("allowedTaskActions — Hoàn tất lấy hàng chỉ khi đủ dòng (BE requireAllPicked)", () => {
  const codes = (complete: boolean) =>
    allowedTaskActions(gate("Picking"), assignee, { linesComplete: complete }).map((a) => a.code);

  it("còn dòng chưa lấy / thiếu → không có Hoàn tất", () => {
    expect(codes(false)).not.toContain("completePicking");
  });

  it("đủ dòng → có Hoàn tất", () => {
    expect(codes(true)).toContain("completePicking");
  });

  it("không đụng các thao tác khác (bắt đầu lấy hàng vẫn theo trạng thái)", () => {
    expect(
      allowedTaskActions(gate("Pending"), assignee, { linesComplete: false }).map((a) => a.code),
    ).toContain("startPicking");
  });
});

describe("isReallocatableLine — chỉ dòng Thiếu (BE reallocateShort: SHORT, khác → PICK_LINE_NOT_OPEN)", () => {
  it("Short → được; Open / Picked / Cancelled / Put Back → không", () => {
    expect(isReallocatableLine({ status: "Short" })).toBe(true);
    for (const status of ["Open", "Picked", "Cancelled", "Put Back"] as const) {
      expect(isReallocatableLine({ status })).toBe(false);
    }
  });
});

describe("trả hàng về kệ — BE putBacks (fulfillment-picking:READ) / putBack (fulfillment-picking:UPDATE)", () => {
  it.each([
    ["NV kho (kể cả không phải người đã lấy)", otherStaff, true, true],
    ["quản lý kho", manager, true, true],
    ["điều phối (không có fulfillment-picking)", coordinator, false, false],
    ["QC", qc, false, false],
  ])("%s → xem %s, trả %s", (_, who, view, put) => {
    expect(canViewPutBacks(who)).toBe(view);
    expect(canPutBack(who)).toBe(put);
  });
});
