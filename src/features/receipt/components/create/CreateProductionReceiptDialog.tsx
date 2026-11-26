"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, PRODUCTION_RECEIPT_LIMITS, RECEIPT_COUNT_LABELS } from "@/constants";
import { useReceivableProductionOrders } from "@/lib/references/production-orders";
import { productionReceiptCreateInputSchema } from "@/features/receipt/count-schemas";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { useCreateProductionReceipt } from "@/features/receipt/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ProductionOrderCombobox } from "./ProductionOrderCombobox";

import type {
  ProductionReceiptCreateInput,
  ProductionReceiptCreateValues,
} from "@/features/receipt/types";

const L = RECEIPT_COUNT_LABELS.create;
const PO_ID = "gr-production-order";
const NOTE_ID = "gr-delivery-note";
const REMARK_ID = "gr-note";

function CreateForm({
  onClose,
  productionOrderId = "",
  detailHref = ADMIN_ROUTES.receipts.detail,
}: {
  onClose: () => void;
  /** Mở từ một Đơn sản xuất: chọn sẵn đơn đó. */
  productionOrderId?: string;
  detailHref?: (receiptId: string) => string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProductionReceipt();
  const form = useForm<ProductionReceiptCreateValues, unknown, ProductionReceiptCreateInput>({
    resolver: zodResolver(productionReceiptCreateInputSchema),
    defaultValues: { productionOrderId, deliveryNote: "", note: "" },
  });
  const { errors } = form.formState;
  // Chỉ có đúng một Đơn sản xuất nhận được hàng → chọn sẵn (R6), người dùng vẫn đổi / xoá được
  const receivable = useReceivableProductionOrders();
  const onlyId = receivable.data.length === 1 ? receivable.data[0]?.id : undefined;
  useEffect(() => {
    if (onlyId && !form.getValues("productionOrderId")) {
      form.setValue("productionOrderId", onlyId, { shouldValidate: false });
    }
  }, [onlyId, form]);

  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      // Phiếu nháp chưa có dòng — sang trang chi tiết để kiểm đếm (docs 03 §4.1 bước 2)
      onSuccess: (receipt) => {
        onClose();
        router.push(detailHref(receipt.id));
      },
      onError: (failure) => setError(receiptErrorMessage(failure)),
    }),
  );

  return (
    <FormDialogBody
      title={L.title}
      description={L.description}
      submitLabel={L.submit}
      canSubmit
      isPending={create.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField
        id={PO_ID}
        label={L.productionOrder}
        required
        error={errors.productionOrderId?.message}
      >
        <Controller
          control={form.control}
          name="productionOrderId"
          render={({ field }) => (
            <ProductionOrderCombobox
              id={PO_ID}
              value={field.value}
              onChange={field.onChange}
              error={!!errors.productionOrderId}
              describedBy={fieldA11y(PO_ID, errors.productionOrderId?.message)["aria-describedby"]}
            />
          )}
        />
      </FormField>
      <FormField id={NOTE_ID} label={L.deliveryNote} error={errors.deliveryNote?.message}>
        <Input
          placeholder={L.deliveryNotePlaceholder}
          maxLength={PRODUCTION_RECEIPT_LIMITS.deliveryNoteMax}
          className={FORM_INPUT_CLASS}
          {...fieldA11y(NOTE_ID, errors.deliveryNote?.message)}
          {...form.register("deliveryNote")}
        />
      </FormField>
      <FormField id={REMARK_ID} label={L.note} error={errors.note?.message}>
        <Textarea
          rows={2}
          maxLength={PRODUCTION_RECEIPT_LIMITS.noteMax}
          className={FORM_TEXTAREA_CLASS}
          {...fieldA11y(REMARK_ID, errors.note?.message)}
          {...form.register("note")}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Lập phiếu nhập theo Đơn sản xuất (docs 03 §4.1 bước 1; BE `POST /goods-receipts/production`): chọn một Đơn sản xuất
 * nhận được hàng (BR-01, BR-15), ghi số phiếu giao → phiếu `Draft`, rồi sang trang chi tiết để kiểm đếm theo thùng.
 */
export function CreateProductionReceiptDialog({
  open,
  onClose,
  productionOrderId,
  detailHref,
}: {
  open: boolean;
  onClose: () => void;
  productionOrderId?: string;
  detailHref?: (receiptId: string) => string;
}) {
  return (
    <FormDialog open={open} onOpenChange={(next) => !next && onClose()}>
      {open && (
        <CreateForm
          onClose={onClose}
          productionOrderId={productionOrderId}
          detailHref={detailHref}
        />
      )}
    </FormDialog>
  );
}
