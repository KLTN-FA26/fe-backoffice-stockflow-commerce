"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CheckboxField } from "@/components/shared/CheckboxField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useChatFailure, useCreateCannedResponse, useUpdateCannedResponse } from "../mutations";
import {
  CANNED_BODY_MAX,
  CANNED_CATEGORY_MAX,
  CANNED_TITLE_MAX,
  cannedResponseInputSchema,
} from "../schemas";

import type { CannedResponse, CannedResponseInput } from "../schemas";

/** Biến BE điền khi gửi (`CannedResponse.VARIABLES`); biến không có giá trị → để trống, tên lạ → giữ nguyên. */
const VARIABLES = [
  "customerName",
  "agentName",
  "quoteCode",
  "orderCode",
  "contractCode",
  "productionOrderCode",
  "invoiceCode",
  "designName",
] as const;

function CannedForm({
  editing,
  canShare,
  onClose,
}: {
  editing: CannedResponse | null;
  canShare: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const create = useCreateCannedResponse();
  const update = useUpdateCannedResponse();
  const describeError = useChatFailure();
  const form = useForm<CannedResponseInput>({
    resolver: zodResolver(cannedResponseInputSchema),
    defaultValues: {
      title: editing?.title ?? "",
      body: editing?.body ?? "",
      shortcut: editing?.shortcut ?? "",
      category: editing?.category ?? "",
      shared: editing?.shared ?? false,
    },
  });
  const { errors } = form.formState;
  const pending = create.isPending || update.isPending;

  const submit = form.handleSubmit((values) => {
    setError(null);
    const draft = {
      title: values.title,
      body: values.body,
      ...(values.shortcut ? { shortcut: values.shortcut } : {}),
      ...(values.category ? { category: values.category } : {}),
      // Mẫu dùng chung chỉ người giám sát ghi; người khác không gửi cờ này.
      // BE update ignores `shared` (ownerId is fixed at creation): only a create carries it.
      ...(canShare && !editing ? { shared: values.shared } : {}),
    };
    const callbacks = {
      onSuccess: onClose,
      onError: (failure: unknown) => setError(describeError(failure)),
    };
    if (editing) update.mutate({ id: editing.id, ...draft, version: editing.version }, callbacks);
    else create.mutate(draft, callbacks);
  });

  return (
    <FormDialogBody
      title={editing ? "Sửa câu trả lời mẫu" : "Thêm câu trả lời mẫu"}
      description="Câu mẫu hiện trong ô trả lời của hội thoại; biến trong ngoặc nhọn được điền theo hội thoại lúc gửi."
      submitLabel={editing ? "Lưu" : "Thêm"}
      canSubmit
      isPending={pending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <FormField id="canned-title" label="Tiêu đề" required error={errors.title?.message}>
        <Input
          {...form.register("title")}
          {...fieldA11y("canned-title", errors.title?.message)}
          maxLength={CANNED_TITLE_MAX}
          autoFocus
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField
        id="canned-body"
        label="Nội dung"
        required
        error={errors.body?.message}
        hint={
          <>
            Biến dùng được:{" "}
            {VARIABLES.map((name) => (
              <code key={name} className="mr-1 font-[family-name:var(--font-mono)]">
                {`{${name}}`}
              </code>
            ))}
          </>
        }
      >
        <Textarea
          {...form.register("body")}
          {...fieldA11y("canned-body", errors.body?.message, true)}
          rows={5}
          maxLength={CANNED_BODY_MAX}
        />
      </FormField>
      <FormField
        id="canned-shortcut"
        label="Phím tắt"
        error={errors.shortcut?.message}
        hint="Không bắt buộc. Chữ thường, số, '-' hoặc '_'."
      >
        <Input
          {...form.register("shortcut")}
          {...fieldA11y("canned-shortcut", errors.shortcut?.message, true)}
          maxLength={32}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      <FormField id="canned-category" label="Nhóm" error={errors.category?.message}>
        <Input
          {...form.register("category")}
          {...fieldA11y("canned-category", errors.category?.message)}
          maxLength={CANNED_CATEGORY_MAX}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      {canShare && !editing && (
        <CheckboxField
          control={form.control}
          name="shared"
          id="canned-shared"
          label="Dùng chung cho mọi Sale"
        />
      )}
    </FormDialogBody>
  );
}

/** Thêm / sửa câu trả lời mẫu. Form chỉ gắn khi mở nên mỗi lần mở là bản mới (kể cả `version`). */
export function CannedResponseDialog({
  open,
  editing,
  canShare,
  onOpenChange,
}: {
  open: boolean;
  /** `null` = thêm mới. */
  editing: CannedResponse | null;
  /** `chat-supervision:UPDATE`: chỉ người giám sát viết mẫu dùng chung (BE kiểm lại). */
  canShare: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CannedForm editing={editing} canShare={canShare} onClose={() => onOpenChange(false)} />
      )}
    </FormDialog>
  );
}
