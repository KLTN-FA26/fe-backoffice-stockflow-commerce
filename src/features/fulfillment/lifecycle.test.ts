import { describe, expect, it } from "vitest";

import { PACK_STATUSES, PICK_STATUSES } from "@/constants";
import { PACK_TRANSITIONS, PICK_TRANSITIONS } from "@/lib/domain/lifecycle";

import { IDENTITIES, type TestIdentity } from "./__fixtures__/render";
import {
  FULFILLMENT_ACTIONS,
  allowedFulfillmentActions,
  canCreateTask,
  canDownloadArtifact,
  isBlockedAsNonAssignee,
  isTaskCancelled,
  isTaskClosed,
} from "./lifecycle";

import type { PackStatus, PickStatus } from "@/constants";
import type { FulfillmentActor, FulfillmentGateState } from "./lifecycle";

const ME = "user-me";
const SOMEONE_ELSE = "user-other";

function actorOf(identity: TestIdentity, userId: string | null = ME): FulfillmentActor {
  return {
    can: (code) => identity.permissions.includes(code),
    roles: identity.roles,
    userId,
  };
}

const task = (
  pickStatus: PickStatus,
  packStatus: PackStatus,
  assignedUserId: string = ME,
): FulfillmentGateState => ({ pickStatus, packStatus, assignedUserId });

const codes = (state: FulfillmentGateState, actor: FulfillmentActor) =>
  allowedFulfillmentActions(state, actor).map((action) => action.code);

describe("PICK_TRANSITIONS / PACK_TRANSITIONS (theo BE PickJpaEntity / PackJpaEntity)", () => {
  it("mọi trạng thái đều có trong bảng", () => {
    expect(Object.keys(PICK_TRANSITIONS).sort()).toEqual([...PICK_STATUSES].sort());
    expect(Object.keys(PACK_TRANSITIONS).sort()).toEqual([...PACK_STATUSES].sort());
  });

  it("pick: Pending → Picking → Picked; huỷ theo đơn ở bước chưa xong", () => {
    expect(PICK_TRANSITIONS.Pending).toEqual(["Picking", "Cancelled"]);
    expect(PICK_TRANSITIONS.Picking).toEqual(["Picked", "Cancelled"]);
  });

  it("pick: Picked / Short / Cancelled là terminal", () => {
    expect(PICK_TRANSITIONS.Picked).toEqual([]);
    expect(PICK_TRANSITIONS.Short).toEqual([]);
    expect(PICK_TRANSITIONS.Cancelled).toEqual([]);
  });

  it("pack (BE PR #136): Pending → Packing (nhận đơn) → Packed hoặc On Hold; On Hold về Packing (X-CHK), không ra Packed", () => {
    expect(PACK_TRANSITIONS.Pending).toEqual(["Packing", "Cancelled"]);
    expect(PACK_TRANSITIONS.Packing).toEqual(["Packed", "On Hold", "Cancelled"]);
    expect(PACK_TRANSITIONS["On Hold"]).toEqual(["Packing", "Cancelled"]);
  });

  it("pack: Packed / Cancelled là terminal", () => {
    expect(PACK_TRANSITIONS.Packed).toEqual([]);
    expect(PACK_TRANSITIONS.Cancelled).toEqual([]);
  });
});

