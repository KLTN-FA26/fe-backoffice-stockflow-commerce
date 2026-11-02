"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { ADMIN_ROUTES, RECEIPT_LIMITS, UI_LABELS } from "@/constants";
import { receiptCreateWithoutPoInputSchema } from "@/features/receipt/input-schemas";
import { useCreateGoodsReceiptWithoutPo } from "@/features/receipt/mutations";
import { useSupplierOptions, useWarehouseOptions } from "@/features/receipt/queries";
import { receiptErrorMessage } from "@/features/receipt/errors";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, Section } from "../primitives";
import { ReceiptLoadError } from "../ReceiptLoadError";

import type {
  ReceiptCreateWithoutPoInput,
  ReceiptCreateWithoutPoValues,
} from "@/features/receipt/types";

const L = UI_LABELS.receipt.blind;
const FIELD = "border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Tạo phiếu DRAFT cho hàng về KHÔNG có PO (docs 03 "Receipt không PO", BR-RCP-002; owner NOPO-SUPPLIER: NCC bắt buộc,
 * NOPO-REASON: lý do tự do bắt buộc). Phiếu không ghi nhận ngay — luôn chờ Quản lý kho duyệt.
 */
export function ReceiptCreateWithoutPoForm() {
  const router = useRouter();
  const suppliers = useSupplierOptions(true);
  const warehouses = useWarehouseOptions(true);
  const create = useCreateGoodsReceiptWithoutPo();
  const form = useForm<ReceiptCreateWithoutPoInput, unknown, ReceiptCreateWithoutPoValues>({
    resolver: zodResolver(receiptCreateWithoutPoInputSchema),
    defaultValues: { supplierId: "", warehouseId: "", reason: "", deliveryNote: "", note: "" },
  });
  const errors = form.formState.errors;
  const serverError = create.error ? receiptErrorMessage(create.error) : null;

  const submit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (receipt) => router.push(ADMIN_ROUTES.receipts.detail(receipt.id)),
    }),
  );

  if (suppliers.isPending || warehouses.isPending) return <PageSkeleton variant="form" />;
  if (suppliers.isError || warehouses.isError) {
    return (
      <ReceiptLoadError
        error={suppliers.error ?? warehouses.error}
        onRetry={() => {
          void suppliers.refetch();
          void warehouses.refetch();
        }}
      />
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
      <Section title={L.formSectionTitle} description={L.formSectionDescription}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="blind-supplier" className="text-[0.8125rem]">
              {L.supplier} <span className="text-danger">*</span>
            </Label>
            <Controller
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="blind-supplier"
                    autoFocus
                    aria-invalid={errors.supplierId ? true : undefined}
                    aria-describedby={errors.supplierId ? "blind-supplier-error" : undefined}
                    className={`w-full ${FIELD}`}
                  >
                    <SelectValue placeholder={L.supplierPlaceholder} />
                  </SelectTrigger>
                  <TitledSelectContent title={L.supplier}>
                    {suppliers.data.map((supplier) => (
                      <SelectItem key={supplier.supplierId} value={supplier.supplierId}>
                        <span className="font-[family-name:var(--font-mono)]">{supplier.code}</span>{" "}
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </TitledSelectContent>
                </Select>
              )}
            />
            <FieldError id="blind-supplier-error">{errors.supplierId?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="blind-warehouse" className="text-[0.8125rem]">
              {L.warehouse} <span className="text-danger">*</span>
            </Label>
            <Controller
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="blind-warehouse"
                    aria-invalid={errors.warehouseId ? true : undefined}
                    aria-describedby={errors.warehouseId ? "blind-warehouse-error" : undefined}
                    className={`w-full ${FIELD}`}
                  >
                    <SelectValue placeholder={L.warehousePlaceholder} />
                  </SelectTrigger>
                  <TitledSelectContent title={L.warehouse}>
                    {warehouses.data.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        <span className="font-[family-name:var(--font-mono)]">
                          {warehouse.prefix}
                        </span>{" "}
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </TitledSelectContent>
                </Select>
              )}
            />
            <FieldError id="blind-warehouse-error">{errors.warehouseId?.message}</FieldError>
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="blind-reason" className="text-[0.8125rem]">
            {L.reason} <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="blind-reason"
            rows={2}
            maxLength={RECEIPT_LIMITS.blindReasonMax}
            placeholder={L.reasonPlaceholder}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={errors.reason ? "blind-reason-error" : undefined}
            className={FIELD}
            {...form.register("reason")}
          />
          <FieldError id="blind-reason-error">{errors.reason?.message}</FieldError>
        </div>
      </Section>

      <Section
        title="Phiếu giao của nhà cung cấp"
        description="Khuyến nghị nhập để đối chiếu với xe hàng (docs 03 bước 2)."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="blind-delivery-note" className="text-[0.8125rem]">
              Số phiếu giao
            </Label>
            <Input
              id="blind-delivery-note"
              maxLength={RECEIPT_LIMITS.deliveryNoteMax}
              className={FIELD}
              {...form.register("deliveryNote")}
            />
            <FieldError>{errors.deliveryNote?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="blind-note" className="text-[0.8125rem]">
              Ghi chú
            </Label>
            <Textarea
              id="blind-note"
              rows={2}
              maxLength={RECEIPT_LIMITS.noteMax}
              className={FIELD}
              {...form.register("note")}
            />
            <FieldError>{errors.note?.message}</FieldError>
          </div>
        </div>
      </Section>

      {serverError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {serverError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={ADMIN_ROUTES.receipts.list}>Huỷ</Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={create.isPending}
          className="rounded-[var(--r-sm)]"
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {UI_LABELS.receipt.action.create}
        </Button>
      </div>
    </form>
  );
}
