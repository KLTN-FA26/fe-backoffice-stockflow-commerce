"use client";

import { useWatch } from "react-hook-form";
import { LoaderCircle, Send } from "lucide-react";

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";
import { formatDecimal } from "@/lib/format";
import { useCan } from "@/lib/auth";
import { useCustomerRef } from "@/lib/references/customer-lookup";
import { linePriceVerdict } from "@/features/quote/selectors";
import { FORM_BAR_ACTION_CLASS } from "@/components/backoffice/FormBottomBar";
import { Card } from "@/components/shared/Card";
import { DiscardChangesButton } from "@/components/shared/DiscardChangesButton";
import { Button } from "@/components/ui/button";

import { LinePriceVerdictChip } from "./LinePriceVerdict";
import { QuoteTotalsPreview } from "./QuoteTotalsPreview";
import { skuLabel } from "./QuoteSkuField";
import { usePriceReferences } from "./usePriceReferences";

import type { UseFormReturn } from "react-hook-form";
import type { LinePriceVerdict } from "@/features/quote/selectors";
import type { CustomerSku, Quote, QuoteFormValues, QuoteTier } from "@/features/quote/types";

const S = QUOTE_FORM_LABELS.summary;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

function toTiers(values: QuoteFormValues["lines"][number]["tiers"] | undefined): QuoteTier[] {
  return (values ?? [])
    .map((tier) => ({ minQuantity: Number(tier.minQuantity), unitPrice: Number(tier.unitPrice) }))
    .filter((tier) => tier.minQuantity > 0 && tier.unitPrice > 0);
}

/** Khách của báo giá: tên, MST (khi xem được khách), mã khách (BE trả trên báo giá đã lưu). */
function CustomerCard({ customerId, quote }: { customerId: string; quote?: Quote }) {
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const ref = useCustomerRef(customerId, canRead);
  const name = ref.data?.fullName ?? quote?.customerName ?? null;
  const facts = [
    ref.data?.taxCode ? S.taxCode(ref.data.taxCode) : null,
    quote?.customerCode ? S.customerCode(quote.customerCode) : null,
  ].filter((fact): fact is string => fact !== null);
  if (!name && facts.length === 0) return null;
  return (
    <Card className="space-y-1">
      <h2 className="text-ink-secondary text-xs font-medium">{S.customer}</h2>
      {name && <p className="text-ink-primary text-sm font-semibold break-words">{name}</p>}
      {facts.length > 0 && <p className="text-ink-secondary text-xs">{facts.join(" · ")}</p>}
    </Card>
  );
}

/**
 * Kiểm tra giá từng dòng, cập nhật khi gõ (14 BR-10, xem trước của BE `QuotePriceCheck`): dòng cần duyệt lên đầu; tất cả
 * đạt thì một dòng tóm tắt "n/n dòng đạt giá".
 */
