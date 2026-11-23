"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { EMPTY_LINE } from "@/features/quote/form-body";
import { useCustomerSkus } from "@/features/quote/queries";
import { FORM_BAR_ACTION_CLASS, FormBottomBar } from "@/components/backoffice/FormBottomBar";
import { DiscardChangesButton } from "@/components/shared/DiscardChangesButton";
import { FormErrorNotice } from "@/components/shared/FormErrorNotice";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { ChangeRequestNotice } from "./detail/QuoteNotices";
import { QuoteFeesEditor } from "./form/QuoteFeesEditor";
import { QuoteGeneralFields } from "./form/QuoteGeneralFields";
import { QuoteLineEditor } from "./form/QuoteLineEditor";
import { QuoteTotalsPreview } from "./form/QuoteTotalsPreview";
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
  const router = useRouter();
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
  // R5-4: cái/thùng của SKU riêng (khi BE trả) cho dòng chưa lưu; dòng đã lưu dùng số BE ghi trên dòng.
  const unitsPerCartonOf = (sku: string) =>
    perCarton.get(sku) ?? skus.find((option) => option.sku === sku)?.unitsPerCarton ?? null;
  const backHref = quote ? ADMIN_ROUTES.quotes.detail(quote.id) : ADMIN_ROUTES.quotes.list;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{quote ? `Sửa báo giá ${quote.quoteNumber}` : "Tạo báo giá"}</h1>
      <form
        onSubmit={(event) => void q.submit(event)}
        noValidate
        className="max-w-6xl space-y-4 pb-24"
      >
        {quote?.status === "DRAFT" && <ChangeRequestNotice history={quote.history} />}
        {q.stale && (
          <Notice tone="warning" live>
            <span>
              Báo giá vừa được người khác lưu (bản mới). Thay đổi của bạn chưa được lưu.{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={q.reload}
              >
                Tải lại theo bản mới
              </Button>
            </span>
          </Notice>
        )}
        <FormErrorNotice message={q.formError} />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            <QuoteGeneralFields form={form} customerLocked={!!quote} />
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
              <section aria-label="Các dòng báo giá" className="space-y-3">
                {q.lines.fields.map((field, index) => (
                  <QuoteLineEditor
                    key={field.id}
                    form={form}
                    index={index}
                    customerId={q.customerId}
                    skus={skus}
                    unitsPerCarton={unitsPerCartonOf(form.getValues(`lines.${index}.sku`))}
                    canRemove={q.lines.fields.length > 1}
                    onRemove={() => q.lines.remove(index)}
                  />
                ))}
                {errors.lines?.root?.message && (
                  <p className="text-danger text-xs" role="alert">
                    {errors.lines.root.message}
                  </p>
                )}
                {/* BO-UX-15: thêm dòng ngay dưới các dòng, không nằm sau phí và tổng. */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={q.lines.fields.length >= 50}
                  onClick={() => q.lines.append(EMPTY_LINE)}
                  className={FORM_BAR_ACTION_CLASS.outline}
                >
                  <Plus className="size-3.5" /> Thêm dòng
                </Button>
              </section>
            )}
            {q.customerId && <QuoteFeesEditor form={form} />}
          </div>
          {q.customerId && skus.length > 0 && (
            <aside aria-label="Tạm tính" className="lg:sticky lg:top-4">
              <QuoteTotalsPreview
                form={form}
                customerId={q.customerId}
                quote={quote}
                customerSkus={skus}
              />
            </aside>
          )}
        </div>

        <FormBottomBar note="Giá cuối cùng do hệ thống tính khi lưu; số trên form chỉ để xem trước.">
          <DiscardChangesButton
            dirty={form.formState.isDirty}
            onDiscard={() => router.push(backHref)}
            size="sm"
            className={FORM_BAR_ACTION_CLASS.outline}
          />
          <Button
            type="submit"
            size="sm"
            disabled={q.pending || q.stale}
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
