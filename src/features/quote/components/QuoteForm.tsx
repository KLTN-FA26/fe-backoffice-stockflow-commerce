"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";
import { ArrowLeft, LoaderCircle, Plus } from "lucide-react";

import { ADMIN_ROUTES, PAYMENT_TERM_LABELS } from "@/constants";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { QuoteLineEditor } from "./form/QuoteLineEditor";
import { EMPTY_LINE, useQuoteForm } from "./form/useQuoteForm";

import type { Quote } from "@/features/quote/types";

/** Tạo / sửa báo giá nháp. Giá cuối cùng do BE tính; FE chỉ xem trước. */
export function QuoteForm({
  quote,
  initialCustomerId,
}: {
  quote?: Quote;
  initialCustomerId?: string;
}) {
  const q = useQuoteForm({ quote, initialCustomerId });
  const { form } = q;
  const { errors } = form.formState;
  const backHref = quote ? ADMIN_ROUTES.quotes.detail(quote.id) : ADMIN_ROUTES.quotes.list;

  return (
    <>
      <PageHeader
        title={quote ? `Sửa báo giá ${quote.quoteNumber}` : "Tạo báo giá"}
        subtitle="Lưu thành nháp; gửi khách ở màn chi tiết sau khi kiểm tra giá từng dòng."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>
              <ArrowLeft className="size-3.5" /> Quay lại
            </Link>
          </Button>
        }
      />
      <form
        onSubmit={(event) => void q.submit(event)}
        noValidate
        className="max-w-5xl space-y-4 pb-16"
      >
        {q.formError && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]"
          >
            {q.formError}
          </div>
        )}
        <Card className="grid gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <CustomerPicker
                idPrefix="quote"
                value={field.value}
                onChange={field.onChange}
                error={errors.customerId?.message}
                locked={!!quote}
              />
            )}
          />
          <FormField
            id="quote-term"
            label="Điều khoản thanh toán"
            required
            error={errors.paymentTerm?.message}
            hint={
              q.customerId && q.credit.isError
                ? "Không đọc được điều khoản của khách — BE sẽ kiểm tra khi lưu."
                : "Chỉ các điều khoản đang được phép cho khách (BE kiểm lại khi gửi và khi khách chấp nhận)."
            }
          >
            <select
              {...form.register("paymentTerm")}
              {...fieldA11y("quote-term", errors.paymentTerm?.message, true)}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              {(q.allowedTerms.length ? q.allowedTerms : (["PREPAID"] as const)).map((term) => (
                <option key={term} value={term}>
                  {PAYMENT_TERM_LABELS[term]}
                </option>
              ))}
            </select>
          </FormField>
          {q.paymentTerm === "DEPOSIT" && (
            <FormField
              id="quote-deposit"
              label="Tỷ lệ cọc (%)"
              error={errors.depositPercent?.message}
              hint="Để trống = dùng tỷ lệ cọc đã thoả thuận trên hồ sơ khách."
            >
              <Input
                {...form.register("depositPercent")}
                {...fieldA11y("quote-deposit", errors.depositPercent?.message, true)}
                inputMode="decimal"
                className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
              />
            </FormField>
          )}
          <FormField
            id="quote-valid"
            label="Hiệu lực đến hết ngày"
            required
            error={errors.validUntil?.message}
          >
            <Input
              type="date"
              {...form.register("validUntil")}
              {...fieldA11y("quote-valid", errors.validUntil?.message)}
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <FormField
            id="quote-terms"
            label="Điều khoản khác"
            error={errors.terms?.message}
            className="md:col-span-2"
          >
            <Textarea
              {...form.register("terms")}
              {...fieldA11y("quote-terms", errors.terms?.message)}
              rows={3}
            />
          </FormField>
        </Card>

        {q.customerId ? (
          q.lines.fields.map((field, index) => (
            <QuoteLineEditor
              key={field.id}
              form={form}
              index={index}
              customerId={q.customerId}
              blankUnits={
                q.units.get(
                  (form.getValues(`lines.${index}.blankSku`) ?? "").trim().toUpperCase(),
                ) ?? 0
              }
              canRemove={q.lines.fields.length > 1}
              onRemove={() => q.lines.remove(index)}
            />
          ))
        ) : (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Chọn khách hàng trước để thêm dòng báo giá.
          </p>
        )}
        {errors.lines?.root?.message && (
          <p className="text-danger text-xs">{errors.lines.root.message}</p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!q.customerId || q.lines.fields.length >= 50}
            onClick={() => q.lines.append(EMPTY_LINE)}
          >
            <Plus className="size-3.5" /> Thêm dòng
          </Button>
          <Button type="submit" disabled={q.pending}>
            {q.pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {quote ? "Lưu báo giá" : "Lưu nháp"}
          </Button>
        </div>
      </form>
    </>
  );
}
