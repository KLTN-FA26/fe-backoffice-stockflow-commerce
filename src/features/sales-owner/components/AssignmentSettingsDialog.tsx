"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CheckboxField } from "@/components/shared/CheckboxField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { settingsErrorMessage } from "../errors";
import { assignmentSettingsInputSchema } from "../inputs";
import { useSaveAssignmentSettings } from "../mutations";

import type { AssignmentSettingsValues } from "../inputs";
import type { BoardRow } from "../selectors";

/**
 * Cài đặt phân công của một Sale (D13, giống "Pause assignment" / "Capacity" của Odoo): tạm dừng nhận khách mới, sức
 * chứa khách mới mỗi tháng. Chỉ ảnh hưởng gợi ý khi giao (§10.4) — quản lý vẫn giao tay được.
 */
export function AssignmentSettingsDialog({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const save = useSaveAssignmentSettings();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AssignmentSettingsValues>({
    resolver: zodResolver(assignmentSettingsInputSchema),
    defaultValues: {
      paused: row.paused,
      capacityPerMonth: row.capacityPerMonth == null ? "" : String(row.capacityPerMonth),
    },
  });
  const capacityError = form.formState.errors.capacityPerMonth?.message;
  const submit = form.handleSubmit((values) => {
    setError(null);
    save.mutate(
      {
        userId: row.userId,
        paused: values.paused,
        capacityPerMonth: values.capacityPerMonth === "" ? null : Number(values.capacityPerMonth),
      },
      { onSuccess: onClose, onError: (e) => setError(settingsErrorMessage(e)) },
    );
  });

  return (
    <FormDialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <FormDialogBody
        title="Cài đặt phân công"
        description={`${row.name}: tạm dừng nhận khách mới và sức chứa khách mới mỗi tháng — dùng để gợi ý người được giao.`}
        submitLabel="Lưu"
        canSubmit
        isPending={save.isPending}
        error={error}
        onSubmit={() => void submit()}
        onCancel={onClose}
      >
        <CheckboxField control={form.control} name="paused" label="Tạm dừng nhận khách mới" />
        <FormField
          id="settings-capacity"
          label="Sức chứa khách mới mỗi tháng"
          hint="Để trống = không giới hạn."
          error={capacityError}
        >
          <Input
            {...fieldA11y("settings-capacity", capacityError, true)}
            inputMode="numeric"
            autoComplete="off"
            className={`${FORM_INPUT_CLASS} tabular-nums`}
            {...form.register("capacityPerMonth")}
          />
        </FormField>
      </FormDialogBody>
    </FormDialog>
  );
}
