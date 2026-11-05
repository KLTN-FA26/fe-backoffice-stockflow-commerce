import { describe, expect, it } from "vitest";

import { VEHICLE_TYPE_PERMISSIONS } from "@/constants";

import { vehicleTypeActions } from "./lifecycle";

import type { PermissionCode } from "@/lib/auth";

const actorWith = (...codes: PermissionCode[]) => ({
  can: (code: PermissionCode) => codes.includes(code),
});
const VT = VEHICLE_TYPE_PERMISSIONS;

describe("vehicleTypeActions — cổng quyền theo mã, không theo vai trò", () => {
  it("có UPDATE: thêm, sửa, và đổi trạng thái hai chiều", () => {
    const actor = actorWith(VT.viewPage, VT.read, VT.update);
    expect(vehicleTypeActions({ status: "ACTIVE" }, actor)).toEqual({
      create: true,
      edit: true,
      statusTargets: ["INACTIVE"],
    });
    expect(vehicleTypeActions({ status: "INACTIVE" }, actor).statusTargets).toEqual(["ACTIVE"]);
  });

  it("chỉ READ: không thêm, không sửa, không đổi trạng thái", () => {
    const actions = vehicleTypeActions({ status: "ACTIVE" }, actorWith(VT.viewPage, VT.read));
    expect(actions).toEqual({ create: false, edit: false, statusTargets: [] });
  });

  it("không có dòng (nút Thêm ở đầu trang): chỉ create theo UPDATE", () => {
    expect(vehicleTypeActions(null, actorWith(VT.update))).toEqual({
      create: true,
      edit: false,
      statusTargets: [],
    });
    expect(vehicleTypeActions(null, actorWith(VT.read)).create).toBe(false);
  });
});
