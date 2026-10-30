"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FormSelect } from "@/components/shared/FormSelect";
import {
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { CheckboxField } from "@/components/shared/CheckboxField";

import { useSaveItemLogistics } from "../../mutations";
import { logisticsFormSchema, STORAGE_CLASSES } from "../../schemas";
import { logisticsToForm } from "../../selectors";
import { Field } from "./Field";
import { ItemOutdatedNotice } from "./ItemOutdatedNotice";
import { LOGISTICS_MEASURES } from "./measure-fields";
import { useItemSubmitHandlers } from "./useItemSubmitHandlers";

import type { InventoryItem, LogisticsFormValues } from "../../types";

const L = UI_LABELS.inventoryItem;
const F = L.field;

const toValues = (i: InventoryItem) => logisticsToForm(i.logistics);
const CHECKS = ["qcRequired", "requiresAdultSignature", "rotatable"] as const;

/** Popup sửa logistics (BE PR #119 PUT .../logistics, gửi `version`). UI-only — Backend phải re-check. */
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
          {LOGISTICS_MEASURES.map((name) => (
            <Field key={name} label={F[name]} id={`lg-${name}`} error={errors[name]?.message}>
              <Input
                id={`lg-${name}`}
                type="number"
                min={0}
                step="any"
                {...form.register(name)}
                className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
              />
            </Field>
          ))}
          <Field label={`${F.storageClass} *`} id="lg-storage">
            <Controller
              control={form.control}
              name="storageClass"
              render={({ field }) => (
                <FormSelect value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="lg-storage" className={FORM_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <TitledSelectContent title={F.storageClass}>
                    {STORAGE_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {L.storageClass[c]}
                      </SelectItem>
                    ))}
                  </TitledSelectContent>
                </FormSelect>
              )}
            />
          </Field>
        </div>
        {CHECKS.map((name) => (
          <CheckboxField key={name} control={form.control} name={name} label={F[name]} />
        ))}
        <Field
          label={F.shippingRestrictionNote}
          id="lg-note"
          error={errors.shippingRestrictionNote?.message}
        >
          <Textarea
            id="lg-note"
            rows={2}
            {...form.register("shippingRestrictionNote")}
            className={FORM_TEXTAREA_CLASS}
          />
        </Field>
      </DialogScrollArea>
      <ItemOutdatedNotice outdated={handlers.outdated} />
    </FormDialogBody>
  );
}
