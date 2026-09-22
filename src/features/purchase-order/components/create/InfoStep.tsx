"use client";

import { Card } from "@/components/shared/Card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Supplier } from "@/features/purchase-order";

import { FieldError, SectionTitle } from "./CreateFormPrimitives";
import { SupplierCombobox } from "./SupplierCombobox";
import { fieldClass, isExpectedDatePast } from "./helpers";
import type { FormState } from "./types";

export function InfoStep({
  form,
  activeSuppliers,
  selectedSupplier,
  showErrors,
  onSupplierChange,
  update,
}: {
  form: FormState;
  activeSuppliers: Supplier[];
  selectedSupplier?: Supplier;
  showErrors: boolean;
  onSupplierChange: (supplierId: string) => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Card>
      <SectionTitle
        title="Thông tin PO"
        description="Chọn nhà cung cấp và ngày giao dự kiến (expectedAt)."
      />
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-ink-secondary mb-1 block text-xs font-medium">
              Nhà cung cấp <span className="text-danger">*</span>
            </label>
            <SupplierCombobox
              value={form.supplierId}
              onChange={onSupplierChange}
              suppliers={activeSuppliers}
              hasError={showErrors && !form.supplierId}
            />
            <FieldError>
              {showErrors && !form.supplierId ? "Nhà cung cấp là bắt buộc." : undefined}
            </FieldError>
          </div>
          <div>
            <label className="text-ink-secondary mb-1 block text-xs font-medium">
              Điều khoản thanh toán
            </label>
            <Input
              value={form.paymentTerms}
              onChange={(e) => update("paymentTerms", e.target.value)}
              placeholder="Net 30"
              className={fieldClass()}
            />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="text-ink-secondary mb-1 block text-xs font-medium">Ngày đặt</label>
            <Input
              type="date"
              value={form.orderDate}
              onChange={(e) => update("orderDate", e.target.value)}
              className={fieldClass()}
            />
          </div>
          <div>
            <label className="text-ink-secondary mb-1 block text-xs font-medium">
              Ngày giao dự kiến
            </label>
            <Input
              type="date"
              value={form.expectedDate}
              onChange={(e) => update("expectedDate", e.target.value)}
              className={fieldClass()}
            />
            {isExpectedDatePast(form.expectedDate) && (
              <div className="border-warning/30 bg-warning/10 text-warning mt-2 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
                Ngày giao dự kiến đang nằm trước ngày đặt. Cảnh báo này không chặn gửi duyệt.
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="poc-n-v-ti-n-t"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              Đơn vị tiền tệ
            </label>
            <Input
              id="poc-n-v-ti-n-t"
              value={form.currency || selectedSupplier?.currency || "VND"}
              readOnly
              className={fieldClass()}
            />
          </div>
        </div>
        <div>
          <label className="text-ink-secondary mb-1 block text-xs font-medium">Ghi chú</label>
          <Textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={6}
            placeholder="Ghi chú nội bộ cho buyer / approver..."
            className={fieldClass().replace("h-8 ", "") + " min-h-[120px] py-2"}
          />
        </div>
      </div>
    </Card>
  );
}
