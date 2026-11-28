"use client";

import { WandSparkles } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";
import { formatMoney } from "@/lib/format/money";
import { lineAmount } from "@/features/quote/selectors";
import { Button } from "@/components/ui/button";

import type { LinePriceSuggestion } from "./useLinePriceSuggestion";

const NUM = "tabular-nums font-[family-name:var(--font-mono)]";

/**
 * MOQ + giá gợi ý: giá riêng của khách (`GET /catalog/customer-prices/{customerId}/{sku}`), không có thì giá chuẩn của
 * quy cách (`GET /catalog/standard-prices/{sku}`, 13 BR-04 sửa ngày 2026-11-26). Nguồn ghi rõ trên nút.
 */
export function SuggestionBar({
  sku,
  moq,
  cartons,
  suggestion,
  loading,
  failed,
  tiersEmpty,
  onUse,
}: {
  sku: string | undefined;
  moq: number | null;
  cartons: number;
  suggestion: LinePriceSuggestion | null;
  loading: boolean;
  failed: boolean;
  tiersEmpty: boolean;
  onUse: (tiers: { minQuantity: string; unitPrice: string }[]) => void;
}) {
  return (
    // Cột hẹp cạnh bảng bậc giá (màn rộng), xếp dọc: MOQ → giá gợi ý → câu nhắc.
    <div className="bg-bg-subtle flex flex-col items-start gap-2 rounded-(--r-md) p-3 text-[0.8125rem]">
      <span className="text-ink-secondary">
        {QUOTE_FORM_LABELS.minCartons.label}:{" "}
        {moq == null ? (
          <span className="text-ink-tertiary">{QUOTE_FORM_LABELS.minCartons.none}</span>
        ) : (
          <>
            <strong className={`text-ink-primary ${NUM}`}>{moq}</strong>{" "}
            {QUOTE_FORM_LABELS.minCartons.unit}
          </>
        )}
      </span>
      {loading && <span className="text-ink-tertiary">Đang tải giá gợi ý…</span>}
      {sku && !loading && !suggestion && !failed && (
        <span className="text-warning-ink">
          Chưa có giá riêng của khách lẫn giá chuẩn cho SKU này — nhập bậc giá.
        </span>
      )}
      {failed && <span className="text-danger">Không tải được giá gợi ý.</span>}
      {suggestion && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onUse(
              suggestion.tiers.map((tier) => ({
                minQuantity: String(tier.minQuantity),
                unitPrice: String(tier.unitPrice),
              })),
            )
          }
        >
          <WandSparkles className="size-3.5" />
          {`Dùng giá gợi ý (${QUOTE_PRICE_REVIEW_LABELS.source[suggestion.source].toLowerCase()})`}
        </Button>
      )}
      {suggestion && tiersEmpty && (
        // BE chỉ tự lấy giá gợi ý khi số thùng đạt MOQ; dưới MOQ phải nhập bậc giá đã thoả thuận.
        <span
          className={moq && cartons > 0 && cartons < moq ? "text-warning-ink" : "text-ink-tertiary"}
        >
          {moq && cartons > 0 && cartons < moq
            ? `Dưới mức tối thiểu ${moq} thùng của bảng giá — cần nhập bậc giá.`
            : suggestion.source === "CUSTOMER_PRICE"
              ? "Để trống bậc giá = dùng giá riêng của khách."
              : "Để trống bậc giá = dùng giá chuẩn của quy cách."}
        </span>
      )}
    </div>
  );
}

/** Tạm tính một dòng: thành tiền = thùng × cái/thùng × đơn giá theo bậc (số chốt do BE tính). */
export function LinePreview({
  cartons,
  moq,
  unitPrice,
  unitsPerCarton,
}: {
  cartons: number;
  moq: number | null;
  unitPrice: number | null;
  unitsPerCarton: number | null;
}) {
  return (
    <p className="text-ink-secondary text-[0.8125rem]" aria-live="polite">
      Tạm tính:{" "}
      {unitPrice == null ? (
        <span className="text-ink-tertiary">
          {moq && cartons > 0 && cartons < moq
            ? `dưới mức tối thiểu ${moq} thùng`
            : "chưa đủ dữ liệu"}
        </span>
      ) : (
        <>
          đơn giá <span className={NUM}>{formatMoney(unitPrice, "VND")}</span>/cái
          {unitsPerCarton ? (
            <>
              {" "}
              · thành tiền{" "}
              <span className={`text-ink-primary font-semibold ${NUM}`}>
                {formatMoney(lineAmount(cartons, unitsPerCarton, unitPrice), "VND")}
              </span>
            </>
          ) : null}
        </>
      )}
    </p>
  );
}
