"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { isExpectedDatePast } from "@/features/purchase-order";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CurrencyField } from "./CurrencyField";
import { FieldError, SectionTitle, SummaryItem } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";
import { SupplierCombobox } from "./SupplierCombobox";

import type { CreatePoWizard } from "./useCreateForm";

const L = UI_LABELS.purchaseOrder;

/** Bước 1 — NCC, tiền tệ, ngày giao. Lỗi (client + server) hiện inline ngay dưới ô. */
export function InfoStep({ w }: { w: CreatePoWizard }) {
  const { control, register, setValue } = w.form;
  const { errors, values, selectedSupplier, suggestedDate } = w;

  return (
    <Card>
      <SectionTitle
        title="Thông tin PO"
        description="Chọn nhà cung cấp đang hợp tác, tiền tệ của đơn và ngày giao dự kiến."
      />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-ink-secondary mb-1 block text-xs font-medium">
              Nhà cung cấp <span className="text-danger">*</span>
            </label>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <SupplierCombobox
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id);
                    field.onBlur();
                  }}
                  suppliers={w.suppliers}
                  hasError={!!errors.supplierId}
                  describedBy="po-supplier-error"
                />
              )}
            />
            <FieldError id="po-supplier-error">{errors.supplierId?.message}</FieldError>
          </div>
          <CurrencyField w={w} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label
              htmlFor="po-expected"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              Ngày giao dự kiến
            </label>
            <Input
              id="po-expected"
              type="date"
              aria-invalid={errors.expectedDate ? true : undefined}
              aria-describedby={errors.expectedDate ? "po-expected-error" : undefined}
              {...register("expectedDate")}
              className={fieldClass(!!errors.expectedDate)}
            />
            <FieldError id="po-expected-error">{errors.expectedDate?.message}</FieldError>
            {/* BR-06 (docs 02 §6): so với HÔM NAY — chỉ cảnh báo, không chặn tạo PO. */}
            {isExpectedDatePast(values.expectedDate, w.today) && (
              <div className="border-warning/30 bg-warning/10 text-warning mt-2 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
                Ngày giao dự kiến đã qua. Vẫn tạo được PO, nhưng phải đổi ngày trước khi gửi NCC.
              </div>
            )}
            {suggestedDate && suggestedDate !== values.expectedDate && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-1 h-auto px-0 text-left text-xs whitespace-normal"
                onClick={() => setValue("expectedDate", suggestedDate, { shouldDirty: true })}
              >
                Dùng gợi ý: {formatDate(suggestedDate)} (theo thời gian giao của NCC)
              </Button>
            )}
          </div>
          <SummaryItem
            label={L.paymentTermDays}
            value={selectedSupplier ? `${selectedSupplier.paymentTermDays} ${L.days}` : "—"}
          />
          <SummaryItem
            label={L.leadTimeDays}
            value={selectedSupplier ? `${selectedSupplier.leadTimeDays} ${L.days}` : "—"}
          />
        </div>
      </div>
    </Card>
  );
}
