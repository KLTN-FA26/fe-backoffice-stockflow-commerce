import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS as PACK,
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
} from "@/constants";

import { OTHER_PACKER_ID, PACKER_ID } from "./__fixtures__/transfer-pack";
import { transferPackAccess } from "./transfer-pack-lifecycle";

import type { PermissionCode } from "@/lib/auth";

const actor = (permissions: PermissionCode[], userId: string | null = PACKER_ID) => ({
  can: (code: PermissionCode) => permissions.includes(code),
  userId,
});

const WORKER = [PACK.read, PACKING.read, PACKING.update];
const MANAGER = [...WORKER, PACKING.approve];
const packing = { packStatus: "Packing" as const, packerId: PACKER_ID };

describe("transferPackAccess — quyền theo mã, không theo tên vai trò (BE PR #164 dùng quyền đóng gói của đơn)", () => {
  it("người mở phiên (packing:UPDATE): làm việc được", () => {
    expect(transferPackAccess(packing, actor(WORKER))).toMatchObject({
      canRead: true,
      canPack: true,
      isOwner: true,
      canWork: true,
      takenByOther: false,
      managerAssist: false,
    });
  });

  it("người khác đang đóng, không có APPROVE → chỉ xem (BE PACKING_TAKEN)", () => {
    expect(
      transferPackAccess({ ...packing, packerId: OTHER_PACKER_ID }, actor(WORKER)),
    ).toMatchObject({
      canWork: false,
      takenByOther: true,
      managerAssist: false,
    });
  });

  it("có APPROVE (quản lý kho) → làm hộ / tiếp quản phiên của người khác", () => {
    expect(
      transferPackAccess({ ...packing, packerId: OTHER_PACKER_ID }, actor(MANAGER)),
    ).toMatchObject({
      canWork: true,
      takenByOther: false,
      managerAssist: true,
    });
  });

  it("chỉ packages:READ → không thao tác; thiếu cả READ → canRead false", () => {
    expect(transferPackAccess(packing, actor([PACK.read]))).toMatchObject({
      canRead: true,
      canPack: false,
      canWork: false,
    });
    expect(transferPackAccess(packing, actor([]))).toMatchObject({
      canRead: false,
      canWork: false,
    });
  });

  it("phiên đã đóng xong / đã huỷ → không còn thao tác với bất kỳ quyền nào", () => {
    for (const packStatus of ["Packed", "Cancelled", "Unknown"] as const) {
      expect(transferPackAccess({ ...packing, packStatus }, actor(MANAGER)).canWork).toBe(false);
    }
  });

  it("chưa đăng nhập (userId null) → không phải chủ phiên", () => {
    expect(transferPackAccess(packing, actor(WORKER, null)).isOwner).toBe(false);
  });
});
