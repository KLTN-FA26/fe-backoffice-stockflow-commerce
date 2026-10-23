"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError } from "./CreateFormPrimitives";
import { fieldClass } from "./helpers";

import type { CreatePoWizard } from "./useCreateForm";

const F = UI_LABELS.purchaseOrder.warehouseField;

/**
 * Kho nhận hàng của PO — bắt buộc (SCRUM-390, docs 02 §3), cố định sau khi tạo (BE PR #71).
 * Phiếu nhận hàng của PO chỉ nhận vào đúng kho này.
 */
export function WarehouseField({ w }: { w: CreatePoWizard }) {
  const { control } = w.form;
  const { errors } = w;
  return (
    <div>
      <label htmlFor="po-warehouse" className="text-ink-secondary mb-1 block text-xs font-medium">
        {F.label} <span className="text-danger">*</span>
      </label>
      <Controller
        control={control}
        name="warehouseId"
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              field.onBlur();
            }}
            disabled={w.warehousesQuery.isLoading}
          >
            <SelectTrigger
              id="po-warehouse"
              aria-invalid={errors.warehouseId ? true : undefined}
              aria-describedby={errors.warehouseId ? "po-warehouse-error" : undefined}
              className={fieldClass(!!errors.warehouseId)}
            >
              <SelectValue placeholder={w.warehousesQuery.isLoading ? F.loading : F.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {/* Kho của nháp ngoài danh sách: ngừng hoạt động (khoá + nhãn) hoặc danh sách chưa tải được */}
                {w.keptWarehouse && (
                  <SelectItem
                    value={w.keptWarehouse.warehouseId}
                    disabled={w.inactiveWarehouse !== null}
                  >
                    {w.keptWarehouse.name}
                    {w.inactiveWarehouse &&
                      ` ${UI_LABELS.purchaseOrder.draftEdit.warehouseInactiveTag}`}
                  </SelectItem>
                )}
                {w.warehouses.map((wh) => (
                  <SelectItem key={wh.warehouseId} value={wh.warehouseId}>
                    {wh.code ? `${wh.code} — ${wh.name}` : wh.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      />
      {w.warehousesFailed && (
        <div className="mt-1 flex items-center gap-2 text-xs" role="alert">
          <span className="text-danger">{w.mode === "edit" ? F.editLoadFailed : F.loadFailed}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => void w.warehousesQuery.refetch()}
          >
            {UI_LABELS.common.retry}
          </Button>
        </div>
      )}
      <FieldError id="po-warehouse-error">{errors.warehouseId?.message}</FieldError>
      {w.inactiveWarehouse && w.values.warehouseId === w.inactiveWarehouse.warehouseId && (
        <p className="text-warning mt-1 text-xs">
          {UI_LABELS.purchaseOrder.draftEdit.warehouseInactive}
        </p>
      )}
    </div>
  );
}
