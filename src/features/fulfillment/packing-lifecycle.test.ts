import { describe, expect, it } from "vitest";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS as PACK,
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
} from "@/constants";

import { IDENTITIES } from "./__fixtures__/render";
import { OTHER_PACKER_ID, PACKER_ID } from "./__fixtures__/packing";
import { packingAccess } from "./packing-lifecycle";

import type { FulfillmentActor } from "./lifecycle";
import type { TestIdentity } from "./__fixtures__/render";
import type { SessionPackStatus } from "./packing-types";

const actorOf = (identity: TestIdentity, userId: string | null = PACKER_ID): FulfillmentActor => ({
  can: (code) => identity.permissions.includes(code),
  userId,
});

const session = (packStatus: SessionPackStatus, packerId?: string) => ({ packStatus, packerId });

describe("packingAccess — BE PR #148: mã quyền (packages:READ, packing:UPDATE / APPROVE / READ, design-reverification:UPDATE) và người nhận đơn", () => {
  it("phiên Pending: NV kho / quản lý kho nhận đơn được; QC thì không", () => {
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseStaff)).canStart).toBe(
      true,
    );
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseManager)).canStart).toBe(
      true,
    );
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.qcStaff)).canStart).toBe(false);
  });

  it("Packing: người đã nhận đơn làm việc được; NV kho khác chỉ xem; ai có packing:APPROVE (quản lý kho) làm việc được (không đổi người nhận)", () => {
    const owner = packingAccess(
      session("In Progress", PACKER_ID),
      actorOf(IDENTITIES.warehouseStaff),
    );
    expect(owner).toMatchObject({ canWork: true, isOwner: true, takenByOther: false });

    const other = packingAccess(
      session("In Progress", OTHER_PACKER_ID),
      actorOf(IDENTITIES.warehouseStaff),
    );
    expect(other).toMatchObject({ canWork: false, takenByOther: true, managerAssist: false });

    const manager = packingAccess(
      session("In Progress", OTHER_PACKER_ID),
      actorOf(IDENTITIES.warehouseManager),
    );
    expect(manager).toMatchObject({ canWork: true, takenByOther: false, managerAssist: true });
  });

  it("không còn đòi là người được gán lấy hàng: NV kho khác người lấy vẫn nhận đơn được", () => {
    expect(
      packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseStaff, "bat-ky-ai")).canStart,
    ).toBe(true);
  });

  it("đã kiểm xong / đã huỷ → không ai thao tác kiện", () => {
    for (const status of ["Completed", "Cancelled", "Unknown"] as const) {
      const access = packingAccess(
        session(status, PACKER_ID),
        actorOf(IDENTITIES.warehouseManager),
      );
      expect(access).toMatchObject({ canStart: false, canWork: false });
    }
  });

  it("nhãn: cần fulfillment-packing:READ (NV kho, quản lý kho); QC không", () => {
    expect(packingAccess(session("In Progress"), actorOf(IDENTITIES.warehouseStaff)).canLabel).toBe(
      true,
    );
    expect(packingAccess(session("In Progress"), actorOf(IDENTITIES.qcStaff)).canLabel).toBe(false);
  });

  it("một vai trò tạo lúc chạy chỉ cần được cấp đúng mã: packing:UPDATE nhận đơn, packing:APPROVE tiếp quản phiên người khác", () => {
    const packer = actorOf({ permissions: [PACK.read, PACKING.update] });
    expect(packingAccess(session("Pending"), packer).canStart).toBe(true);
    expect(packingAccess(session("In Progress", OTHER_PACKER_ID), packer).takenByOther).toBe(true);
    const lead = actorOf({ permissions: [PACK.read, PACKING.update, PACKING.approve] });
    expect(packingAccess(session("In Progress", OTHER_PACKER_ID), lead)).toMatchObject({
      canWork: true,
      canTakeOver: true,
    });
    // đọc phiên mà không có packing:UPDATE → không nhận đơn
    expect(packingAccess(session("Pending"), actorOf({ permissions: [PACK.read] })).canStart).toBe(
      false,
    );
  });
});
