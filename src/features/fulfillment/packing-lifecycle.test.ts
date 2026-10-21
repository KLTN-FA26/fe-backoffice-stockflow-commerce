import { describe, expect, it } from "vitest";

import { FULFILLMENT_PACKAGE_PERMISSIONS as PACK, STAFF_ROLE } from "@/constants";

import { IDENTITIES } from "./__fixtures__/render";
import { OTHER_PACKER_ID, PACKER_ID } from "./__fixtures__/packing";
import { packingAccess } from "./packing-lifecycle";

import type { FulfillmentActor } from "./lifecycle";
import type { TestIdentity } from "./__fixtures__/render";
import type { SessionPackStatus } from "./packing-types";

const actorOf = (identity: TestIdentity, userId: string | null = PACKER_ID): FulfillmentActor => ({
  can: (code) => identity.permissions.includes(code),
  roles: identity.roles,
  userId,
});

const session = (packStatus: SessionPackStatus, packerId?: string) => ({ packStatus, packerId });

describe("packingAccess — BE PR #136 gate kép (quyền fulfillment-packages + vai trò) và người nhận đơn", () => {
  it("phiên Pending: NV kho / quản lý kho nhận đơn được; QC thì không", () => {
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseStaff)).canStart).toBe(
      true,
    );
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseManager)).canStart).toBe(
      true,
    );
    expect(packingAccess(session("Pending"), actorOf(IDENTITIES.qcStaff)).canStart).toBe(false);
  });

  it("Packing: người đã nhận đơn làm việc được; NV kho khác chỉ xem; quản lý kho làm việc được (không đổi người nhận)", () => {
    const owner = packingAccess(session("Packing", PACKER_ID), actorOf(IDENTITIES.warehouseStaff));
    expect(owner).toMatchObject({ canWork: true, isOwner: true, takenByOther: false });

    const other = packingAccess(
      session("Packing", OTHER_PACKER_ID),
      actorOf(IDENTITIES.warehouseStaff),
    );
    expect(other).toMatchObject({ canWork: false, takenByOther: true, managerAssist: false });

    const manager = packingAccess(
      session("Packing", OTHER_PACKER_ID),
      actorOf(IDENTITIES.warehouseManager),
    );
    expect(manager).toMatchObject({ canWork: true, takenByOther: false, managerAssist: true });
  });

  it("không còn đòi là người được gán lấy hàng: NV kho khác người lấy vẫn nhận đơn được", () => {
    expect(
      packingAccess(session("Pending"), actorOf(IDENTITIES.warehouseStaff, "bat-ky-ai")).canStart,
    ).toBe(true);
  });

  it("kiểm tra lại thiết kế (X-CHK, docs 08): người đóng gói / quản lý kho, chỉ khi On Hold, cần packages:CREATE; QC không", () => {
    const held = session("On Hold", PACKER_ID);
    expect(packingAccess(held, actorOf(IDENTITIES.warehouseStaff)).canReverify).toBe(true);
    expect(packingAccess(held, actorOf(IDENTITIES.warehouseManager)).canReverify).toBe(true);
    expect(packingAccess(held, actorOf(IDENTITIES.qcStaff)).canReverify).toBe(false);
    expect(packingAccess(session("Packing"), actorOf(IDENTITIES.warehouseStaff)).canReverify).toBe(
      false,
    );
    const readOnlyStaff = { roles: [STAFF_ROLE.WAREHOUSE_STAFF], permissions: [PACK.read] };
    expect(packingAccess(held, actorOf(readOnlyStaff)).canReverify).toBe(false);
  });

  it("đã đóng xong / bị giữ → không ai thao tác kiện", () => {
    for (const status of ["Packed", "On Hold", "Cancelled", "Unknown"] as const) {
      const access = packingAccess(
        session(status, PACKER_ID),
        actorOf(IDENTITIES.warehouseManager),
      );
      expect(access).toMatchObject({ canStart: false, canWork: false });
    }
  });

  it("nhãn: NV kho / quản lý kho có READ; QC không (BE @PreAuthorize)", () => {
    expect(packingAccess(session("Packing"), actorOf(IDENTITIES.warehouseStaff)).canLabel).toBe(
      true,
    );
    expect(packingAccess(session("Packing"), actorOf(IDENTITIES.qcStaff)).canLabel).toBe(false);
  });

  it("SYSTEM_ADMIN qua cổng vai trò và coi như quản lý kho", () => {
    const admin = {
      roles: [STAFF_ROLE.SYSTEM_ADMIN],
      permissions: IDENTITIES.warehouseStaff.permissions,
    };
    expect(packingAccess(session("Packing", OTHER_PACKER_ID), actorOf(admin))).toMatchObject({
      canWork: true,
      isManager: true,
    });
  });
});
