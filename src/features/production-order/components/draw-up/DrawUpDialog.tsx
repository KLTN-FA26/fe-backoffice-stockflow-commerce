"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, PRODUCTION_LABELS } from "@/constants";
import { useProducerDirectory } from "@/lib/references/producer-options";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { useDrawUpProductionOrder } from "@/features/production-order/mutations";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { ProducerRef } from "@/lib/references/producer-options";
import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

const L = PRODUCTION_LABELS.drawUp;
/** Quá ngần này đơn vị thì Select cuộn dài khó dò → ô chọn gõ để tìm (R1). */
const SEARCHABLE_FROM = 10;

const producerText = (producer: ProducerRef) => `${producer.code} · ${producer.name}`;

/** Chọn đơn vị sản xuất: ≤ 10 đơn vị là Select, nhiều hơn là ô gõ tìm theo mã / tên. */
function ProducerField({
  producers,
  value,
  onChange,
}: {
  producers: readonly ProducerRef[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (producers.length <= SEARCHABLE_FROM) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="draw-up-producer" className={FORM_SELECT_CLASS} autoFocus>
          <SelectValue placeholder={PRODUCTION_LABELS.edit.producerPlaceholder} />
        </SelectTrigger>
        <TitledSelectContent title={L.producer}>
          {producers.map((producer) => (
            <SelectItem key={producer.id} value={producer.id}>
              {producerText(producer)}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    );
  }
  const picked = producers.find((producer) => producer.id === value);
  return (
    <InputCombobox
      id="draw-up-producer"
      open={open}
      onOpenChange={setOpen}
      displayValue={picked ? producerText(picked) : ""}
      placeholder={PRODUCTION_LABELS.edit.producerPlaceholder}
      searchPlaceholder={L.producerSearch}
      ariaLabel={L.producer}
      autoFocus
    >
      <CommandList>
        <CommandEmpty>{L.producerNoMatch}</CommandEmpty>
        <CommandGroup>
          {producers.map((producer) => (
            <CommandItem
              key={producer.id}
              value={producerText(producer)}
              className={COMBOBOX_ITEM_CLASS}
              onSelect={() => {
                onChange(producer.id);
                setOpen(false);
              }}
            >
              {producerText(producer)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </InputCombobox>
  );
}

/**
 * Lập Đơn sản xuất cho MỘT đợt giao còn thiếu (docs 17 §4.3 bước 6, BR-05): chỉ chọn đơn vị sản xuất đang dùng; BE tự
 * điền dòng thiếu, kho nhận = kho xuất, ngày cần hàng = ngày bắt đầu cửa sổ giao (BR-26), cờ duyệt mẫu (BR-24). Xong
 * → sang chi tiết đơn nháp để sửa / gửi cho đơn vị sản xuất.
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
  const [chosenId, setChosenId] = useState("");
  // Chỉ có một đơn vị đang dùng → chọn sẵn (R6); người dùng vẫn đổi được nếu sau này có thêm
  const producerId = chosenId || (active.length === 1 ? (active[0]?.id ?? "") : "");
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
          <ProducerField producers={active} value={producerId} onChange={setChosenId} />
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
