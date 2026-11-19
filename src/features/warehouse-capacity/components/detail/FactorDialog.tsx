"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { isStaleApiError } from "@/lib/api/error-message";

import { capacityErrorMessage } from "@/features/warehouse-capacity/errors";
import { useUpdateUtilizationFactor } from "@/features/warehouse-capacity/mutations";
import { useFactorWarehouse } from "@/features/warehouse-capacity/queries";
import { factorFromPercent, utilizationFactorInput } from "@/features/warehouse-capacity/schemas";
import { factorPercentText } from "@/features/warehouse-capacity/selectors";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { FactorWarehouse, UtilizationFactorInput } from "@/features/warehouse-capacity/types";

const D = UI_LABELS.warehouseCapacity.factorDialog;
const FIELD_ID = "capacity-factor";

function FactorForm({
  warehouse,
  onReload,
  onClose,
}: {
  warehouse: FactorWarehouse;
  onReload: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<UtilizationFactorInput>({
    resolver: zodResolver(utilizationFactorInput),
    mode: "onChange",
    // Kho cũ chưa có hệ số → mặc định 100% (docs 06 §4.6 bước 2)
    defaultValues: { factorPercent: factorPercentText(warehouse.utilizationFactor ?? 1) },
  });
  const message = form.formState.errors.factorPercent?.message;
  const update = useUpdateUtilizationFactor();

  const submit = form.handleSubmit(({ factorPercent }) => {
    setError(null);
    update.mutate(
      { warehouse, utilizationFactor: factorFromPercent(factorPercent) },
      {
        onSuccess: onClose,
        onError: (failure) => {
          // Kho vừa bị sửa ở nơi khác → tải lại bản kho (version mới), giữ số đã nhập
          if (isStaleApiError(failure)) onReload();
          setError(capacityErrorMessage(failure));
        },
      },
    );
  });

  return (
    <FormDialogBody
      title={D.title}
      description={D.description}
      submitLabel={D.submit}
      canSubmit={form.formState.isValid}
      isPending={update.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <FormField id={FIELD_ID} label={D.field} required error={message} hint={D.hint}>
        <Input
          {...form.register("factorPercent")}
          {...fieldA11y(FIELD_ID, message, true)}
          inputMode="decimal"
          autoFocus
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] tabular-nums`}
        />
      </FormField>
    </FormDialogBody>
  );
}

/**
 * Sửa hệ số sử dụng của kho (docs 06 §4.6 bước 2, C43). Mở ra mới đọc bản kho mới nhất để gửi lại đủ trường +
 * `version` (`PUT /warehouses/{id}` thay toàn bộ). UI-only — Backend phải re-check warehouse-warehouses:UPDATE.
 */
export function FactorDialog({
  warehouseId,
  open,
  onOpenChange,
}: {
  warehouseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const warehouse = useFactorWarehouse(warehouseId, open);
  const close = () => onOpenChange(false);
  let body;
  if (warehouse.data) {
    body = (
      <FactorForm
        warehouse={warehouse.data}
        onReload={() => void warehouse.refetch()}
        onClose={close}
      />
    );
  } else {
    body = (
      <FormDialogBody
        title={D.title}
        description={warehouse.isError ? D.loadFailed : D.loading}
        submitLabel={D.submit}
        canSubmit={false}
        isPending={false}
        error={null}
        onSubmit={() => undefined}
        onCancel={close}
      />
    );
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && body}
    </FormDialog>
  );
}
