"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";

import { PO_LIMITS, UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass, normalizeSkuCode } from "./helpers";
import { PoLineFields } from "./PoLineFields";

import type { CreatePoWizard } from "./useCreateForm";

/** Một dòng hàng — mọi ô `register` vào react-hook-form, lỗi (client + server) hiện inline. */
export function PoLineCard({
  w,
  index,
  onRemove,
}: {
  w: CreatePoWizard;
  index: number;
  onRemove: () => void;
}) {
  const { register } = w.form;
  const line = w.values.lines[index];
  const errors = w.errors.lines?.[index];
  const sku = register(`lines.${index}.skuId`);
  const skuErrorId = `po-line-${index}-sku-error`;
  const descErrorId = `po-line-${index}-desc-error`;

  return (
    <div
      className={cn(
        "bg-bg-subtle rounded-[var(--r-sm)] border p-3",
        errors ? "border-danger/30" : "border-border-default",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-brand text-ink-inverse flex size-6 items-center justify-center rounded-full text-xs font-medium">
            {index + 1}
          </span>
          <div>
            <div className="text-ink-primary text-[0.8125rem] font-medium">
              Dòng hàng {index + 1}
            </div>
            <div className="text-ink-tertiary text-xs">
              {line?.skuId || UI_LABELS.purchaseOrder.skuMissing}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          className="border-danger/30 text-danger hover:bg-danger/10 flex size-8 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
          aria-label={`Xóa dòng hàng ${index + 1}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="grid gap-2.5">
        <div className="grid gap-2.5 sm:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <label className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium">
              SKU <span className="text-danger">*</span>
            </label>
            {/* TODO(SKU combobox): ô nhập TẠM vì BE chưa có API danh mục SKU (BR-01 /
                open-question C12) — BE chỉ có `GET /products/{id}/skus/{sku}/base-price`.
                Khi BE có API liệt kê SKU Active (lọc theo NCC nếu có), thay Input này bằng
                combobox chọn SKU, cùng kiểu `SupplierCombobox` (bọc bằng `Controller`):
                  1. Thêm query vào `lib/references` (không gọi chéo `features/product`).
                  2. Chọn SKU → điền `skuId` + `description`; vẫn KHÔNG tự điền đơn giá trừ khi
                     giá trả về cùng tiền tệ với PO (lỗi VND → $ cũ).
                  3. Bỏ `normalizeSkuCode` ở ô này (mã lấy từ danh mục, không gõ tay).
                Combobox cũ (dữ liệu mock) có ở git: `git show 16d63a2:src/features/purchase-order/components/create/SkuCombobox.tsx`.
                Hiện tại: nhập mã đúng định dạng BE `common.domain.Sku`. */}
            <Input
              {...sku}
              onChange={(e) => {
                // BE `common.domain.Sku` trim + upper-case — hiện đúng dạng sẽ lưu ngay khi gõ.
                e.target.value = normalizeSkuCode(e.target.value);
                void sku.onChange(e);
              }}
              placeholder="VD: SOFA-3S-GREY"
              aria-label={`SKU dòng ${index + 1}`}
              aria-invalid={errors?.skuId ? true : undefined}
              aria-describedby={errors?.skuId ? skuErrorId : undefined}
              className={cn(fieldClass(!!errors?.skuId), "font-[family-name:var(--font-mono)]")}
            />
            <FieldError id={skuErrorId}>{errors?.skuId?.message}</FieldError>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={`po-line-${index}-desc`}
              className="text-ink-secondary mb-0.5 block text-[11px] leading-4 font-medium"
            >
              Mô tả sản phẩm <span className="text-danger">*</span>
            </label>
            <Textarea
              id={`po-line-${index}-desc`}
              {...register(`lines.${index}.description`)}
              placeholder="VD: Sofa 3 chỗ, vải xám"
              rows={2}
              maxLength={PO_LIMITS.lineDescriptionMax}
              aria-invalid={errors?.description ? true : undefined}
              aria-describedby={errors?.description ? descErrorId : undefined}
              className={cn(
                fieldClass(!!errors?.description).replace("h-8", ""),
                "min-h-[56px] resize-y py-2",
              )}
            />
            <p className="text-ink-tertiary mt-0.5 text-right text-[11px] tabular-nums">
              {line?.description.length ?? 0}/{PO_LIMITS.lineDescriptionMax}
            </p>
            <FieldError id={descErrorId}>{errors?.description?.message}</FieldError>
          </div>
        </div>
        <PoLineFields w={w} index={index} />
      </div>
    </div>
  );
}
