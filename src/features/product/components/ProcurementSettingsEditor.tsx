import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";

import {
  fromProcurementDraft,
  PROCUREMENT_LABELS,
  procurementDraftSchema,
  toProcurementDraft,
} from "../procurement-settings/form-model";
import {
  invalidProcurementNumberFields,
  PROCUREMENT_NUMERIC_ERRORS,
} from "../procurement-settings/numeric-input";
import {
  readProcurementSupplierChoices,
  saveProcurementSettings,
} from "../procurement-settings/service";
import { ProcurementSupplierSelect } from "./ProcurementSupplierSelect";
import { ProcurementSupplierTable } from "./ProcurementSupplierTable";
import { ProductFormField } from "./ProductFormField";

import type { ProcurementDraft } from "../procurement-settings/form-model";
import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";

export function ProcurementSettingsEditor({
  settings,
  isMock,
  onCancel,
  onSaved,
}: {
  settings: SkuProcurementSettingsView;
  isMock: boolean;
  onCancel: () => void;
  onSaved: (settings: SkuProcurementSettingsView) => void;
}) {
  const choices = readProcurementSupplierChoices(isMock, settings);
  const form = useForm<ProcurementDraft>({
    resolver: zodResolver(procurementDraftSchema),
    defaultValues: toProcurementDraft(settings),
  });
  const { fields } = useFieldArray({ control: form.control, name: "suppliers" });
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const { errors, isSubmitting } = form.formState;
  async function submit(draft: ProcurementDraft) {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    try {
      onSaved(
        await saveProcurementSettings(fromProcurementDraft(draft, settings, choices), isMock),
      );
    } catch (failure: unknown) {
      setError(
        failure instanceof Error ? failure.message : "Không thể lưu dữ liệu minh hoạ. Hãy thử lại.",
      );
    } finally {
      saving.current = false;
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const invalid = invalidProcurementNumberFields(event.currentTarget);
        if (invalid.length > 0) {
          for (const name of invalid) {
            form.setError(name, {
              type: "validate",
              message: PROCUREMENT_NUMERIC_ERRORS.malformed,
            });
          }
          return;
        }
        void form.handleSubmit(submit)(event);
      }}
      noValidate
      aria-label="Chỉnh sửa cài đặt mua hàng"
      aria-busy={isSubmitting}
    >
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProductFormField
            label={PROCUREMENT_LABELS.defaultSupplier}
            htmlFor="procurement-default-supplier"
          >
            <ProcurementSupplierSelect
              choices={choices}
              id="procurement-default-supplier"
              {...form.register("defaultSupplierId")}
            />
          </ProductFormField>
        </div>
        <ProcurementSupplierTable
          settings={settings}
          editing={{
            register: form.register,
            errors,
            choices,
            rowKeys: fields.map((field) => field.id),
          }}
        />
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Huỷ
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {isSubmitting ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
