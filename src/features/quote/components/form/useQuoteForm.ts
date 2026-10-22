"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { allowedTermsOf, useCustomerCreditTerms } from "@/lib/references/customer-lookup";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { quoteErrorMessage } from "@/features/quote/errors";
import { useCreateQuote, useUpdateQuote } from "@/features/quote/mutations";
import { quoteFormSchema } from "@/features/quote/schemas";
import { blankUnits } from "@/features/quote/selectors";

import type { Path } from "react-hook-form";
import type { Quote, QuoteFormOutput, QuoteFormValues } from "@/features/quote/types";

export const EMPTY_LINE: QuoteFormValues["lines"][number] = {
  blankSku: "",
  designSnapshotId: "",
  printSpec: "",
  quantity: "",
  useListPrice: true,
  tiers: [],
};

function valuesOf(quote: Quote): QuoteFormValues {
  return {
    customerId: quote.customerId,
    paymentTerm: quote.paymentTerm,
    depositPercent: quote.depositPercent != null ? String(quote.depositPercent) : "",
    validUntil: new Date(quote.validUntil).toLocaleDateString("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
    }),
    terms: quote.terms ?? "",
    // Bậc giá đã chụp trên báo giá được giữ nguyên khi sửa (không tự đổi theo bảng giá mới).
    lines: quote.lines.map((line) => ({
      blankSku: line.blankSku,
      designSnapshotId: line.designSnapshotId,
      printSpec: line.printSpec ?? "",
      quantity: String(line.quantity),
      useListPrice: line.tiers.length === 0,
      tiers: line.tiers.map((tier) => ({
        minQuantity: String(tier.minQuantity),
        unitPrice: String(tier.unitPrice),
      })),
    })),
  };
}

/** `lines[2].blankSku` (BE) → `lines.2.blankSku` (react-hook-form). */
function toFormPath(field: string): string {
  return field.replace(/\[(\d+)\]/g, ".$1");
}

const FIELD_BY_CODE: Readonly<Record<string, Path<QuoteFormValues>>> = {
  PAYMENT_TERM_NOT_ALLOWED: "paymentTerm",
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
  const [requestId] = useState(() => crypto.randomUUID());
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<QuoteFormValues, unknown, QuoteFormOutput>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: quote
      ? valuesOf(quote)
      : {
          customerId: initialCustomerId ?? "",
          paymentTerm: "PREPAID",
          depositPercent: "",
          validUntil: "",
          terms: "",
          lines: [EMPTY_LINE],
        },
    mode: "onTouched",
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const [customerId, paymentTerm, watchedLines] = useWatch({
    control: form.control,
    name: ["customerId", "paymentTerm", "lines"],
  });
  const credit = useCustomerCreditTerms(customerId || undefined);
  const allowedTerms = useMemo(
    () => (credit.data ? allowedTermsOf(credit.data) : []),
    [credit.data],
  );

  // Đổi khách → điều khoản đang chọn không còn được phép thì về mặc định của khách (R1b).
  useEffect(() => {
    if (!credit.data || allowedTerms.includes(paymentTerm)) return;
    form.setValue("paymentTerm", credit.data.defaultPaymentTerm, { shouldValidate: true });
  }, [allowedTerms, credit.data, form, paymentTerm]);

  const units = blankUnits(
    (watchedLines ?? []).map((line) => ({
      blankSku: line.blankSku ?? "",
      quantity: Number(line.quantity),
    })),
  );
  const create = useCreateQuote();
  const update = useUpdateQuote();
  const pending = create.isPending || update.isPending;
  useUnsavedChangesWarning(form.formState.isDirty && !create.isSuccess && !update.isSuccess);

  const onError = (error: unknown) => {
    const field = error instanceof ApiError ? FIELD_BY_CODE[error.code] : undefined;
    if (field) form.setError(field, { type: "server", message: quoteErrorMessage(error) });
    const fieldErrors = error instanceof ApiError ? Object.entries(error.fieldErrors ?? {}) : [];
    for (const [name, message] of fieldErrors)
      form.setError(toFormPath(name) as Path<QuoteFormValues>, { type: "server", message });
    if (!field && fieldErrors.length === 0) setFormError(quoteErrorMessage(error));
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    const onSuccess = (saved: Quote) => router.replace(ADMIN_ROUTES.quotes.detail(saved.id));
    if (quote)
      update.mutate({ id: quote.id, version: quote.version, values }, { onSuccess, onError });
    else create.mutate({ requestId, values }, { onSuccess, onError });
  });

  return {
    form,
    lines,
    customerId,
    paymentTerm,
    allowedTerms,
    credit,
    units,
    pending,
    submit,
    formError,
  };
}
