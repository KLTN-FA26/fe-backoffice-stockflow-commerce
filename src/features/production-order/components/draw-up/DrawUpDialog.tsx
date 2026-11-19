"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, PRODUCTION_LABELS } from "@/constants";
import { useProducerDirectory } from "@/lib/references/producer-options";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { useDrawUpProductionOrder } from "@/features/production-order/mutations";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.drawUp;

/**
 * Lập Đơn sản xuất cho MỘT đợt giao còn thiếu (docs 17 §4.3 bước 6, BR-05): chỉ chọn đơn vị sản xuất đang dùng; BE tự
 * điền dòng thiếu, kho nhận = kho xuất, ngày cần hàng = ngày bắt đầu cửa sổ giao (BR-26), cờ duyệt mẫu (BR-24). Xong
 * → sang chi tiết đơn nháp để sửa / gửi duyệt.
 */
export function DrawUpDialog({
  batch,
  onClose,
}: {
  batch: ShortDeliveryBatch;
  onClose: () => void;
}) {
  const router = useRouter();
  const drawUp = useDrawUpProductionOrder();
  const { active } = useProducerDirectory();
  const [producerId, setProducerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    drawUp.mutate(
      { salesOrderId: batch.salesOrderId, deliveryBatchSeq: batch.seq, producerId },
      {
        onSuccess: (created) => router.push(ADMIN_ROUTES.productionOrders.detail(created.id)),
        onError: (failure) => setError(productionOrderErrorMessage(failure)),
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()}>
      <FormDialogBody
        title={L.dialogTitle}
        description={L.dialogDescription(batch.orderNumber, batch.seq)}
        submitLabel={L.submit}
        canSubmit={producerId !== ""}
        isPending={drawUp.isPending}
        error={error ?? (active.length === 0 ? L.noProducers : null)}
        onSubmit={submit}
        onCancel={onClose}
      >
        <FormField id="draw-up-producer" label={L.producer} required>
          <Select value={producerId} onValueChange={setProducerId}>
            <SelectTrigger id="draw-up-producer" className={FORM_SELECT_CLASS} autoFocus>
              <SelectValue placeholder={PRODUCTION_LABELS.edit.producerPlaceholder} />
            </SelectTrigger>
            <TitledSelectContent title={L.producer}>
              {active.map((producer) => (
                <SelectItem key={producer.id} value={producer.id}>
                  {producer.code} · {producer.name}
                </SelectItem>
              ))}
            </TitledSelectContent>
          </Select>
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
