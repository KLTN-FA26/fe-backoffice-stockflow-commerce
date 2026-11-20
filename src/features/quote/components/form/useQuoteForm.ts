"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { QUOTE_EDIT_LOCK_MESSAGE, quoteErrorMessage } from "@/features/quote/errors";
import { emptyQuoteForm, toQuoteFormValues } from "@/features/quote/form-body";
import { quoteFormSchema } from "@/features/quote/form-schemas";
import { useCreateQuote, useUpdateQuote } from "@/features/quote/mutations";

import type { Path } from "react-hook-form";
import type { Quote, QuoteFormOutput, QuoteFormValues } from "@/features/quote/types";

/** `lines[2].cartons` (BE) → `lines.2.cartons` (react-hook-form). */
export function toFormPath(field: string): string {
  return field.replace(/\[(\d+)\]/g, ".$1");
}

/** `fees[i]` của BE trỏ vào body đã gửi: phí khuôn trước, phí vận chuyển cuối (form-body.ts). */
function feeFieldPath(field: string, values: QuoteFormValues): string | null {
  const match = /^fees\[(\d+)\](?:\.(\w+))?$/.exec(field);
  if (!match) return null;
  const index = Number(match[1]);
  return index < values.plateFees.length ? `plateFees.${index}.amount` : "shippingFee";
}

const FIELD_BY_CODE: Readonly<Record<string, Path<QuoteFormValues>>> = {
  CUSTOMER_NOT_ACTIVE: "customerId",
};

export function useQuoteForm({
  quote,
  initialCustomerId,
}: {
  quote?: Quote;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  // Giữ nguyên khi bấm lại → BE trả cùng báo giá (idempotent theo requestId).
  const [requestId] = useState(() => crypto.randomUUID());
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<QuoteFormValues, unknown, QuoteFormOutput>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: quote ? toQuoteFormValues(quote) : emptyQuoteForm(initialCustomerId),
    mode: "onTouched",
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const create = useCreateQuote();
  const update = useUpdateQuote();
  // Version của bản mà các ô đang hiển thị. `quote` là prop sống: đổi tab thì query tải lại và `quote.version` đổi, còn các
  // ô vẫn là bản cũ. Gửi version sống kèm giá trị cũ sẽ ghi đè bản mới mà BE không báo 409 (WF-02 N2), nên chỉ gửi
  // `baseVersion` và chờ Sale bấm "Tải lại theo bản mới".
  const [baseVersion, setBaseVersion] = useState(quote?.version);
  const stale = !!quote && quote.version !== baseVersion;
  const reload = () => {
    if (!quote) return;
    form.reset(toQuoteFormValues(quote));
    setBaseVersion(quote.version);
    setFormError(null);
  };
  const pending = create.isPending || update.isPending;
  useUnsavedChangesWarning(form.formState.isDirty && !create.isSuccess && !update.isSuccess);

  const onError = (error: unknown) => {
    const lock = error instanceof ApiError && error.code === "OPTIMISTIC_LOCK";
    const message = lock ? QUOTE_EDIT_LOCK_MESSAGE : quoteErrorMessage(error);
    const field = error instanceof ApiError ? FIELD_BY_CODE[error.code] : undefined;
    if (field) form.setError(field, { type: "server", message });
    // 409 QUOTE_BELOW_MOQ: `details.lineNo` (từ 1) → ô số thùng của dòng đó (WF-02 mục 24 / N8).
    const lineNo =
      error instanceof ApiError && error.code === "QUOTE_BELOW_MOQ"
        ? Number(error.details?.lineNo)
        : NaN;
    const belowMoq =
      Number.isInteger(lineNo) && lineNo >= 1 && lineNo <= form.getValues("lines").length;
    if (belowMoq) {
      form.setError(`lines.${lineNo - 1}.cartons`, { type: "server", message });
      return;
    }
    const fieldErrors = error instanceof ApiError ? Object.entries(error.fieldErrors ?? {}) : [];
    for (const [name, fieldMessage] of fieldErrors) {
      const path = feeFieldPath(name, form.getValues()) ?? toFormPath(name);
      form.setError(path as Path<QuoteFormValues>, { type: "server", message: fieldMessage });
    }
    if (!field) setFormError(message);
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    const onSuccess = (saved: Quote) => router.replace(ADMIN_ROUTES.quotes.detail(saved.id));
    if (quote)
      update.mutate(
        { id: quote.id, version: baseVersion ?? quote.version, values },
        { onSuccess, onError },
      );
    else create.mutate({ requestId, values }, { onSuccess, onError });
  });

  return { form, lines, customerId, pending, submit, formError, stale, reload };
}
