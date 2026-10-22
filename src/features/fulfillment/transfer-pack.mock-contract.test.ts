/**
 * Contract test: mock adapter phải nói đúng hợp đồng + hành vi BE `TransferPackController` (SCRUM-287 PR T, BE PR #164) để
 * `transfer-pack-api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetLoadPlanMockStore } from "@/lib/api/mock-load-plan-store";
import { resetTransferMockStore } from "@/lib/api/mock-routes-transfer-orders-store";
import { resetTransferPackMockStore } from "@/lib/api/mock-routes-transfer-packs-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  completeTransferPack,
  getTransferPack,
  openTransferKit,
  openTransferPack,
  openTransferPackage,
  scanIntoTransferPackage,
  sealTransferPackage,
  shipTransferCarton,
  voidTransferPackage,
} from "./transfer-pack-api";

import type { RoleName } from "@/lib/auth";

const USERS = {
  manager: { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] },
  packer: { userId: "USER-WH-02", roles: ["Warehouse Staff"] },
  otherPacker: { userId: "USER-WH-01", roles: ["Warehouse Staff"] },
  qc: { userId: "USER-QC-01", roles: ["QC Staff"] },
} satisfies Record<string, { userId: string; roles: RoleName[] }>;

function actAs(user: { userId: string; roles: RoleName[] }) {
  useAuthStore.setState({
    user: {
      ...user,
      username: "t@t.vn",
      fullName: "Test",
      email: "t@t.vn",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetTransferMockStore();
  resetTransferPackMockStore();
  resetLoadPlanMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5). */
const FLOW_TIMEOUT_MS = 90_000;

// Lệnh seed của mock (`mock-routes-transfer-orders-store.ts`): Đã duyệt nguyên chuyến với một bộ + hai lô cùng SKU
const KIT_TRANSFER = "00000000-0000-4000-8000-0000000fa001";
const PARCEL_TRANSFER = "00000000-0000-4000-8000-0000000fa002";
const PACKED_TRANSFER = "TO-2026-0006";
const KIT_LINE = "tol-kit-1";
const LOT_A_LINE = "tol-kit-2";
const SEAL = {
  weightKg: 5,
  lengthCm: 40,
  widthCm: 30,
  heightCm: 20,
  packageType: "CARTON",
} as const;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

async function transferOf(id: string) {
  const { data } = await api.get<{ status: string; packedAt?: string; deliveryMode: string }>(
    `/inventory/transfer-orders/${id}`,
  );
  return data;
}

