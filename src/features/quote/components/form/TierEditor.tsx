"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { QUOTE_FORM_LABELS } from "@/constants/labels-quote-form";
import { formatDecimal } from "@/lib/format";
import { formatMoney } from "@/lib/format/money";
import { checkTierPrice } from "@/features/quote/selectors";
import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { PriceReferences, TierPriceVerdict } from "@/features/quote/selectors";
import type { QuoteFormValues } from "@/features/quote/types";

const T = QUOTE_FORM_LABELS.tiers;
const R = QUOTE_FORM_LABELS.reference;
const NUM = `${FORM_INPUT_CLASS} text-right font-[family-name:var(--font-mono)] tabular-nums`;
const TH = "text-ink-secondary px-1 pb-1 text-left text-xs font-medium";

/**
 * Giá tham chiếu ngay dưới ô đơn giá của một bậc (14 BR-10): Sale thấy trước khi gửi bậc nào sẽ phải chờ duyệt — xanh =
 * đạt, cam = cần Quản lý kinh doanh duyệt. Chưa đủ dữ liệu (đang tải, không xem được giá chuẩn) thì không hiện gì.
 */
function TierReferenceHint({ id, verdict }: { id: string; verdict: TierPriceVerdict }) {
  if (verdict.kind === "unknown") return null;
  if (verdict.kind === "noReference")
    return (
      <p id={id} className="text-warning-ink mt-1 text-xs">
        {R.noReference}
      </p>
    );
  const { discountPercent: diff } = verdict;
  const gap =
    diff > 0
      ? R.below(formatDecimal(diff, 2))
      : diff < 0
        ? R.above(formatDecimal(-diff, 2))
        : R.equal;
  const over = verdict.kind === "over";
  return (
    <p id={id} className={`mt-1 text-xs ${over ? "text-warning-ink" : "text-positive-ink"}`}>
      {R.label(
        formatMoney(verdict.referencePrice, "VND"),
        QUOTE_PRICE_REVIEW_LABELS.source[verdict.source],
      )}{" "}
      · <span className="font-medium">{gap}</span>
      {over && ` — ${R.needsApproval}`}
    </p>
  );
}

/**
 * Bậc giá của một dòng: từ N thùng trở lên → đơn giá VND / cái; bậc thấp nhất là MOQ (14 BR-08). Bảng có tiêu đề cột
 * hiện rõ (BO-UX-14) — điền xong vẫn biết ô nào là số thùng, ô nào là đơn giá; đơn giá nhập qua `MoneyInput` (BO-UX-4).
 */
export function TierEditor({
  lineIndex,
  control,
  register,
  errors,
  references,
  thresholdPercent,
}: {
  lineIndex: number;
  control: Control<QuoteFormValues>;
  register: UseFormRegister<QuoteFormValues>;
  errors?: FieldErrors<QuoteFormValues>["lines"];
  /** Giá tham chiếu của dòng (giá riêng / giá chuẩn) để hiện cạnh từng bậc. */
  references: PriceReferences;
  /** Ngưỡng duyệt giá (%), xem `QuoteForm`. */
  thresholdPercent: number;
}) {
  const tiers = useFieldArray({ control, name: `lines.${lineIndex}.tiers` });
  const values = useWatch({ control, name: `lines.${lineIndex}.tiers` });
  const verdictOf = (tierIndex: number): TierPriceVerdict => {
    const value = values?.[tierIndex];
    const minQuantity = Number(value?.minQuantity);
    const unitPrice = Number(value?.unitPrice);
    if (!(minQuantity > 0) || !(unitPrice > 0)) return { kind: "unknown" };
    return checkTierPrice({ minQuantity, unitPrice }, references, thresholdPercent);
  };
  const lineErrors = errors?.[lineIndex];
  const listError = lineErrors?.tiers?.root?.message ?? lineErrors?.tiers?.message;
  const captionId = `line-${lineIndex}-tiers-caption`;
  const moqHintId = `line-${lineIndex}-tiers-moq`;

  return (
    <div className="space-y-1.5">
      <p id={captionId} className="text-ink-secondary text-xs font-medium">
        Bậc giá
      </p>
      {tiers.fields.length > 0 && (
        <table aria-labelledby={captionId} className="w-full max-w-2xl border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${TH} w-40`}>
                {T.from}
              </th>
              <th scope="col" className={TH}>
                {T.unitPrice}
              </th>
              <th scope="col" className="w-9">
                <span className="sr-only">Xoá</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.fields.map((field, tierIndex) => {
              const tierErrors = lineErrors?.tiers?.[tierIndex];
              const minId = `line-${lineIndex}-tier-${tierIndex}-min`;
              const priceId = `line-${lineIndex}-tier-${tierIndex}-price`;
              const minError = tierErrors?.minQuantity?.message;
              const priceError = tierErrors?.unitPrice?.message;
              const verdict = verdictOf(tierIndex);
              const hintId = verdict.kind === "unknown" ? "" : `${priceId}-reference`;
              return (
                <tr key={field.id} className="align-top">
                  <td className="pr-2 pb-1.5">
                    <label htmlFor={minId} className="sr-only">
                      Từ số thùng (bậc {tierIndex + 1})
                    </label>
                    <div className="relative">
                      <Input
                        id={minId}
                        {...register(`lines.${lineIndex}.tiers.${tierIndex}.minQuantity`)}
                        inputMode="numeric"
                        aria-invalid={minError ? true : undefined}
                        aria-describedby={
                          [minError ? `${minId}-error` : "", tierIndex === 0 ? moqHintId : ""]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                        className={`${NUM} pr-14`}
                      />
                      <span
                        aria-hidden="true"
                        className="text-ink-secondary pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
                      >
                        thùng
                      </span>
                    </div>
                    {minError && (
                      <p id={`${minId}-error`} className="text-danger mt-1 text-xs">
                        {minError}
                      </p>
                    )}
                  </td>
                  <td className="pr-2 pb-1.5">
                    <label htmlFor={priceId} className="sr-only">
                      Đơn giá ₫ một cái (bậc {tierIndex + 1})
                    </label>
                    <Controller
                      control={control}
                      name={`lines.${lineIndex}.tiers.${tierIndex}.unitPrice`}
                      render={({ field: price }) => (
                        <MoneyInput
                          id={priceId}
                          name={price.name}
                          ref={price.ref}
                          value={price.value}
                          onChange={price.onChange}
                          onBlur={price.onBlur}
                          aria-invalid={priceError ? true : undefined}
                          aria-describedby={
                            [priceError ? `${priceId}-error` : "", hintId]
                              .filter(Boolean)
                              .join(" ") || undefined
                          }
                        />
                      )}
                    />
                    {priceError && (
                      <p id={`${priceId}-error`} className="text-danger mt-1 text-xs">
                        {priceError}
                      </p>
                    )}
                    <TierReferenceHint id={hintId} verdict={verdict} />
                  </td>
                  <td className="pb-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Xoá bậc giá ${tierIndex + 1}`}
                      onClick={() => tiers.remove(tierIndex)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Chú thích MOQ dưới cả bảng, không chen giữa hai hàng bậc giá (bo-10). */}
          <tfoot>
            <tr>
              <td colSpan={3} id={moqHintId} className="text-ink-tertiary px-1 text-xs">
                {T.firstIsMinimum}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {listError && (
        <p className="text-danger text-xs" role="alert">
          {listError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={tiers.fields.length >= 20}
        onClick={() => tiers.append({ minQuantity: "", unitPrice: "" })}
      >
        <Plus className="size-3.5" /> Thêm bậc giá
      </Button>
    </div>
  );
}
