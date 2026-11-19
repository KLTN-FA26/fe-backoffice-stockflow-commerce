"use client";

import { WandSparkles } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { lineAmount } from "@/features/quote/selectors";
import { Button } from "@/components/ui/button";

import type { CustomerPrice } from "@/features/quote/types";

const NUM = "tabular-nums font-[family-name:var(--font-mono)]";

/** MOQ + giá gợi ý (giá riêng của khách, `GET /catalog/customer-prices/{customerId}/{sku}`). */
export function SuggestionBar({
  sku,
  moq,
  suggestion,
  loading,
  failed,
  tiersEmpty,
  onUse,
}: {
  sku: string | undefined;
  moq: number | null;
  suggestion: CustomerPrice | null;
  loading: boolean;
  failed: boolean;
  tiersEmpty: boolean;
  onUse: (tiers: { minQuantity: string; unitPrice: string }[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
      <span className="text-ink-secondary">
        MOQ: <strong className={`text-ink-primary ${NUM}`}>{moq ?? "—"}</strong> thùng
      </span>
      {loading && <span className="text-ink-tertiary">Đang tải giá gợi ý…</span>}
      {sku && !loading && !suggestion && !failed && (
        <span className="text-warning">Khách chưa có giá riêng cho SKU này — nhập bậc giá.</span>
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
          <WandSparkles className="size-3.5" /> Dùng giá gợi ý
        </Button>
      )}
      {suggestion && tiersEmpty && (
        <span className="text-ink-tertiary">Để trống bậc giá = dùng giá riêng của khách.</span>
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
          {moq && cartons > 0 && cartons < moq ? `dưới MOQ ${moq} thùng` : "chưa đủ dữ liệu"}
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
