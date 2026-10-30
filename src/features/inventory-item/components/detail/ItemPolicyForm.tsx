"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";
import { CheckboxField } from "@/components/shared/CheckboxField";

import { useSaveItemPolicy } from "../../mutations";
import { policyFormSchema } from "../../schemas";
import { policyToForm } from "../../selectors";
import { Field } from "./Field";
import { ItemOutdatedNotice } from "./ItemOutdatedNotice";
import { ItemPolicySelects } from "./ItemPolicySelects";
import { useItemSubmitHandlers } from "./useItemSubmitHandlers";

import type { InventoryItem, PolicyFormValues } from "../../types";

const L = UI_LABELS.inventoryItem;
const F = L.field;

const toValues = (i: InventoryItem) => policyToForm(i.policy);
const THRESHOLDS = ["reorderPoint", "safetyStock", "maxQty"] as const;
/** Luật chéo ô (superRefine) — đổi một ô thì kiểm lại các ô còn lại để lỗi hiện / mất đúng chỗ. */
const THRESHOLD_DEPS = Object.fromEntries(
  THRESHOLDS.map((n) => [n, THRESHOLDS.filter((o) => o !== n)]),
) as Record<(typeof THRESHOLDS)[number], (typeof THRESHOLDS)[number][]>;
const NUMBER_INPUT = `${FORM_INPUT_CLASS} text-right tabular-nums`;

/** Popup sửa chính sách tồn (BE PR #119 PUT .../policy); luật ở `policyFormSchema`. Backend phải re-check. */
export function ItemPolicyForm({ item, onDone }: { item: InventoryItem; onDone: () => void }) {
  const form = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    mode: "onChange",
    defaultValues: policyToForm(item.policy),
  });
  const save = useSaveItemPolicy();
  const expiryTracked = useWatch({ control: form.control, name: "expiryTracked" });
  const handlers = useItemSubmitHandlers({
    item,
    form,
    context: "policy",
    onDone,
    toValues,
    isRendered: (name) => expiryTracked || name !== "maxShelfLifeDays",
  });
  const { errors, isValid } = form.formState;
  // Luật hạn dùng phụ thuộc cách theo dõi + cách xuất kho → đổi một trong hai thì kiểm lại ô hạn dùng
  const revalidateExpiry = () => void form.trigger("expiryTracked");

  const submit = form.handleSubmit((values) => {
    handlers.clearError();
    save.mutate(
      { id: item.id, version: handlers.baseVersion, values },
      { onSuccess: handlers.onSuccess, onError: handlers.onError },
    );
  });

  return (
    <FormDialogBody
      title={`${L.editPolicy} · ${item.sku}`}
      description={L.policyDialogDescription}
      submitLabel={save.isPending ? L.saving : L.savePolicy}
      canSubmit={isValid}
      isPending={save.isPending}
      error={handlers.error}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <DialogScrollArea>
        <div className="grid grid-cols-3 gap-3">
          {THRESHOLDS.map((name) => (
            <Field
              key={name}
              label={F[name]}
              id={`pl-${name}`}
              hint={name === "maxQty" ? L.policy.maxQtyHint : undefined}
              error={errors[name]?.message}
            >
              <Input
                id={`pl-${name}`}
                inputMode="numeric"
                {...form.register(name, { deps: THRESHOLD_DEPS[name] })}
                className={NUMBER_INPUT}
              />
            </Field>
          ))}
        </div>
        <ItemPolicySelects form={form} onChange={revalidateExpiry} />
        <Field
          label={F.expiryTracked}
          id="pl-expiry"
          hint={expiryTracked ? L.expiryHint : undefined}
          error={errors.expiryTracked?.message}
        >
          <CheckboxField
            control={form.control}
            name="expiryTracked"
            id="pl-expiry"
            // Tắt theo dõi → xoá số ngày (ô bị ẩn); toPolicyRequest cũng gửi null
            onCheckedChange={(checked) => {
              if (!checked) form.setValue("maxShelfLifeDays", "", { shouldValidate: true });
            }}
          />
        </Field>
        {expiryTracked && (
          <Field label={F.maxShelfLifeDays} id="pl-shelf" error={errors.maxShelfLifeDays?.message}>
            <Input
              id="pl-shelf"
              inputMode="numeric"
              {...form.register("maxShelfLifeDays")}
              className={NUMBER_INPUT}
            />
          </Field>
        )}
      </DialogScrollArea>
      <ItemOutdatedNotice outdated={handlers.outdated} />
    </FormDialogBody>
  );
}