function PriceCheckCard({
  rows,
  thresholdPercent,
}: {
  rows: readonly { lineNo: number; sku: string; name: string | null; verdict: LinePriceVerdict }[];
  thresholdPercent: number;
}) {
  const ok = rows.filter((row) => row.verdict === "ok").length;
  const flagged = rows.filter(
    (row) => row.verdict === "needsApproval" || row.verdict === "noPrice",
  ).length;
  const rank = (verdict: LinePriceVerdict) =>
    verdict === "needsApproval" ? 0 : verdict === "noPrice" ? 1 : verdict === "unknown" ? 2 : 3;
  const sorted = [...rows].sort((a, b) => rank(a.verdict) - rank(b.verdict) || a.lineNo - b.lineNo);
  return (
    <Card className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">{S.checkTitle}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{S.noLines}</p>
      ) : (
        <>
          <p
            aria-live="polite"
            className={`text-[0.8125rem] font-medium ${
              flagged > 0
                ? "text-warning-ink"
                : ok === rows.length
                  ? "text-positive-ink"
                  : "text-ink-secondary"
            }`}
          >
            {flagged > 0
              ? S.needsApproval(flagged)
              : ok === rows.length
                ? S.allOk(ok, rows.length)
                : S.pending}
          </p>
          {/* Tất cả đạt: chỉ tóm tắt; có dòng cần chú ý: liệt kê, dòng cần duyệt trước (bo-09). */}
          {ok < rows.length && (
            <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
              {sorted.map((row) => (
                <li key={row.lineNo} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="text-ink-primary block truncate">
                      {row.lineNo}. {row.name ?? row.sku}
                    </span>
                    {row.name && (
                      <span className={`text-ink-tertiary block truncate text-xs ${MONO}`}>
                        {row.sku}
                      </span>
                    )}
                  </span>
                  <LinePriceVerdictChip verdict={row.verdict} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="text-ink-tertiary text-xs">{S.threshold(formatDecimal(thresholdPercent, 2))}</p>
    </Card>
  );
}

/**
 * Khung tóm tắt dính bên phải form báo giá (bo-10 / bo-13; mẫu: trang báo giá của cổng khách): khách, tạm tính (tiền
 * hàng, phí, thuế, tổng), kiểm tra giá từng dòng, và các nút Lưu nháp / Lưu và gửi. Số chính thức do BE tính khi lưu.
 */
export function QuoteSummaryPanel({
  form,
  customerId,
  quote,
  customerSkus,
  thresholdPercent,
  pending,
  stale,
  canSend,
  onSend,
  onDiscard,
}: {
  form: UseFormReturn<QuoteFormValues>;
  customerId: string;
  quote?: Quote;
  customerSkus: readonly CustomerSku[];
  thresholdPercent: number;
  pending: boolean;
  stale: boolean;
  /** Người dùng được gửi báo giá (`sales-quotes:UPDATE`, UI-only). */
  canSend: boolean;
  onSend: () => void;
  onDiscard: () => void;
}) {
  const lines = useWatch({ control: form.control, name: "lines" });
  const lineSkus = (lines ?? []).map((line) => line.sku);
  const references = usePriceReferences(customerId, lineSkus, customerSkus);
  const bySku = new Map(customerSkus.map((sku) => [sku.sku.trim().toUpperCase(), sku]));
  const rows = (lines ?? []).flatMap((line, index) => {
    const sku = line.sku?.trim().toUpperCase() ?? "";
    if (!sku) return [];
    const option = bySku.get(sku);
    const name = option ? skuLabel(option) : null;
    return [
      {
        lineNo: index + 1,
        sku,
        name: name && name !== sku ? name : null,
        verdict: linePriceVerdict(
          toTiers(line.tiers),
          references[index] ?? { own: undefined, standard: undefined },
          thresholdPercent,
        ),
      },
    ];
  });
  const needsApproval = rows.some((row) => row.verdict === "needsApproval");

  return (
    <div className="space-y-3">
      {customerId && <CustomerCard customerId={customerId} quote={quote} />}
      {customerId && customerSkus.length > 0 && (
        <>
          <QuoteTotalsPreview
            form={form}
            quote={quote}
            customerSkus={customerSkus}
            references={references}
          />
          <PriceCheckCard rows={rows} thresholdPercent={thresholdPercent} />
        </>
      )}
      <Card className="space-y-2">
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={pending || stale}
            className={`${FORM_BAR_ACTION_CLASS.primary} w-full justify-center`}
          >
            {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
            {quote ? "Lưu báo giá" : "Lưu nháp"}
          </Button>
          {canSend && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || stale}
              onClick={onSend}
              aria-describedby="quote-save-send-hint"
              className={`${FORM_BAR_ACTION_CLASS.outline} w-full justify-center gap-1.5`}
            >
              <Send className="size-3.5" aria-hidden="true" />
              {needsApproval ? S.saveAndSendForApproval : S.saveAndSend}
            </Button>
          )}
          <DiscardChangesButton
            dirty={form.formState.isDirty}
            onDiscard={onDiscard}
            size="sm"
            className={`${FORM_BAR_ACTION_CLASS.outline} w-full justify-center`}
          />
        </div>
        {canSend && (
          <p id="quote-save-send-hint" className="text-ink-tertiary text-xs">
            {S.saveAndSendHint}
          </p>
        )}
        <p className="text-ink-tertiary text-xs">{S.note}</p>
      </Card>
    </div>
  );
}
