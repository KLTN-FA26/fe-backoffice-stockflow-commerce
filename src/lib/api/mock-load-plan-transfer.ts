/**
 * Mock kế hoạch xếp xe — phần nguồn TRANSFER (BE PR #164): hoàn tất đóng gói chuyển kho đưa lệnh vào danh sách ứng viên,
 * dừng lấy hàng đưa lệnh ra và huỷ kế hoạch của nó. Tách khỏi `mock-load-plan-store.ts` cho gọn.
 */

import { getMockPlans, getMockShipments } from "./mock-load-plan-store";

/**
 * Hoàn tất đóng gói chuyển kho → lệnh thành ứng viên của kế hoạch xe nguồn TRANSFER, mỗi kiện niêm phong là một kiện
 * (cm làm tròn lên mm như BE). Gọi lại (đóng lại sau khi dừng lấy hàng) thay ứng viên cũ.
 */
export function addMockTransferShipment(
  transfer: {
    transferId: string;
    number: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    status: string;
    packedAt: string | null;
    lines: { lineId: string; sku: string }[];
  },
  pack: {
    parcels: {
      packageId: string;
      labelCode: string;
      status: string;
      weightKg?: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      rotatable: boolean;
      contents: { transferLineId: string }[];
      kit?: { groupId: string; partNo: number; partCount: number };
    }[];
  },
): void {
  dropMockTransferShipment(transfer.transferId);
  const sealed = pack.parcels.filter((p) => p.status === "SEALED");
  const mm = (cm: number | undefined) => Math.ceil((cm ?? 1) * 10);
  getMockShipments().push({
    shipmentId: transfer.transferId,
    code: transfer.number,
    orderId: "",
    orderNumber: "",
    allowPartialShipment: false,
    readyAt: transfer.packedAt ?? new Date().toISOString(),
    warehouseId: transfer.fromWarehouseId,
    packages: sealed.map((p) => {
      const skus = [
        ...new Set(
          p.contents.flatMap((c) =>
            transfer.lines.filter((l) => l.lineId === c.transferLineId).map((l) => l.sku),
          ),
        ),
      ];
      return {
        packageId: p.packageId,
        labelCode: p.labelCode,
        shipmentId: transfer.transferId,
        shipmentCode: transfer.number,
        partName: p.kit
          ? `${skus[0] ?? "KIT"} ${p.kit.partNo}/${p.kit.partCount}`
          : skus.join(" + ") || "—",
        lengthMm: mm(p.lengthCm),
        widthMm: mm(p.widthCm),
        heightMm: mm(p.heightCm),
        weightKg: p.weightKg ?? 0,
        rotatable: p.rotatable,
        kitGroupId: p.kit?.groupId ?? null,
        kitPartNo: p.kit?.partNo ?? null,
        kitPartCount: p.kit?.partCount ?? null,
      };
    }),
    transfer: {
      transferOrderId: transfer.transferId,
      number: transfer.number,
      toWarehouseId: transfer.toWarehouseId,
      status: transfer.status,
    },
  });
}

/**
 * Dừng lấy hàng (BE `picking-cancellation`): kế hoạch còn sống của lệnh bị huỷ cùng các chuyến và lệnh thôi là ứng viên.
 * Trả `false` khi một xe của kế hoạch đã bắt đầu xếp hàng (BE 409 `LOAD_PLAN_LOADING_STARTED`) — khi đó không đổi gì.
 */
export function dropMockTransferShipment(transferOrderId: string): boolean {
  const live = [...getMockPlans().values()].filter(
    (plan) =>
      plan.sourceType === "TRANSFER" &&
      plan.shipmentIds.includes(transferOrderId) &&
      plan.status !== "CANCELLED" &&
      plan.status !== "DISPATCHED",
  );
  if (
    live.some((plan) =>
      plan.vehicles.some((v) => v.load?.status === "LOADING" || v.load?.status === "DISPATCHED"),
    )
  )
    return false;
  for (const plan of live) {
    plan.vehicles = plan.vehicles.map((v) => ({ ...v, load: null }));
    plan.status = "CANCELLED";
    plan.cancelledAt = new Date().toISOString();
    plan.cancelReason = "Transfer picking cancelled";
    plan.version += 1;
  }
  const list = getMockShipments();
  const at = list.findIndex((s) => s.transfer?.transferOrderId === transferOrderId);
  if (at >= 0) list.splice(at, 1);
  return true;
}