describe("allowedFulfillmentActions — quyền + vai trò + người được gán (BE gate kép)", () => {
  it("NV kho là người được gán: Pending → bắt đầu; Picking → hoàn tất; Picked → hết thao tác lấy hàng", () => {
    const staff = actorOf(IDENTITIES.warehouseStaff);
    expect(codes(task("Pending", "Pending"), staff)).toEqual(["startPicking"]);
    expect(codes(task("Picking", "Pending"), staff)).toEqual(["completePicking"]);
    // Đóng gói không còn là action của task (BE PR #136): gate ở `packing-lifecycle.ts`
    expect(codes(task("Picked", "Pending"), staff)).toEqual([]);
  });

  it("NV kho KHÔNG phải người được gán → không có thao tác nào", () => {
    const staff = actorOf(IDENTITIES.warehouseStaff);
    for (const pick of PICK_STATUSES) {
      expect(codes(task(pick, "Pending", SOMEONE_ELSE), staff)).toEqual([]);
    }
  });

  it("quản lý kho không được gán: gán lại được, KHÔNG lấy hàng hộ", () => {
    const manager = actorOf(IDENTITIES.warehouseManager);
    expect(codes(task("Pending", "Pending", SOMEONE_ELSE), manager)).toEqual(["assign"]);
    expect(codes(task("Picking", "Pending", SOMEONE_ELSE), manager)).toEqual([]);
    expect(codes(task("Picked", "Pending", SOMEONE_ELSE), manager)).toEqual([]);
  });

  it("quản lý kho tự được gán → gán lại + bắt đầu lấy hàng", () => {
    const manager = actorOf(IDENTITIES.warehouseManager);
    expect(codes(task("Pending", "Pending"), manager)).toEqual(["assign", "startPicking"]);
  });

  it("điều phối đơn: chỉ gán khi pick còn Pending; không lấy hàng, không gỡ giữ", () => {
    const coordinator = actorOf(IDENTITIES.orderCoordinator);
    expect(codes(task("Pending", "Pending"), coordinator)).toEqual(["assign"]);
    expect(codes(task("Picking", "Pending"), coordinator)).toEqual([]);
    expect(codes(task("Picked", "Pending"), coordinator)).toEqual([]);
    expect(codes(task("Picked", "On Hold"), coordinator)).toEqual([]);
  });

  it("X-CHK: chỉ QC / quản lý kho kiểm tra lại kiện On Hold, không cần là người được gán", () => {
    const held = task("Picked", "On Hold", SOMEONE_ELSE);
    expect(codes(held, actorOf(IDENTITIES.qcStaff))).toEqual(["reverify"]);
    expect(codes(held, actorOf(IDENTITIES.warehouseManager))).toEqual(["reverify"]);
    // Người được gán là NV kho: không có quyền kiểm tra lại thiết kế
    expect(codes(task("Picked", "On Hold"), actorOf(IDENTITIES.warehouseStaff))).toEqual([]);
  });

  it("QC không có thao tác lấy hàng / gán", () => {
    const qc = actorOf(IDENTITIES.qcStaff);
    expect(codes(task("Pending", "Pending"), qc)).toEqual([]);
    expect(codes(task("Picked", "Pending"), qc)).toEqual([]);
  });

  it("task đã huỷ / đã đóng gói → không còn nút mutating nào với mọi vai trò", () => {
    for (const identity of Object.values(IDENTITIES)) {
      const actor = actorOf(identity);
      expect(codes(task("Cancelled", "Cancelled"), actor)).toEqual([]);
      expect(codes(task("Picked", "Packed"), actor)).toEqual([]);
    }
  });

  it("có vai trò nhưng thiếu mã quyền → không có thao tác", () => {
    const noPermission = actorOf({ roles: IDENTITIES.warehouseStaff.roles, permissions: [] });
    expect(codes(task("Pending", "Pending"), noPermission)).toEqual([]);
  });

  it("có mã quyền nhưng sai vai trò → không có thao tác (BE @PreAuthorize)", () => {
    const wrongRole = actorOf({
      roles: ["SALES_STAFF"],
      permissions: IDENTITIES.warehouseStaff.permissions,
    });
    expect(codes(task("Pending", "Pending"), wrongRole)).toEqual([]);
  });

  it("SYSTEM_ADMIN qua cổng vai trò nhưng vẫn phải là người được gán mới lấy hàng", () => {
    const admin = { roles: ["SYSTEM_ADMIN"], permissions: IDENTITIES.warehouseStaff.permissions };
    expect(codes(task("Pending", "Pending", SOMEONE_ELSE), actorOf(admin))).toEqual(["assign"]);
    expect(codes(task("Pending", "Pending"), actorOf(admin))).toEqual(["assign", "startPicking"]);
  });

  it("mỗi action đích đều có trong bảng chuyển trạng thái", () => {
    for (const action of FULFILLMENT_ACTIONS) {
      for (const from of action.pick?.from ?? []) {
        if (action.pick?.to) expect(PICK_TRANSITIONS[from]).toContain(action.pick.to);
      }
      for (const from of action.pack?.from ?? []) {
        if (action.pack?.to) expect(PACK_TRANSITIONS[from]).toContain(action.pack.to);
      }
    }
  });
});

