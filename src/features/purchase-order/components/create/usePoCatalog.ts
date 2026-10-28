"use client";

import { useState } from "react";

import { SUPPLIER_ITEM_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { useSupplierCatalog } from "@/lib/references/supplier-items";
import { minimumOrderQuantity, termsOf } from "@/features/purchase-order";

import { createEmptyLine } from "./helpers";

import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import type { SupplierItemRef } from "@/lib/references/supplier-items";
import type { PoCreateFormValues } from "@/features/purchase-order";

type PoForm = UseFormReturn<PoCreateFormValues>;
type PoLines = UseFieldArrayReturn<PoCreateFormValues, "lines">;

/**
 * Danh mục hàng của NCC đang chọn cho form PO (#30): tải danh mục, chọn SKU cho dòng, đổi NCC.
 * BR-01 (docs 02 §6): SKU của dòng PO phải thuộc danh mục của NCC.
 */
export function usePoCatalog(form: PoForm, lines: PoLines, supplierId: string) {
  const can = usePermissionChecker();
  // UI-only — Backend phải re-check (@RequiresPermission procurement-supplier-items:READ)
  const canRead = can(SUPPLIER_ITEM_PERMISSIONS.read);
  const query = useSupplierCatalog(supplierId, canRead);
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);

  const applySupplier = (id: string) =>
    form.setValue("supplierId", id, { shouldDirty: true, shouldTouch: true, shouldValidate: true });

  /** Dòng đã chọn SKU mang SKU/giá/điều khoản của NCC cũ ⇒ hỏi trước khi đổi NCC. */
  const requestSupplierChange = (id: string) => {
    if (id === form.getValues("supplierId")) return;
    if (form.getValues("lines").some((l) => l.skuId !== "")) setPendingSupplierId(id);
    else applySupplier(id);
  };
  const confirmSupplierChange = () => {
    if (pendingSupplierId === null) return;
    applySupplier(pendingSupplierId);
    lines.replace([createEmptyLine()]);
    setPendingSupplierId(null);
  };
  const cancelSupplierChange = () => setPendingSupplierId(null);

  /** Chọn SKU: chụp điều khoản danh mục vào dòng, điền giá; giữ mô tả người dùng đã gõ. */
  const selectSku = (index: number, item: SupplierItemRef) => {
    const opts = { shouldDirty: true, shouldTouch: true };
    form.setValue(`lines.${index}.skuId`, item.sku, opts);
    form.setValue(`lines.${index}.terms`, termsOf(item), opts);
    // BR-07 (docs 02 §6): một tiền tệ/PO — giá danh mục khác tiền tệ PO thì không điền (sai đơn vị).
    const sameCurrency = item.currency === form.getValues("currency");
    form.setValue(`lines.${index}.unitPrice`, sameCurrency ? String(item.price) : "", opts);
    // Dòng đang báo lỗi → kiểm lại ngay theo điều khoản mới (MOQ / quy cách / giá).
    if (form.formState.errors.lines?.[index]) void form.trigger(`lines.${index}`);
  };

  /**
   * Thêm nhiều SKU một lượt (hộp "Thêm nhiều SKU"): mỗi SKU một dòng mới, SL = mức tối thiểu theo
   * MOQ + quy cách, giá như `selectSku`. Dòng mới còn trống hẳn (chưa SKU, chưa mô tả) bị thay.
   */
  const addSkus = (items: readonly SupplierItemRef[]) => {
    if (items.length === 0) return;
    const currency = form.getValues("currency");
    const blank = form
      .getValues("lines")
      .flatMap((l, i) => (l.lineId === "" && l.skuId === "" && l.description === "" ? [i] : []));
    if (blank.length > 0) lines.remove(blank);
    lines.append(
      items.map((item) => ({
        ...createEmptyLine(),
        skuId: item.sku,
        terms: termsOf(item),
        orderedQty: String(minimumOrderQuantity(item)),
        // BR-07 (docs 02 §6): giá danh mục khác tiền tệ PO thì không điền
        unitPrice: item.currency === currency ? String(item.price) : "",
      })),
      { shouldFocus: false },
    );
  };

  /**
   * Đổi tiền tệ PO — BR-07 (docs 02 §6): giá danh mục chỉ đúng đơn vị khi cùng tiền tệ PO.
   * Dòng mới còn giữ giá điền sẵn mà khác tiền tệ ⇒ xoá để bắt nhập; về lại tiền tệ danh mục ⇒ điền
   * lại cho dòng đang trống. Giá người dùng tự gõ và dòng đã lưu giữ nguyên. Trả về có đổi dòng nào.
   */
  const repriceForCurrency = (currency: string): boolean => {
    let changed = false;
    form.getValues("lines").forEach((line, i) => {
      const { terms } = line;
      if (!terms || line.lineId !== "") return;
      const catalogPrice = String(terms.price);
      const prefilled = line.unitPrice === catalogPrice;
      const blank = line.unitPrice.trim() === "";
      let price: string | null = null;
      if (terms.currency !== currency && prefilled) price = "";
      else if (terms.currency === currency && blank) price = catalogPrice;
      if (price === null) return;
      form.setValue(`lines.${i}.unitPrice`, price, { shouldDirty: true });
      changed = true;
    });
    return changed;
  };

  return {
    canRead,
    repriceForCurrency,
    query,
    items: query.data?.items ?? [],
    currency: query.data?.currency ?? null,
    truncated: query.data?.truncated ?? false,
    selectSku,
    addSkus,
    pendingSupplierId,
    requestSupplierChange,
    confirmSupplierChange,
    cancelSupplierChange,
  };
}

export type PoCatalog = ReturnType<typeof usePoCatalog>;
