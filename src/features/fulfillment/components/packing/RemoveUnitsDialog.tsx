"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { quantitySchema } from "@/features/fulfillment/packing-input-schemas";
import {
  isRetryablePackingError,
  packingErrorMessage,
} from "@/features/fulfillment/packing-errors";
import { useRemoveUnits } from "@/features/fulfillment/packing-mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { PackContent, PackPackage } from "@/features/fulfillment/packing-types";

const R = UI_LABELS.packing.remove;

/**
 * Bớt hàng khỏi kiện đang mở. Mỗi lần bớt có `scanId` riêng: gửi lại sau lỗi mạng dùng CÙNG id nên BE
 * không bớt hai lần; thành công hoặc lỗi nghiệp vụ thì đổi id. Dòng theo lô / serial gửi kèm đúng lô /
 * serial của hàng trong kiện (BE cần khi kiện giữ dòng đó dưới nhiều lô). Sửa số lượng cũng đổi id.
 */
export function RemoveUnitsDialog({
  taskId,
  pkg,
  content,
  onClose,
}: {
  taskId: string;
  pkg: PackPackage;
  content: PackContent;
  onClose: () => void;
}) {
  const remove = useRemoveUnits();
  const serial = !!content.serialNumber;
  const [quantity, setQuantity] = useState("1");
  const [scanId, setScanId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    const parsed = quantitySchema(content.quantity).safeParse(quantity);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    remove.mutate(
      {
        taskId,
        packageId: pkg.packageId,
        orderLineId: content.orderLineId,
        quantity: parsed.data,
        lotNumber: content.lotNumber ?? undefined,
        serialNumber: content.serialNumber ?? undefined,
        scanId,
      },
      {
        onSuccess: onClose,
        onError: (e) => {
          setServerError(packingErrorMessage(e));
          if (!isRetryablePackingError(e)) setScanId(crypto.randomUUID());
        },
      },
    );
  };

  return (
    <FormDialog open onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title={R.title}
        description={R.description(content.sku, pkg.packageNo)}
        submitLabel={R.submit}
        canSubmit
        isPending={remove.isPending}
        error={serverError}
        onSubmit={submit}
        onCancel={onClose}
      >
        <div>
          <Label htmlFor="remove-quantity" className="text-[0.8125rem]">
            {R.quantity}
          </Label>
          <Input
            id="remove-quantity"
            autoFocus
            inputMode="numeric"
            value={quantity}
            disabled={serial}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setQuantity(event.target.value);
              setError(undefined);
              setServerError(null);
              // Số lượng khác = lần bớt khác: không dùng lại id của lần gửi trước
              setScanId(crypto.randomUUID());
            }}
            className={`${fieldClass(!!error)} ${MONO}`}
          />
          <FieldError>{error}</FieldError>
        </div>
      </FormDialogBody>
    </FormDialog>
  );
}
