"use client";

import { useState } from "react";

import { countLineCartonContexts } from "@/features/receipt/carton-selectors";

import { CARTON_SET_OPTIONS } from "../cartons/carton-form";

import type { UseFormReturn } from "react-hook-form";
import type { CartonDraft } from "../cartons/CartonEditor";
import type { CountCartons } from "./CountLinesTable";
import type {
  GoodsReceipt,
  ReceiptLinesFormInput,
  ReceiptLinesValues,
  ReceivablePoLine,
} from "@/features/receipt/types";

/**
 * Trình chia thùng của form kiểm đếm (SCRUM-473): ngữ cảnh thùng từng dòng, dòng nào đang bung (theo `field.id`), ghi
 * thùng vào form. `cartonLineId` (mở từ nút "Chia thùng" của bảng kết quả) → bung sẵn và focus trình chia thùng dòng đó.
 */
export function useCountCartons({
  receipt,
  form,
  rowIds,
  lines,
  poLineById,
  cartonLineId,
  onEdit,
}: {
  receipt: GoodsReceipt;
  form: UseFormReturn<ReceiptLinesFormInput, unknown, ReceiptLinesValues>;
  rowIds: readonly string[];
  lines: ReceiptLinesFormInput["lines"];
  poLineById: ReadonlyMap<string, ReceivablePoLine>;
  cartonLineId: string | undefined;
  onEdit: () => void;
}): CountCartons {
  const contexts = countLineCartonContexts(
    receipt.lines,
    lines.map((l) => ({
      purchaseOrderLineId: l.purchaseOrderLineId,
      lotNumber: l.lotNumber ?? "",
      sku: poLineById.get(l.purchaseOrderLineId)?.sku,
      packages: l.packages,
    })),
  );
  // Dòng form thứ i = dòng đã lưu thứ i (`initialCountLines`)
  const [focus] = useState(() => rowIds[receipt.lines.findIndex((l) => l.id === cartonLineId)]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(focus ? [focus] : []),
  );
  const toggle = (rowId: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });
  const set = (index: number, next: CartonDraft) => {
    onEdit();
    form.setValue(`lines.${index}.unitOfMeasure`, next.unitOfMeasure, CARTON_SET_OPTIONS);
    form.setValue(`lines.${index}.packages`, next.packages, CARTON_SET_OPTIONS);
  };
  return { contexts, expanded, toggle, set, focus };
}
