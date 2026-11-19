"use client";

import Link from "next/link";
import { Controller } from "react-hook-form";
import { LoaderCircle, Plus } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { EMPTY_LINE } from "@/features/quote/form-body";
import { useCustomerSkus } from "@/features/quote/queries";
import { CustomerPicker } from "@/components/backoffice/CustomerPicker";
import { FORM_BAR_ACTION_CLASS, FormBottomBar } from "@/components/backoffice/FormBottomBar";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { QuoteFeesEditor } from "./form/QuoteFeesEditor";
import { QuoteLineEditor } from "./form/QuoteLineEditor";
import { useQuoteForm } from "./form/useQuoteForm";

import type { CustomerSku, Quote } from "@/features/quote/types";

/** Tạo / sửa báo giá nháp theo thùng. Giá cuối cùng do BE tính; FE chỉ xem trước. */
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
  const skusQuery = useCustomerSkus(q.customerId || undefined);
  // 14 BR-04: chỉ SKU riêng đang ACTIVE; giữ SKU đã có trên báo giá để không mất dòng khi sửa.
  const onQuote = new Set(quote?.lines.map((line) => line.sku) ?? []);
  const skus: CustomerSku[] = (skusQuery.data ?? []).filter(
    (sku) => sku.status === "ACTIVE" || onQuote.has(sku.sku),
  );
  const perCarton = new Map(quote?.lines.map((line) => [line.sku, line.unitsPerCarton]) ?? []);
  const backHref = quote ? ADMIN_ROUTES.quotes.detail(quote.id) : ADMIN_ROUTES.quotes.list;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{quote ? `Sửa báo giá ${quote.quoteNumber}` : "Tạo báo giá"}</h1>
      <form
        onSubmit={(event) => void q.submit(event)}
        noValidate
        className="max-w-5xl space-y-4 pb-24"
      >
        {q.formError && <Notice tone="danger">{q.formError}</Notice>}
        <Card className="grid gap-4 md:grid-cols-2">
          <h2 className="text-ink-primary text-sm font-semibold md:col-span-2">Thông tin chung</h2>
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
            id="quote-delivery"
            label="Ngày giao khách yêu cầu"
            error={errors.requestedDeliveryDate?.message}
            hint="Tuỳ chọn, không ở quá khứ."
          >
            <Input
              type="date"
              {...form.register("requestedDeliveryDate")}
              {...fieldA11y("quote-delivery", errors.requestedDeliveryDate?.message)}
              className={FORM_INPUT_CLASS}
            />
          </FormField>
          <FormField
            id="quote-terms"
            label="Điều khoản"
            error={errors.terms?.message}
            className="md:col-span-2"
          >
            <Textarea
              {...form.register("terms")}
              {...fieldA11y("quote-terms", errors.terms?.message)}
              rows={3}
              maxLength={2000}
            />
          </FormField>
        </Card>

        {!q.customerId ? (
          <p className="text-ink-tertiary text-[0.8125rem]">
            Chọn khách hàng trước để thêm dòng báo giá.
          </p>
        ) : skusQuery.isError ? (
          <Notice tone="danger">Không tải được SKU riêng của khách.</Notice>
        ) : !skusQuery.isPending && skus.length === 0 ? (
          <Notice tone="warning">
            Khách chưa có SKU riêng đang bán (SKU cấp khi thiết kế được duyệt).
          </Notice>
        ) : (
          q.lines.fields.map((field, index) => (
            <QuoteLineEditor
              key={field.id}
              form={form}
              index={index}
              customerId={q.customerId}
              skus={skus}
              unitsPerCarton={perCarton.get(form.getValues(`lines.${index}.sku`)) ?? null}
              canRemove={q.lines.fields.length > 1}
              onRemove={() => q.lines.remove(index)}
            />
          ))
        )}
        {errors.lines?.root?.message && (
          <p className="text-danger text-xs">{errors.lines.root.message}</p>
        )}
        {q.customerId && <QuoteFeesEditor form={form} />}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!q.customerId || q.lines.fields.length >= 50}
          onClick={() => q.lines.append(EMPTY_LINE)}
          className={FORM_BAR_ACTION_CLASS.outline}
        >
          <Plus className="size-3.5" /> Thêm dòng
        </Button>

        <FormBottomBar note="Giá cuối cùng do hệ thống tính khi lưu; số trên form chỉ để xem trước.">
          <Button asChild variant="outline" size="sm" className={FORM_BAR_ACTION_CLASS.outline}>
            <Link href={backHref}>Huỷ</Link>
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={q.pending}
            className={FORM_BAR_ACTION_CLASS.primary}
          >
            {q.pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
            {quote ? "Lưu báo giá" : "Lưu nháp"}
          </Button>
        </FormBottomBar>
      </form>
    </div>
  );
}
