import { describe, expect, it } from "vitest";

import { PUTAWAY_TASK_PERMISSIONS, PUTAWAY_TASK_STATUSES } from "@/constants";

import { PUTAWAY_TASK_TRANSITIONS, isPutawayTaskClosed, putawayTaskGate } from "../lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

const can =
  (...codes: PermissionCode[]) =>
  (code: PermissionCode) =>
    codes.includes(code);
const STAFF = can(PUTAWAY_TASK_PERMISSIONS.read, PUTAWAY_TASK_PERMISSIONS.update);
const VIEWER = can(PUTAWAY_TASK_PERMISSIONS.read);
const NOBODY = can();

describe("PUTAWAY_TASK_TRANSITIONS (docs 05 §5)", () => {
  it("có đủ mọi trạng thái BE PutawayStatus", () => {
    expect(Object.keys(PUTAWAY_TASK_TRANSITIONS).sort()).toEqual([...PUTAWAY_TASK_STATUSES].sort());
  });

  it("Pending → Done là chuyển tiếp duy nhất", () => {
    expect(PUTAWAY_TASK_TRANSITIONS.PENDING).toEqual(["DONE"]);
  });

  it("Done và Cancelled là terminal — không transition nào (BR-06)", () => {
    expect(PUTAWAY_TASK_TRANSITIONS.DONE).toEqual([]);
    expect(PUTAWAY_TASK_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("IN_PROGRESS (task lẻ cũ) không cất được — BE trả 400", () => {
    expect(PUTAWAY_TASK_TRANSITIONS.IN_PROGRESS).toEqual([]);
    expect(isPutawayTaskClosed("IN_PROGRESS")).toBe(true);
    expect(isPutawayTaskClosed("PENDING")).toBe(false);
  });
});

describe("putawayTaskGate — action-gating theo trạng thái + quyền", () => {
  it("Pending + nhân viên kho (UPDATE) → cất được", () => {
    expect(putawayTaskGate({ status: "PENDING" }, STAFF)).toEqual({ canConfirm: true });
  });

  it("Pending + chỉ có READ → chỉ xem", () => {
    expect(putawayTaskGate({ status: "PENDING" }, VIEWER)).toEqual({
      canConfirm: false,
      reason: "readOnly",
    });
  });

  it("Done → không thao tác, kể cả người có UPDATE", () => {
    expect(putawayTaskGate({ status: "DONE" }, STAFF)).toEqual({
      canConfirm: false,
      reason: "done",
    });
  });

  it("Cancelled / IN_PROGRESS → đóng, bất kể quyền", () => {
    for (const status of ["CANCELLED", "IN_PROGRESS"] as const) {
      expect(putawayTaskGate({ status }, STAFF)).toEqual({ canConfirm: false, reason: "closed" });
      expect(putawayTaskGate({ status }, NOBODY)).toEqual({ canConfirm: false, reason: "closed" });
    }
  });
});
