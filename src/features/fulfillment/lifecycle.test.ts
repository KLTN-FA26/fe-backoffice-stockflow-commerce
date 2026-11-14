import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  PACK_STATUSES,
  PICK_STATUSES,
} from "@/constants";
import { PACK_TRANSITIONS, PICK_TRANSITIONS } from "@/lib/domain/lifecycle";

import { IDENTITIES, type TestIdentity } from "./__fixtures__/render";
import {
  FULFILLMENT_ACTIONS,
  allowedFulfillmentActions,
  canCreateTask,
  isBlockedAsNonAssignee,
  isTaskCancelled,
  isTaskClosed,
} from "./lifecycle";

import type { PackStatus, PickStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import type { FulfillmentActor, FulfillmentGateState } from "./lifecycle";

const ME = "user-me";
const SOMEONE_ELSE = "user-other";

function actorOf(identity: TestIdentity, userId: string | null = ME): FulfillmentActor {
  return { can: (code) => identity.permissions.includes(code), userId };
}

const task = (
  pickStatus: PickStatus,
  packStatus: PackStatus,
  assignedUserId: string = ME,
): FulfillmentGateState => ({ pickStatus, packStatus, assignedUserId });

const codes = (state: FulfillmentGateState, actor: FulfillmentActor) =>
  allowedFulfillmentActions(state, actor).map((action) => action.code);

describe("PICK_TRANSITIONS / PACK_TRANSITIONS (docs 07 §5.1, docs 08 §5.1; BE PickStatus / PackStatus)", () => {
  it("mọi trạng thái đều có trong bảng", () => {
    expect(Object.keys(PICK_TRANSITIONS).sort()).toEqual([...PICK_STATUSES].sort());
    expect(Object.keys(PACK_TRANSITIONS).sort()).toEqual([...PACK_STATUSES].sort());
  });

  it("pick: Pending → Picking → Picked (DISPATCH) hoặc Staged (STAGING); huỷ theo đơn", () => {
    expect(PICK_TRANSITIONS.Pending).toEqual(["Picking", "Cancelled"]);
    expect(PICK_TRANSITIONS.Picking).toEqual(["Picked", "Staged", "Cancelled"]);
  });

  it("pick: Staged → Picked (chuyển cả tác vụ sang khu xuất hàng) hoặc Picking (lấy bổ sung); Picked cũng về Picking", () => {
    expect(PICK_TRANSITIONS.Staged).toEqual(["Picking", "Picked", "Cancelled"]);
    expect(PICK_TRANSITIONS.Picked).toEqual(["Picking", "Cancelled"]);
  });

  it("pick: Cancelled là terminal; BE không còn trạng thái Short của task", () => {
    expect(PICK_TRANSITIONS.Cancelled).toEqual([]);
    expect(Object.keys(PICK_TRANSITIONS)).not.toContain("Short");
  });

  it("pack (docs 08 §5.1): Pending → In Progress (nhận đơn) → Completed; hoàn tất một phần ở lại In Progress", () => {
    expect(PACK_TRANSITIONS.Pending).toEqual(["In Progress", "Cancelled"]);
    expect(PACK_TRANSITIONS["In Progress"]).toEqual(["In Progress", "Completed", "Cancelled"]);
  });

  it("pack: Completed / Cancelled là terminal; không còn On Hold / Packing / Packed", () => {
    expect(PACK_TRANSITIONS.Completed).toEqual([]);
    expect(PACK_TRANSITIONS.Cancelled).toEqual([]);
    expect(Object.keys(PACK_TRANSITIONS).sort()).toEqual(
      ["Cancelled", "Completed", "In Progress", "Pending"].sort(),
    );
  });
});

describe("allowedFulfillmentActions — mã quyền + người được gán (BE PR #148: chỉ còn gate theo mã quyền)", () => {
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
  });

  it("task Staged (docs 07 §4.3 bước 8): chỉ người có task-assignment:UPDATE (quản lý kho) chuyển sang khu xuất hàng, không cần là người được gán; NV kho thì không", () => {
    const staged = task("Staged", "Pending", SOMEONE_ELSE);
    expect(codes(staged, actorOf(IDENTITIES.warehouseManager))).toEqual(["moveToDispatch"]);
    expect(codes(staged, actorOf(IDENTITIES.orderCoordinator))).toEqual(["moveToDispatch"]);
    expect(codes(staged, actorOf(IDENTITIES.warehouseStaff))).toEqual([]);
    // Người được gán cũng không hoàn tất lại được — dòng đã Staged, task đã Staged
    expect(codes(task("Staged", "Pending"), actorOf(IDENTITIES.warehouseStaff))).toEqual([]);
  });

  it("nút chuyển sang khu xuất hàng chỉ hiện ở task Staged — không ở Pending / Picking / Picked / Cancelled", () => {
    const manager = actorOf(IDENTITIES.warehouseManager, "user-manager");
    for (const pick of PICK_STATUSES) {
      const has = codes(task(pick, "Pending", SOMEONE_ELSE), manager).includes("moveToDispatch");
      expect(has).toBe(pick === "Staged");
    }
  });

  it("Picking: người được gán hoàn tất lấy hàng (kết quả Picked hay Staged do đích của task)", () => {
    const staff = actorOf(IDENTITIES.warehouseStaff);
    const complete = FULFILLMENT_ACTIONS.find((action) => action.code === "completePicking");
    expect(complete?.pick).toEqual({ from: ["Picking"] });
    expect(codes(task("Picking", "Pending"), staff)).toEqual(["completePicking"]);
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
      expect(codes(task("Picked", "Completed"), actor)).toEqual([]);
    }
  });

  it("không có mã quyền nào → không có thao tác", () => {
    expect(codes(task("Pending", "Pending"), actorOf({ permissions: [] }))).toEqual([]);
  });

  it("mỗi thao tác theo đúng mã quyền của endpoint — một vai trò tạo lúc chạy chỉ cần được cấp mã đó", () => {
    const only = (code: PermissionCode) => actorOf({ permissions: [code] });
    const pending = task("Pending", "Pending");
    expect(codes(pending, only(ASSIGNMENT.update))).toEqual(["assign"]);
    expect(codes(pending, only(PICKING.update))).toEqual(["startPicking"]);
    expect(codes(task("Picking", "Pending"), only(PICKING.update))).toEqual(["completePicking"]);
    expect(codes(task("Staged", "Pending", SOMEONE_ELSE), only(ASSIGNMENT.update))).toEqual([
      "moveToDispatch",
    ]);
    // mã đọc / mã của endpoint khác không mở thao tác
    expect(codes(pending, only(PICK.read))).toEqual([]);
    expect(codes(pending, only(ASSIGNMENT.create))).toEqual([]);
    expect(codes(task("Staged", "Pending", SOMEONE_ELSE), only(PICKING.update))).toEqual([]);
    expect(codes(task("Picked", "In Progress"), only(PACKING.update))).toEqual([]);
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
  it("isBlockedAsNonAssignee: đủ quyền nhưng task gán cho người khác", () => {
    const manager = actorOf(IDENTITIES.warehouseManager);
    const others = task("Pending", "Pending", SOMEONE_ELSE);
    expect(isBlockedAsNonAssignee(others, manager, ["startPicking"])).toBe(true);
    expect(isBlockedAsNonAssignee(task("Pending", "Pending"), manager, ["startPicking"])).toBe(
      false,
    );
    // Điều phối không có fulfillment-picking:UPDATE → không phải "bị chặn vì không được gán"
    expect(
      isBlockedAsNonAssignee(others, actorOf(IDENTITIES.orderCoordinator), ["startPicking"]),
    ).toBe(false);
  });

  it("canCreateTask: fulfillment-task-assignment:CREATE (điều phối / quản lý kho); NV kho và QC thì không", () => {
    expect(canCreateTask(actorOf(IDENTITIES.orderCoordinator))).toBe(true);
    expect(canCreateTask(actorOf(IDENTITIES.warehouseManager))).toBe(true);
    expect(canCreateTask(actorOf(IDENTITIES.warehouseStaff))).toBe(false);
    expect(canCreateTask(actorOf(IDENTITIES.qcStaff))).toBe(false);
  });

  it("isTaskCancelled / isTaskClosed", () => {
    expect(isTaskCancelled(task("Cancelled", "Cancelled"))).toBe(true);
    expect(isTaskCancelled(task("Picked", "In Progress"))).toBe(false);
    expect(isTaskClosed(task("Picked", "Completed"))).toBe(true);
    expect(isTaskClosed(task("Cancelled", "Pending"))).toBe(true);
    expect(isTaskClosed(task("Picked", "In Progress"))).toBe(false);
  });

  it("chưa đăng nhập (userId null) không bao giờ là người được gán", () => {
    const anonymous = actorOf(IDENTITIES.warehouseStaff, null);
    expect(
      codes({ pickStatus: "Pending", packStatus: "Pending", assignedUserId: null }, anonymous),
    ).toEqual([]);
  });
});
