"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { formatDate } from "@/lib/format";
import { isExpectedDatePast } from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { Card } from "@/components/shared/Card";
import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { CurrencyField } from "./CurrencyField";
import { FieldError, ReadOnlyField, SectionTitle } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";
import { SupplierCombobox } from "./SupplierCombobox";
import { WarehouseField } from "./WarehouseField";

import type { CreatePoWizard } from "./useCreateForm";

const L = UI_LABELS.purchaseOrder;
const C = L.catalog;

/** Bước 1 — NCC, kho nhận, tiền tệ, ghi chú, ngày giao. Lỗi (client + server) hiện inline dưới ô. */
export function InfoStep({ w, supplierLabel }: { w: CreatePoWizard; supplierLabel: string }) {
  const { control, register, setValue } = w.form;
  const { errors, values, selectedSupplier, suggestedDate } = w;
  // BR-07 (docs 02 §6): màn sửa nháp không đổi được NCC / tiền tệ ⇒ chỉ đọc, không có combobox.
  const isEdit = w.mode === "edit";

  return (
    <Card>
      <SectionTitle
        title="Thông tin PO"
        description="Chọn nhà cung cấp đang hợp tác, kho nhận hàng, tiền tệ của đơn và ngày giao dự kiến."
      />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            {isEdit ? (
              <ReadOnlyField id="po-supplier" label={L.supplier} value={supplierLabel} />
            ) : (
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
                      // Đã chọn SKU theo danh mục NCC cũ ⇒ hỏi xác nhận trước khi đổi (xoá dòng).
                      onChange={w.catalog.requestSupplierChange}
                      suppliers={w.suppliers}
                      hasError={!!errors.supplierId}
                      describedBy="po-supplier-error"
                    />
                  )}
                />
                <FieldError id="po-supplier-error">{errors.supplierId?.message}</FieldError>
              </div>
            )}
            {/* Điều khoản của NCC (chỉ đọc) — dòng phụ dưới ô NCC thay vì ô riêng */}
            {selectedSupplier && (
              <p className="text-ink-tertiary mt-1 text-xs tabular-nums">
                {L.paymentTermDays}{" "}
                <span className="text-ink-secondary font-medium">{`${selectedSupplier.paymentTermDays} ${L.days}`}</span>
                {" · "}
                {L.leadTimeDays}{" "}
                <span className="text-ink-secondary font-medium">{`${selectedSupplier.leadTimeDays} ${L.days}`}</span>
              </p>
            )}
          </div>
          <WarehouseField w={w} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isEdit ? (
            <ReadOnlyField id="po-currency" label={L.currencyOfPo} value={values.currency} />
          ) : (
            <CurrencyField w={w} />
          )}
          <div>
            <label
              htmlFor="po-expected"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              Ngày giao dự kiến
            </label>
            <Controller
              control={control}
              name="expectedDate"
              render={({ field }) => (
                <DatePicker
                  id="po-expected"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  clearable
                  aria-invalid={errors.expectedDate ? true : undefined}
                  aria-describedby={errors.expectedDate ? "po-expected-error" : undefined}
                  className={fieldClass(!!errors.expectedDate)}
                />
              )}
            />
            <FieldError id="po-expected-error">{errors.expectedDate?.message}</FieldError>
            {/* BR-06 (docs 02 §6): so với HÔM NAY — chỉ cảnh báo, không chặn tạo PO. */}
            {isExpectedDatePast(values.expectedDate, w.today) && (
              <Alert tone="warning" className="mt-2">
                {L.deliveryDateInPast}
              </Alert>
            )}
            {suggestedDate && suggestedDate !== values.expectedDate && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-1 h-auto px-0 text-left text-xs whitespace-normal"
                onClick={() => setValue("expectedDate", suggestedDate, { shouldDirty: true })}
              >
                Dùng gợi ý: {formatDate(suggestedDate)} (
                {w.suggestedFromCatalog ? C.suggestFromCatalog : C.suggestFromSupplier})
              </Button>
            )}
          </div>
        </div>
        {/* Ghi chú tự do — trải hết chiều ngang, không lệch chiều cao với ô một dòng */}
        <div>
          <label htmlFor="po-note" className="text-ink-secondary mb-1 block text-xs font-medium">
            Ghi chú
          </label>
          <Textarea
            id="po-note"
            rows={3}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? "po-note-error" : undefined}
            {...register("note")}
          />
          <FieldError id="po-note-error">{errors.note?.message}</FieldError>
        </div>
      </div>
    </Card>
  );
}
