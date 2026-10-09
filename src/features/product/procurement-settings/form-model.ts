import { z } from "zod";

import type { SkuProcurementSettingsView } from "./view-model";

export const PROCUREMENT_LABELS = {
  defaultSupplier: "Nhà cung cấp mặc định",
  reorderPoint: "Điểm đặt hàng lại",
  supplierId: "Nhà cung cấp",
  supplierItemCode: "Mã hàng NCC",
  leadTimeDays: "Thời gian giao",
  moq: "MOQ",
  orderMultiple: "Bội số đặt hàng",
} as const;

// Generic numeric correctness only: empty means unknown; no integer/domain limits implied.
const optionalQuantity = z
  .string()
  .refine(
    (value) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "Số không âm hợp lệ",
  );
export const procurementDraftSchema = z.object({
  defaultSupplierId: z.string(),
  reorderPoint: optionalQuantity,
  suppliers: z.array(
    z.object({
      supplierId: z.string().min(1, "Chọn nhà cung cấp"),
      supplierItemCode: z.string(),
      leadTimeDays: optionalQuantity,
      moq: optionalQuantity,
      orderMultiple: optionalQuantity,
    }),
  ),
});
export type ProcurementDraft = z.infer<typeof procurementDraftSchema>;
export type ProcurementSupplierChoice = Pick<
  SkuProcurementSettingsView["suppliers"][number],
  "supplierId" | "supplierName"
>;

export function toProcurementDraft(settings: SkuProcurementSettingsView): ProcurementDraft {
  return {
    defaultSupplierId: settings.defaultSupplierId ?? "",
    reorderPoint: settings.reorderPoint?.toString() ?? "",
    suppliers: settings.suppliers.map((supplier) => ({
      supplierId: supplier.supplierId,
      supplierItemCode: supplier.supplierItemCode ?? "",
      leadTimeDays: supplier.leadTimeDays?.toString() ?? "",
      moq: supplier.moq?.toString() ?? "",
      orderMultiple: supplier.orderMultiple?.toString() ?? "",
    })),
  };
}

const quantity = (value: string) => (value.trim() === "" ? null : Number(value));

export function fromProcurementDraft(
  draft: ProcurementDraft,
  current: SkuProcurementSettingsView,
  choices: readonly ProcurementSupplierChoice[],
): SkuProcurementSettingsView {
  const names = new Map(choices.map((supplier) => [supplier.supplierId, supplier.supplierName]));
  return {
    skuId: current.skuId,
    defaultSupplierId: draft.defaultSupplierId || null,
    defaultSupplierName: names.get(draft.defaultSupplierId) ?? null,
    reorderPoint: quantity(draft.reorderPoint),
    suppliers: draft.suppliers.map((supplier) => ({
      supplierId: supplier.supplierId,
      supplierName: names.get(supplier.supplierId) ?? supplier.supplierId,
      supplierItemCode: supplier.supplierItemCode || null,
      leadTimeDays: quantity(supplier.leadTimeDays),
      moq: quantity(supplier.moq),
      orderMultiple: quantity(supplier.orderMultiple),
    })),
  };
}