describe("các cổng phụ", () => {
  it("isBlockedAsNonAssignee: đủ quyền + vai trò nhưng task gán cho người khác", () => {
    const manager = actorOf(IDENTITIES.warehouseManager);
    const others = task("Pending", "Pending", SOMEONE_ELSE);
    expect(isBlockedAsNonAssignee(others, manager, ["startPicking"])).toBe(true);
    expect(isBlockedAsNonAssignee(task("Pending", "Pending"), manager, ["startPicking"])).toBe(
      false,
    );
    // Điều phối không có vai trò lấy hàng → không phải "bị chặn vì không được gán"
    expect(
      isBlockedAsNonAssignee(others, actorOf(IDENTITIES.orderCoordinator), ["startPicking"]),
    ).toBe(false);
  });

  it("canCreateTask: điều phối / quản lý kho; NV kho và QC thì không", () => {
    expect(canCreateTask(actorOf(IDENTITIES.orderCoordinator))).toBe(true);
    expect(canCreateTask(actorOf(IDENTITIES.warehouseManager))).toBe(true);
    expect(canCreateTask(actorOf(IDENTITIES.warehouseStaff))).toBe(false);
    expect(canCreateTask(actorOf(IDENTITIES.qcStaff))).toBe(false);
  });

  it("canDownloadArtifact: người được gán, quản lý kho, QC; điều phối và NV kho khác thì không", () => {
    const others = task("Picked", "Pending", SOMEONE_ELSE);
    expect(canDownloadArtifact(task("Picked", "Pending"), actorOf(IDENTITIES.warehouseStaff))).toBe(
      true,
    );
    expect(canDownloadArtifact(others, actorOf(IDENTITIES.warehouseStaff))).toBe(false);
    expect(canDownloadArtifact(others, actorOf(IDENTITIES.warehouseManager))).toBe(true);
    expect(canDownloadArtifact(others, actorOf(IDENTITIES.qcStaff))).toBe(true);
    expect(canDownloadArtifact(others, actorOf(IDENTITIES.orderCoordinator))).toBe(false);
    // Đơn đã huỷ → BE từ chối tải (task đã đóng)
    expect(
      canDownloadArtifact(task("Cancelled", "Cancelled"), actorOf(IDENTITIES.warehouseManager)),
    ).toBe(false);
  });

  it("isTaskCancelled / isTaskClosed", () => {
    expect(isTaskCancelled(task("Cancelled", "Cancelled"))).toBe(true);
    expect(isTaskCancelled(task("Picked", "On Hold"))).toBe(false);
    expect(isTaskClosed(task("Picked", "Packed"))).toBe(true);
    expect(isTaskClosed(task("Cancelled", "Pending"))).toBe(true);
    expect(isTaskClosed(task("Picked", "On Hold"))).toBe(false);
  });

  it("chưa đăng nhập (userId null) không bao giờ là người được gán", () => {
    const anonymous = actorOf(IDENTITIES.warehouseStaff, null);
    expect(
      codes({ pickStatus: "Pending", packStatus: "Pending", assignedUserId: null }, anonymous),
    ).toEqual([]);
  });
});