describe("transfer-pack mock ↔ hợp đồng BE PR #164", () => {
  it(
    "luồng đủ: mở phiên (APPROVED → PICKING) → bộ → quét (dòng / lô / lỗi) → nguyên thùng → niêm phong → hoàn tất → ứng viên kế hoạch xe",
    async () => {
      actAs(USERS.packer);
      expect((await transferOf(KIT_TRANSFER)).status).toBe("APPROVED");

      const session = await openTransferPack(KIT_TRANSFER);
      expect(session).toMatchObject({
        transferOrderId: KIT_TRANSFER,
        transferNumber: "TO-20261022-0001",
        transferStatus: "PICKING",
        deliveryMode: "FULL_TRUCKLOAD",
        packStatus: "Packing",
        packerId: USERS.packer.userId,
      });
      expect((await transferOf(KIT_TRANSFER)).status).toBe("PICKING");
      // Idempotent: mở lại trả đúng phiên đang mở
      expect((await openTransferPack(KIT_TRANSFER)).packId).toBe(session.packId);
      expect(session.lines).toHaveLength(3);
      const kit = session.lines.find((l) => l.transferLineId === KIT_LINE);
      expect(kit).toMatchObject({
        requested: 2,
        packed: 0,
        remaining: 2,
        packageCount: 2,
        kitSuggested: true,
      });
      const packId = session.packId;

      // Đóng bộ: số phần lệch danh mục → 422; đúng → 2 kiện, phần 1 chứa hàng
      expect(
        await codeOf(openTransferKit({ packId, transferLineId: KIT_LINE, partCount: 3 })),
      ).toBe("KIT_PART_COUNT_MISMATCH");
      const kitPack = await openTransferKit({ packId, transferLineId: KIT_LINE });
      expect(kitPack.partCount).toBe(2);
      const [part1, part2] = kitPack.packages;
      if (!part1 || !part2) throw new Error("bộ thiếu phần");
      expect(part1.kit).toMatchObject({ partNo: 1, partCount: 2, transferLineId: KIT_LINE });
      const ordinary = await openTransferPackage({ packId });

      // Quét: mã lạ → PACK_ITEM_NOT_IN_ORDER; hai dòng cùng SKU → PACK_SCAN_AMBIGUOUS; lô sai → PACK_LOT_MISMATCH
      const scan = (packageId: string, code: string, extra = {}) =>
        scanIntoTransferPackage({
          packId,
          packageId,
          scan: { scanId: crypto.randomUUID(), scannedCode: code, quantity: 1, ...extra },
        });
      expect(await codeOf(scan(ordinary.packageId, "NOPE"))).toBe("PACK_ITEM_NOT_IN_ORDER");
      expect(await codeOf(scan(ordinary.packageId, "SKU-001-BLK-L"))).toBe("PACK_SCAN_AMBIGUOUS");
      expect(
        await codeOf(
          scan(ordinary.packageId, "SKU-001-BLK-L", {
            transferLineId: LOT_A_LINE,
            lotNumber: "LOT-X",
          }),
        ),
      ).toBe("PACK_LOT_MISMATCH");
      // Bộ: chỉ phần 1 chứa đúng MỘT đơn vị của dòng bộ
      expect(await codeOf(scan(part2.packageId, "SKU-KIT-DESK"))).toBe("KIT_CONTENTS_INVALID");
      const afterKit = await scan(part1.packageId, "SKU-KIT-DESK");
      expect(afterKit.lines.find((l) => l.transferLineId === KIT_LINE)).toMatchObject({
        packed: 1,
        remaining: 1,
      });
      // scanId gửi lại → không ghi hai lần
      const scanId = crypto.randomUUID();
      const twice = () =>
        scanIntoTransferPackage({
          packId,
          packageId: ordinary.packageId,
          scan: { scanId, scannedCode: "SKU-001-BLK-L", quantity: 2, transferLineId: LOT_A_LINE },
        });
      await twice();
      const again = await twice();
      expect(again.lines.find((l) => l.transferLineId === LOT_A_LINE)?.packed).toBe(2);
      // Vượt số còn cần của dòng
      expect(
        await codeOf(
          scan(ordinary.packageId, "SKU-001-BLK-L", { transferLineId: LOT_A_LINE, quantity: 99 }),
        ),
      ).toBe("PACK_QUANTITY_EXCEEDS_ORDER");

      // Niêm phong: thiếu số đo → 400; KIT-FORCE cho hàng bộ trong kiện thường
      expect(
        await codeOf(
          sealTransferPackage({
            packId,
            packageId: ordinary.packageId,
            values: { ...SEAL, weightKg: 0 },
          }),
        ),
      ).toBe("VALIDATION_FAILED");
      expect(
        (await sealTransferPackage({ packId, packageId: ordinary.packageId, values: SEAL })).status,
      ).toBe("SEALED");
      expect(
        await codeOf(sealTransferPackage({ packId, packageId: ordinary.packageId, values: SEAL })),
      ).toBe("PACKAGE_SEALED");

      // Hoàn tất khi còn kiện mở có hàng → PACKAGE_NOT_SEALED; bộ chưa đủ phần → KIT_INCOMPLETE
      expect(await codeOf(completeTransferPack({ packId, partial: false }))).toBe(
        "PACKAGE_NOT_SEALED",
      );
      await sealTransferPackage({ packId, packageId: part1.packageId, values: SEAL });
      expect(await codeOf(completeTransferPack({ packId, partial: true, note: "x" }))).toBe(
        "KIT_INCOMPLETE",
      );
      await sealTransferPackage({ packId, packageId: part2.packageId, values: SEAL });

      // Nguyên thùng: LPN lạ → 404; thùng đã mở → 409; thùng đúng lô A (10) vượt số còn cần (8) → 409
      expect(await codeOf(shipTransferCarton({ packId, lpn: "LPN-9999" }))).toBe("NOT_FOUND");
      expect(await codeOf(shipTransferCarton({ packId, lpn: "LPN-0003" }))).toBe(
        "STOCK_CARTON_NOT_SHIPPABLE",
      );
      expect(await codeOf(shipTransferCarton({ packId, lpn: "LPN-0001" }))).toBe(
        "STOCK_CARTON_NOT_SHIPPABLE",
      );
      // Huỷ kiện thường → hàng tính là chưa đóng → thùng LPN-0001 (10 đơn vị lô A) giao nguyên được
      expect(
        (await voidTransferPackage({ packId, packageId: ordinary.packageId })).lines.find(
          (l) => l.transferLineId === LOT_A_LINE,
        )?.packed,
      ).toBe(0);
      const carton = await shipTransferCarton({ packId, lpn: "LPN-0001" });
      expect(carton.parcel.stockPackageId).toBeDefined();
      expect(carton.parcel.contents).toMatchObject([{ transferLineId: LOT_A_LINE, quantity: 10 }]);
      expect(carton.suggested).toEqual({ weightKg: 6.2, lengthCm: 40, widthCm: 30, heightCm: 25 });
      await sealTransferPackage({ packId, packageId: carton.parcel.packageId, values: SEAL });
      // Cùng thùng không giao hai lần
      expect(await codeOf(shipTransferCarton({ packId, lpn: "LPN-0001" }))).toBe(
        "STOCK_CARTON_NOT_SHIPPABLE",
      );
      // Thùng không khai số đo → không có gợi ý (vắng, không phải null)
      expect((await shipTransferCarton({ packId, lpn: "LPN-0002" })).suggested).toBeUndefined();

      // Hoàn tất: còn kiện mở có hàng (thùng vừa mở chưa niêm phong) → 409; niêm phong rồi thì thiếu (bộ còn 1, lô thiếu)
      expect(await codeOf(completeTransferPack({ packId, partial: false }))).toBe(
        "PACKAGE_NOT_SEALED",
      );
      const open = (await getTransferPack(packId)).packages.filter((p) => p.status === "OPEN");
      for (const p of open)
        await sealTransferPackage({ packId, packageId: p.packageId, values: SEAL });
      expect(await codeOf(completeTransferPack({ packId, partial: false }))).toBe(
        "PACKING_INCOMPLETE",
      );
      expect(await codeOf(completeTransferPack({ packId, partial: true }))).toBe(
        "VALIDATION_FAILED",
      );
      const done = await completeTransferPack({ packId, partial: true, note: "Thiếu hàng ở kho" });
      expect(done).toMatchObject({ packStatus: "Packed" });
      expect(done.packedAt).toBeDefined();

      // Lệnh đóng gói xong: packedAt đặt, vẫn PICKING; phiên đã xong không ghi được nữa
      const after = await transferOf(KIT_TRANSFER);
      expect(after).toMatchObject({ status: "PICKING" });
      expect(after.packedAt).toBeDefined();
      expect(await codeOf(openTransferPackage({ packId }))).toBe("PACK_STATE_CONFLICT");

      // Thành ứng viên kế hoạch xe nguồn TRANSFER
      const { data } = await api.get<
        { sourceType: string; code: string; transferOrderId?: string }[]
      >("/fulfillment/load-plan-candidates", {
        params: { warehouseId: "WH-HN-01", sourceType: "TRANSFER" },
      });
      expect(data.map((c) => c.transferOrderId)).toContain(KIT_TRANSFER);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "người khác đang đóng → PACKING_TAKEN (trừ quản lý kho); thiếu quyền đóng gói → 403; phiên lạ → 404",
    async () => {
      actAs(USERS.manager);
      // Lệnh TO-2026-0007 (mock-data) Đã duyệt, nguyên chuyến: người đầu tiên mở là người đóng
      actAs(USERS.packer);
      const session = await openTransferPack("TO-2026-0007");
      actAs(USERS.otherPacker);
      expect(await codeOf(openTransferPack("TO-2026-0007"))).toBe("PACKING_TAKEN");
      expect(await codeOf(openTransferPackage({ packId: session.packId }))).toBe("PACKING_TAKEN");
      // Xem phiên không bị chặn (packages:READ)
      expect((await getTransferPack(session.packId)).packerId).toBe(USERS.packer.userId);
      actAs(USERS.manager);
      expect((await openTransferPackage({ packId: session.packId })).status).toBe("OPEN");
      actAs(USERS.qc);
      expect(await codeOf(openTransferPack("TO-2026-0007"))).toBe("FORBIDDEN");
      actAs(USERS.packer);
      expect(await codeOf(getTransferPack("00000000-0000-4000-8000-00000000dead"))).toBe(
        "NOT_FOUND",
      );
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "lệnh giao lẻ → 409 TRANSFER_NOT_FULL_TRUCKLOAD; lệnh chưa duyệt → 409 INVALID_TRANSFER_TRANSITION; lệnh lạ → 404",
    async () => {
      actAs(USERS.packer);
      expect(await codeOf(openTransferPack(PARCEL_TRANSFER))).toBe("TRANSFER_NOT_FULL_TRUCKLOAD");
      expect(await codeOf(openTransferPack("TO-2026-0009"))).toBe("INVALID_TRANSFER_TRANSITION");
      expect(await codeOf(openTransferPack("TO-NOT-THERE"))).toBe("TRANSFER_ORDER_NOT_FOUND");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "lệnh seed đã đóng gói (PICKING, packedAt): mở phiên trả phiên PACKED; dừng lấy hàng → phiên CANCELLED, hết ứng viên",
    async () => {
      actAs(USERS.packer);
      const session = await openTransferPack(PACKED_TRANSFER);
      expect(session.packStatus).toBe("Packed");
      expect(session.packages.every((p) => p.status === "SEALED")).toBe(true);
      const candidates = async () =>
        (
          await api.get<{ transferOrderId?: string }[]>("/fulfillment/load-plan-candidates", {
            params: { warehouseId: "WH-HN-01", sourceType: "TRANSFER" },
          })
        ).data.map((c) => c.transferOrderId);
      expect(await candidates()).toContain(PACKED_TRANSFER);

      await api.post(`/inventory/transfer-orders/${PACKED_TRANSFER}/picking-cancellation`);
      expect(await transferOf(PACKED_TRANSFER)).toMatchObject({ status: "APPROVED" });
      expect((await getTransferPack(session.packId)).packStatus).toBe("Cancelled");
      expect(await candidates()).not.toContain(PACKED_TRANSFER);
    },
    FLOW_TIMEOUT_MS,
  );
});
