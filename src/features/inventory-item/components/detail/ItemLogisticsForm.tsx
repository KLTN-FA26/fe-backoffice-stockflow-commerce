"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { CheckboxField } from "@/components/shared/CheckboxField";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { useSaveItemLogistics } from "../../mutations";
import { logisticsFormSchema } from "../../schemas";
import { logisticsToForm } from "../../selectors";
import { Field } from "./Field";
import { ItemOutdatedNotice } from "./ItemOutdatedNotice";
import { useItemSubmitHandlers } from "./useItemSubmitHandlers";

import type { InventoryItem, LogisticsFormValues } from "../../types";

const L = UI_LABELS.inventoryItem;
const F = L.field;

const toValues = (i: InventoryItem) => logisticsToForm(i.logistics);

/** Popup sửa logistics (BE `PUT .../logistics`, gửi `version`). UI-only — Backend phải re-check. */
export function ItemLogisticsForm({ item, onDone }: { item: InventoryItem; onDone: () => void }) {
  const form = useForm<LogisticsFormValues>({
    resolver: zodResolver(logisticsFormSchema),
    mode: "onChange",
    defaultValues: toValues(item),
  });
  const save = useSaveItemLogistics();
  const handlers = useItemSubmitHandlers({
    item,
    form,
    context: "logistics",
    onDone,
    toValues,
  });
  const { errors, isValid } = form.formState;
  const uom = form.register("unitOfMeasure");

  const submit = form.handleSubmit((values) => {
    handlers.clearError();
    save.mutate(
      { id: item.id, version: handlers.baseVersion, values },
      { onSuccess: handlers.onSuccess, onError: handlers.onError },
    );
  });

  return (
    <FormDialogBody
      title={`${L.editLogistics} · ${item.sku}`}
      description={L.logisticsDialogDescription}
      submitLabel={save.isPending ? L.saving : L.saveLogistics}
      canSubmit={isValid}
      isPending={save.isPending}
      error={handlers.error}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <DialogScrollArea>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${F.unitOfMeasure} *`} id="lg-uom" error={errors.unitOfMeasure?.message}>
            <Input
              id="lg-uom"
              aria-invalid={Boolean(errors.unitOfMeasure)}
              {...uom}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase();
                void uom.onChange(e);
              }}
              className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
            />
          </Field>
          <Field label={F.barcode} id="lg-barcode" error={errors.barcode?.message}>
            <Input id="lg-barcode" {...form.register("barcode")} className={FORM_INPUT_CLASS} />
          </Field>
        </div>
        <CheckboxField control={form.control} name="rotatable" label={F.rotatable} />
      </DialogScrollArea>
      <ItemOutdatedNotice outdated={handlers.outdated} />
    </FormDialogBody>
  );
}
