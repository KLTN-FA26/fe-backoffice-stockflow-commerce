"use client";

import { useRouter } from "next/navigation";
import { Plus, RotateCw } from "lucide-react";

import { ADMIN_ROUTES, QUOTE_PERMISSIONS } from "@/constants";
import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";
import { QUOTE_PRICE_APPROVAL_DEFAULT_PERCENT } from "@/constants/numbers";
import { useCan } from "@/lib/auth";
import { EMPTY_LINE } from "@/features/quote/form-body";
import { useCustomerSkus } from "@/features/quote/queries";
import { FORM_BAR_ACTION_CLASS } from "@/components/backoffice/FormBottomBar";
import { FormErrorNotice } from "@/components/shared/FormErrorNotice";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { ChangeRequestNotice } from "./detail/QuoteNotices";
import { QuoteFeesEditor } from "./form/QuoteFeesEditor";
import { QuoteGeneralFields } from "./form/QuoteGeneralFields";
import { QuoteLineEditor } from "./form/QuoteLineEditor";
import { QuoteSummaryPanel } from "./form/QuoteSummaryPanel";
import { useQuoteForm } from "./form/useQuoteForm";

import type { CustomerSku, Quote } from "@/features/quote/types";

const K = QUOTE_FORM_LABELS.skuLoad;

/**
 * Tạo / sửa báo giá nháp theo thùng. Giá cuối cùng do BE tính; FE chỉ xem trước.
 * Bố cục (bo-10 / bo-13): màn ≥ xl chia hai cột — trái là form (thông tin chung, các dòng, phí), phải là khung tóm tắt dính
 * (khách, tạm tính, kiểm tra giá từng dòng, nút lưu / gửi); màn hẹp hơn xếp một cột, khung tóm tắt ở cuối.
 */
export function QuoteForm({
  quote,
  initialCustomerId,
}: {
  quote?: Quote;
  initialCustomerId?: string;
}) {
  const router = useRouter();
  const canSend = useCan(QUOTE_PERMISSIONS.update);
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
  // BE: mỗi SKU chỉ một dòng — hết SKU của khách thì không thêm dòng được nữa. Đang tải danh sách thì chưa khoá.
  const noSkuLeft = !skusQuery.isPending && q.lines.fields.length >= skus.length;
  const backHref = quote ? ADMIN_ROUTES.quotes.detail(quote.id) : ADMIN_ROUTES.quotes.list;
  // Ngưỡng duyệt giá BE đã dùng cho bản nháp này; báo giá mới chưa có thì lấy mặc định của BE (chỉ để xem trước).
  const threshold =
    quote?.priceCheck?.thresholdPercent ??
    quote?.priceReview?.thresholdPercent ??
    QUOTE_PRICE_APPROVAL_DEFAULT_PERCENT;

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{quote ? `Sửa báo giá ${quote.quoteNumber}` : "Tạo báo giá"}</h1>
      <form onSubmit={(event) => void q.submit(event)} noValidate className="space-y-4 pb-8">
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
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <QuoteGeneralFields form={form} customerLocked={!!quote} />
            {!q.customerId ? (
              <p className="text-ink-tertiary text-[0.8125rem]">
                Chọn khách hàng trước để thêm dòng báo giá.
              </p>
            ) : skusQuery.isError ? (
              // bo-13: lỗi tải SKU riêng có nút Thử lại và bước tiếp theo, không chặn Sale ở một câu báo lỗi.
              <Notice tone="danger" live>
                <span>
                  {K.failed} {K.next}{" "}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-1 h-7 gap-1.5"
                    disabled={skusQuery.isFetching}
                    onClick={() => void skusQuery.refetch()}
                  >
                    <RotateCw
                      className={`size-3.5 ${skusQuery.isFetching ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    {K.retry}
                  </Button>
                </span>
              </Notice>
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
                    thresholdPercent={threshold}
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
                  disabled={q.lines.fields.length >= 50 || noSkuLeft}
                  aria-describedby={noSkuLeft ? "quote-add-line-hint" : undefined}
                  onClick={() => q.lines.append(EMPTY_LINE)}
                  className={FORM_BAR_ACTION_CLASS.outline}
                >
                  <Plus className="size-3.5" /> {QUOTE_FORM_LABELS.addLine.label}
                </Button>
                {/* R7: nút khoá thì nói vì sao ngay dưới nút, không chỉ trong chú thích khi rê chuột. */}
                {noSkuLeft && (
                  <p id="quote-add-line-hint" className="text-ink-secondary text-xs">
                    {QUOTE_FORM_LABELS.addLine.noSkuLeft}
                  </p>
                )}
              </section>
            )}
            {q.customerId && <QuoteFeesEditor form={form} />}
          </div>
          <aside aria-label={QUOTE_FORM_LABELS.summary.region} className="xl:sticky xl:top-4">
            <QuoteSummaryPanel
              form={form}
              customerId={q.customerId}
              quote={quote}
              customerSkus={skus}
              thresholdPercent={threshold}
              pending={q.pending}
              stale={q.stale}
              canSend={canSend}
              onSend={() => void q.submitAndSend()}
              onDiscard={() => router.push(backHref)}
            />
          </aside>
        </div>
      </form>
    </div>
  );
}
