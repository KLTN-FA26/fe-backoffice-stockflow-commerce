"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Controller, useForm, useWatch } from "react-hook-form";

import { ADMIN_ROUTES, PAGE_SIZE, UI_LABELS } from "@/constants";
import { receiptCreateInputSchema } from "@/features/receipt/input-schemas";
import { useCreateGoodsReceipt } from "@/features/receipt/mutations";
import {
  usePoDraftReceipts,
  useReceivablePurchaseOrder,
  useReceivablePurchaseOrders,
} from "@/features/receipt/queries";
import { isReceivablePoStatus } from "@/features/receipt/receivable-po-api";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { FieldError, Section } from "../primitives";
import { ReceiptLoadError } from "../ReceiptLoadError";
import { DeliveryNoteFields } from "./DeliveryNoteFields";
import { ExistingDraftsAlert } from "./ExistingDraftsAlert";
import { PoLinesPreview } from "./PoLinesPreview";
import { PoSelect } from "./PoSelect";

import type { ReceiptCreateInput, ReceiptCreateValues } from "@/features/receipt/types";

/** Form tạo phiếu DRAFT: chọn PO đã chốt (BR-01), xem dòng còn mở, nhập phiếu giao NCC. */
export function ReceiptCreateForm() {
  const router = useRouter();
  const [poParam] = useQueryState("poId", parseAsString.withDefault(""));
  const form = useForm<ReceiptCreateInput, unknown, ReceiptCreateValues>({
    resolver: zodResolver(receiptCreateInputSchema),
    defaultValues: { purchaseOrderId: poParam, deliveryNote: "", note: "" },
  });
  const poId = useWatch({ control: form.control, name: "purchaseOrderId" });
  const pos = useReceivablePurchaseOrders({ size: PAGE_SIZE.masterData });
  const po = useReceivablePurchaseOrder(poId, { enabled: !!poId });
  const create = useCreateGoodsReceipt();
  const errors = form.formState.errors;
  // PO mở từ link (?poId=) có thể không còn nhận được nữa → báo rõ thay vì để BE từ chối
  const notReceivable = po.data && !isReceivablePoStatus(po.data.status);
  const drafts = usePoDraftReceipts(poId || undefined);
  const options = pos.data?.items ?? [];

  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (receipt) => router.push(ADMIN_ROUTES.receipts.detail(receipt.id)),
    }),
  );

  if (pos.isPending) return <PageSkeleton variant="form" />;
  if (pos.isError) {
    return <ReceiptLoadError error={pos.error} onRetry={() => void pos.refetch()} />;
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
      <Section title="Đơn đặt hàng" description="Chỉ đơn đã chốt hoặc đang nhận một phần (BR-01).">
        <Label htmlFor="receipt-po" className="text-[0.8125rem]">
          Đơn đặt hàng
        </Label>
        <Controller
          control={form.control}
          name="purchaseOrderId"
          render={({ field }) => (
            <PoSelect
              value={field.value}
              onChange={field.onChange}
              options={options}
              current={po.data}
              errorId={errors.purchaseOrderId ? "receipt-po-error" : undefined}
            />
          )}
        />
        <FieldError id="receipt-po-error">{errors.purchaseOrderId?.message}</FieldError>
        {notReceivable && (
          <FieldError>
            {"Đơn này chưa chốt hoặc đã nhận xong — không tạo phiếu nhận được."}
          </FieldError>
        )}
        {po.isError && <FieldError>{"Không tải được dòng của đơn đặt hàng."}</FieldError>}
        <ExistingDraftsAlert drafts={drafts} />
        {po.data && po.data.lines.length > 0 && (
          <div className="mt-3">
            <PoLinesPreview lines={po.data.lines} />
          </div>
        )}
      </Section>

      <DeliveryNoteFields register={form.register} errors={errors} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.receipts.list}>Huỷ</Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          // Không đọc được PO (404 / lỗi tải) → không có dòng để nhận, BE cũng sẽ từ chối
          disabled={create.isPending || !!notReceivable || po.isError}
          className="rounded-[var(--r-sm)]"
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {UI_LABELS.receipt.action.create}
        </Button>
      </div>
    </form>
  );
}
