import { describe, expect, it } from "vitest";

import { IDENTITIES } from "./__fixtures__/render";
import {
  allowedTaskActions,
  canConfirmPickLines,
  canPutBack,
  canReallocate,
  canReallocateLine,
  canReplaceRemovedCarton,
  canReportShort,
  canViewPutBacks,
  isConfirmableLine,
  isReallocatableLine,
  isReplaceableRemovedLine,
} from "./pick-line-lifecycle";

import type { PackStatus, PickStatus } from "@/constants";
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

describe("canConfirmPickLines / canReportShort — BE picking:UPDATE + requireWorker (assignee or task-assignment:UPDATE) + task PICKING", () => {
  it.each([
    ["NV kho được gán, Picking", assignee, gate("Picking"), true],
    ["NV kho khác (không được gán), Picking", otherStaff, gate("Picking"), false],
    ["quản lý kho làm thay NV được gán, Picking", manager, gate("Picking"), true],
    [
      "quản lý kho, task chưa có người gán",
      manager,
      { ...gate("Picking"), assignedUserId: null },
      false,
    ],
    ["quản lý kho làm thay nhưng task Pending", manager, gate("Pending"), false],
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

const removed = {
  status: "Picked",
  removalReason: "DAMAGED",
  replacementPending: true,
} as const;

describe("isReplaceableRemovedLine — thùng hư đã loại ở trạm kiểm thùng, đơn còn thiếu nó (BE replacementPending)", () => {
  it("Picked (hoặc Put Back, thùng hư đã cất sang khu cách ly) + DAMAGED + replacementPending → được", () => {
    expect(isReplaceableRemovedLine(removed)).toBe(true);
    expect(isReplaceableRemovedLine({ ...removed, status: "Put Back" })).toBe(true);
  });

  it.each([
    ["đã bù rồi (replacementPending=false)", { ...removed, replacementPending: false }],
    ["BE không gửi replacementPending", { status: "Picked", removalReason: "DAMAGED" }],
    [
      "loại vì lý do khác (đơn huỷ / đóng phần còn lại)",
      { ...removed, removalReason: "ORDER_CANCELLED" },
    ],
    ["không bị loại", { status: "Picked" }],
    ["không phải dòng Picked", { ...removed, status: "Cancelled" }],
  ] as const)("%s → không", (_, line) => {
    expect(isReplaceableRemovedLine(line)).toBe(false);
  });
});

describe("canReplaceRemovedCarton — BE replaceRemoved: task-assignment:UPDATE, task chưa huỷ, phiên kiểm thùng chưa xong", () => {
  const task = (pickStatus: PickStatus, packStatus: PackStatus): FulfillmentGateState => ({
    pickStatus,
    packStatus,
    assignedUserId: PICKER,
  });

  it.each([
    [
      "quản lý kho, task Picked, đang kiểm thùng (ca SO-…37)",
      manager,
      task("Picked", "In Progress"),
      true,
    ],
    ["quản lý kho, task Picked, chờ kiểm", manager, task("Picked", "Pending"), true],
    ["quản lý kho, task Staged, chưa kiểm", manager, task("Staged", "Pending"), true],
    ["quản lý kho, task Picking", manager, task("Picking", "Pending"), true],
    ["điều phối (có task-assignment:UPDATE)", coordinator, task("Picked", "In Progress"), true],
    ["kiểm thùng xong, thùng đã đi theo shipment", manager, task("Picked", "Completed"), false],
    ["task đã huỷ", manager, task("Cancelled", "Cancelled"), false],
    ["NV kho (không có task-assignment:UPDATE)", assignee, task("Picked", "In Progress"), false],
    ["QC", qc, task("Picked", "In Progress"), false],
  ])("%s → %s", (_, who, state, expected) => {
    expect(canReplaceRemovedCarton(state, who)).toBe(expected);
  });
});

describe("canReallocateLine — dòng SHORT (task Picking) hoặc thùng hư đã loại chưa bù", () => {
  const picked: FulfillmentGateState = {
    pickStatus: "Picked",
    packStatus: "In Progress",
    assignedUserId: PICKER,
  };

  it("task Picked đang kiểm thùng + thùng hư chưa bù: quản lý kho có, NV kho không", () => {
    expect(canReallocateLine(picked, manager, removed)).toBe(true);
    expect(canReallocateLine(picked, assignee, removed)).toBe(false);
  });

  it("dòng Picked bình thường (không bị loại) không có nút", () => {
    expect(canReallocateLine(picked, manager, { status: "Picked" })).toBe(false);
  });

  it("dòng SHORT vẫn theo luật cũ: chỉ khi task đang Picking", () => {
    expect(canReallocateLine(gate("Picking"), manager, { status: "Short" })).toBe(true);
    expect(canReallocateLine(picked, manager, { status: "Short" })).toBe(false);
  });
});
