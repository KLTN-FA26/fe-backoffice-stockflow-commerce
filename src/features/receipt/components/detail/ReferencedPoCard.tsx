"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { RECEIPT_REFERENCE_PO_PERMISSIONS } from "@/features/receipt/lifecycle";
import { useReferencePurchaseOrder } from "@/features/receipt/mutations";
import { useSupplierPurchaseOrders } from "@/features/receipt/queries";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, InfoItem, Section } from "../primitives";

import type { GoodsReceipt } from "@/features/receipt/types";

const B = UI_LABELS.receipt.blind;

/**
 * "Gắn PO bổ sung nếu có" của phiếu không có PO (docs 03; owner NOPO-ATTACH): CHỈ là tham chiếu — BE chỉ lưu id PO
 * trên phiếu, không cộng SL đã nhận cho đơn, không dung sai, không ảnh hưởng đối chiếu 3 bên. PO phải của cùng nhà
 * cung cấp (BE `RECEIPT_REFERENCE_SUPPLIER_MISMATCH`) nên chỉ liệt kê đơn của NCC của phiếu. Gắn được ở mọi bước
 * trước khi phiếu bị huỷ, kể cả sau khi đã ghi nhận.
 */
export function ReferencedPoCard({ receipt }: { receipt: GoodsReceipt }) {
  const can = usePermissionChecker();
  const canAttach = RECEIPT_REFERENCE_PO_PERMISSIONS.every(can) && receipt.status !== "Cancelled";
  const orders = useSupplierPurchaseOrders(receipt.supplierId, canAttach);
  const attach = useReferencePurchaseOrder();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const options = orders.data?.items ?? [];

  const save = () =>
    attach.mutate(
      { receiptId: receipt.id, purchaseOrderId: selected },
      {
        onSuccess: () => {
          setSelected("");
          setError(null);
        },
        onError: (failure) => setError(receiptErrorMessage(failure)),
      },
    );

  return (
    <Section title={B.referenceTitle} description={B.referenceDescription}>
      <InfoItem
        label={B.referenceTitle}
        value={receipt.referencedPurchaseOrderNumber ?? B.referenceNone}
        mono={!!receipt.referencedPurchaseOrderNumber}
      />
      {canAttach && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-56">
            <Select
              value={selected}
              onValueChange={(value) => {
                setSelected(value);
                setError(null);
              }}
            >
              <SelectTrigger
                aria-label={B.referenceSelect}
                className="border-border-default bg-bg-surface w-full max-w-md rounded-[var(--r-sm)] text-[0.8125rem]"
              >
                <SelectValue
                  placeholder={
                    orders.isPending
                      ? "Đang tải…"
                      : options.length
                        ? B.referenceSelect
                        : B.referenceNoOrders
                  }
                />
              </SelectTrigger>
              <TitledSelectContent title={B.referenceTitle}>
                {options.map((option) => (
                  <SelectItem key={option.purchaseOrderId} value={option.purchaseOrderId}>
                    <span className="font-[family-name:var(--font-mono)]">{option.poNumber}</span>
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selected || attach.isPending}
            onClick={save}
            className="rounded-[var(--r-sm)]"
          >
            {attach.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {receipt.referencedPurchaseOrderId ? B.referenceChange : B.referenceSave}
          </Button>
        </div>
      )}
      {orders.isError && <FieldError>{B.referenceLoadError}</FieldError>}
      <FieldError>{error ?? undefined}</FieldError>
    </Section>
  );
}
