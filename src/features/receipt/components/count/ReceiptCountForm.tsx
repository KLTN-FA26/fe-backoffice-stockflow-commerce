"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { receiptCountInputSchema } from "@/features/receipt/count-schemas";
import { countFieldErrors, toLinesRequest } from "@/features/receipt/count-selectors";
import { isStaleReceiptError, receiptErrorMessage } from "@/features/receipt/errors";
import { useReplaceReceiptLines } from "@/features/receipt/mutations";
import { ScrollShadowBox } from "@/components/backoffice/ScrollShadowBox";
import { Alert } from "@/components/shared/Alert";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CountLineRow } from "./CountLineRow";

import type { AreaOption } from "@/lib/references/warehouse-layout";
import type { CountRow, GoodsReceipt, ReceiptCountFormValues } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;
const H = C.headers;
const HEADERS = [
  { label: H.sku, right: false },
  { label: H.production, right: true },
  { label: H.location, right: false },
  { label: H.cartons, right: false },
  { label: H.result, right: false },
];
const ACTION = "h-(--action-h) rounded-(--action-radius) px-(--action-px) text-[0.8125rem]";

/**
 * Form kiểm đếm theo thùng (docs 03 §4.1 bước 2–5): mỗi lần lưu thay toàn bộ bản đếm (`PUT /lines`). Lưu xong form
 * nhận lại dòng từ response — thùng mới đã có LPN, lần lưu sau gửi `lpn` để đếm lại chứ không tạo thùng trùng.
 * Lỗi từng trường của BE (`lines[i]…`) map về đúng dòng form qua `rowOf`.
 */
export function ReceiptCountForm({
  receiptId,
  rows,
  areas,
  lot,
  rebuild,
  onDirtyChange,
}: {
  receiptId: string;
  rows: CountRow[];
  areas: readonly AreaOption[];
  lot: string;
  /** Dựng lại dòng form từ phiếu vừa lưu (response BE). */
  rebuild: (saved: GoodsReceipt) => CountRow[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const form = useForm<ReceiptCountFormValues, unknown, ReceiptCountFormValues>({
    resolver: zodResolver(receiptCountInputSchema),
    defaultValues: { rows },
  });
  const save = useReplaceReceiptLines();
  const [error, setError] = useState<string | null>(null);
  const { isDirty } = form.formState;
  const rootError =
    form.formState.errors.rows?.root?.message ?? form.formState.errors.rows?.message;

  // Báo trang chi tiết: còn thay đổi chưa lưu thì khoá "Xác nhận nhập kho"; form gỡ ra → không còn gì để chặn
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const submit = form.handleSubmit((values) => {
    setError(null);
    const { body, rowOf } = toLinesRequest(values.rows);
    save.mutate(
      { receiptId, body },
      {
        onSuccess: (saved) => form.reset({ rows: rebuild(saved) }),
        onError: (failure) => {
          // Lỗi dữ liệu cũ: phiếu tự tải lại và form dựng lại từ dữ liệu mới (mất lỗi inline) → báo bằng toast
          if (isStaleReceiptError(failure)) {
            toast.error(receiptErrorMessage(failure));
            return;
          }
          const fields = countFieldErrors(failure, rowOf);
          fields.forEach((f) => form.setError(`rows.${f.row}.${f.field}`, { message: f.message }));
          setError(fields.length > 0 ? null : receiptErrorMessage(failure));
        },
      },
    );
  });

  const rowValues = useWatch({ control: form.control, name: "rows" });
  // Một khu nhận cho cả phiếu: chọn một lần áp cho mọi dòng; các dòng đã khác nhau thì hiện "Mỗi dòng một khu"
  const firstLocation = rowValues[0]?.locationCode ?? "";
  const sharedLocation = rowValues.every((row) => row.locationCode === firstLocation)
    ? firstLocation
    : "";
  const applyLocationToAll = (code: string) =>
    rowValues.forEach((_, index) =>
      form.setValue(`rows.${index}.locationCode`, code, { shouldDirty: true }),
    );

  return (
    <FormProvider {...form}>
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-3">
        {rows.length > 1 && areas.length > 1 && (
          <div className="max-w-sm space-y-1">
            <Label htmlFor="count-all-location" className="text-ink-primary text-[0.8125rem]">
              {C.allLocation}
            </Label>
            <FormSelect value={sharedLocation} onValueChange={applyLocationToAll}>
              <SelectTrigger id="count-all-location" className={FORM_SELECT_CLASS}>
                <SelectValue
                  placeholder={
                    rowValues.length > 0 && sharedLocation === "" && firstLocation !== ""
                      ? C.allLocationMixed
                      : C.allLocationPlaceholder
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.locationCode} value={area.locationCode}>
                    {area.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
            <p className="text-ink-tertiary text-xs">{C.allLocationHint}</p>
          </div>
        )}
        <ScrollShadowBox>
          <table className="w-full text-[0.8125rem]">
            <caption className="sr-only">{C.caption}</caption>
            <thead className="bg-bg-subtle text-ink-secondary">
              <tr>
                {HEADERS.map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    className={`px-3 py-2 font-medium whitespace-nowrap ${h.right ? "text-right" : "text-left"}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <CountLineRow
                  key={row.productionOrderLineId}
                  index={index}
                  areas={areas}
                  lot={lot}
                />
              ))}
            </tbody>
          </table>
        </ScrollShadowBox>
        <p className="text-ink-tertiary text-xs">{C.voidHint}</p>
        {rootError && (
          <p role="alert" className="text-danger text-xs">
            {rootError}
          </p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || save.isPending}
            onClick={() => {
              setError(null);
              form.reset();
            }}
            className={`border-border-default bg-bg-surface text-ink-primary ${ACTION}`}
          >
            {C.discard}
          </Button>
          <Button
            type="submit"
            disabled={save.isPending}
            className={`bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${ACTION}`}
          >
            <Save className="size-3.5" />
            {C.save}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
