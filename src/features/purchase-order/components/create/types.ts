import { ClipboardCheck, FileText, Layers, Package } from "lucide-react";

import { UI_LABELS } from "@/constants";

import type { ApiError } from "@/lib/api/error";
import type { PoCreateFormValues, PurchaseOrder } from "@/features/purchase-order";

export type StepKey = "info" | "lines" | "totals" | "review";

/** Trạng thái một bước trên stepper — cùng nghĩa với wizard NCC. */
export type StepStatus = "active" | "done" | "error" | "idle";

/** BE PR #71: tạm tính (Σ SL × đơn giá), thuế (Σ thuế từng dòng), tổng = hai cái cộng lại. */
export type Totals = {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
};

export const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Thông tin PO", icon: FileText },
  { key: "lines", label: UI_LABELS.purchaseOrder.lines, icon: Layers },
  { key: "totals", label: UI_LABELS.purchaseOrder.totals, icon: Package },
  { key: "review", label: UI_LABELS.purchaseOrder.createAction, icon: ClipboardCheck },
];

/**
 * Form rỗng — CHỈ các trường BE `CreatePurchaseOrderRequest` lưu (supplierId, warehouseId,
 * currency, expectedAt, lines). Không điền sẵn id NCC/SKU nào (không bịa dữ liệu).
 */
export const PO_CREATE_DEFAULTS: PoCreateFormValues = {
  supplierId: "",
  warehouseId: "",
  currency: "VND",
  expectedDate: "",
  note: "",
  lines: [
    {
      skuId: "",
      description: "",
      orderedQty: "1",
      unitPrice: "",
      taxRate: "",
      lineId: "",
      terms: null,
    },
  ],
};

/**
 * Tải lại PO đang sửa: `po` khi thành công, `error` khi lỗi (KHÔNG trả data cũ React Query còn giữ) —
 * nơi gọi phân loại được 403/404 (đơn ngoài phạm vi / không còn) với lỗi mạng tạm thời.
 */
export type PoReload = () => Promise<{ po?: PurchaseOrder; error?: unknown }>;

/** Tuỳ chọn lõi wizard PO (`usePoWizard`) — màn tạo và màn sửa nháp. */
export type PoWizardOptions = {
  mode: "create" | "edit";
  defaults: PoCreateFormValues;
  /** Màn sửa nháp: ngày đặt của PO — ngày giao không được trước (BE `PurchaseOrder#reviseDraft`). */
  minExpectedDate?: string;
  /** Màn sửa nháp: kho nhận đang lưu trên PO (có thể đã ngừng hoạt động — không còn trong danh sách). */
  currentWarehouse?: { warehouseId: string; name: string };
  /** Màn sửa nháp thiếu quyền đọc danh mục NCC — xem `PoFormSchemaOptions.savedLinesWithoutTerms`. */
  savedLinesWithoutTerms?: boolean;
  /** Không lưu được nữa (đơn đổi trạng thái / mất quyền) — khoá lưu, không gửi PUT. */
  blocked?: boolean;
  isSubmitting: boolean;
  /**
   * Gọi khi người dùng xác nhận ở dialog; `applyServerErrors` map lỗi BE về ô + bước,
   * `closeConfirm` đóng dialog xác nhận (màn gọi tự quyết lúc đóng: thành công / lỗi).
   */
  onConfirm: (
    values: PoCreateFormValues,
    applyServerErrors: (err: ApiError) => void,
    closeConfirm: () => void,
  ) => void;
};
