"use client";

import { useEffect, useId } from "react";

import { ORDER_RELEASE_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReleaseWarehouseFieldProps {
  value: string;
  onChange: (warehouseId: string) => void;
  /** Lỗi của ô (zod hoặc 400 `warehouseId` của BE). */
  error: string | undefined;
  /** Kho Sale đã chọn cho đơn (docs 17 BR-22: mỗi đơn đúng một kho xuất) — hiện dạng chữ, không bắt chọn lại. */
  chosenWarehouseId?: string | null;
  /** Tên kho BE kèm sẵn trên đơn (nếu có) — dùng thay cho tra danh mục kho. */
  chosenWarehouseName?: string | null;
}

/**
 * Ô "Kho xuất hàng" của hộp thoại release: chỉ chọn được khi danh sách kho đã tải xong. 403 (điều phối chưa có
 * `warehouse-warehouses:READ`) nói rõ mã quyền; lỗi khác "Không tải được"; danh sách rỗng báo riêng. Hộp thoại vẫn dùng
 * được (huỷ, xem ước tính). UI-only — Backend phải re-check.
 */
export function ReleaseWarehouseField({
  value,
  onChange,
  error,
  chosenWarehouseId,
  chosenWarehouseName,
}: ReleaseWarehouseFieldProps) {
  const L = ORDER_RELEASE_LABELS;
  const id = useId();
  const warehouses = useWarehouseOptions();
  const forbidden = warehouses.error instanceof ApiError && warehouses.error.status === 403;
  // Chưa có kho Sale chọn mà hệ thống chỉ có đúng một kho đang hoạt động → chọn sẵn kho đó (R6)
  const onlyId =
    !chosenWarehouseId && warehouses.data?.length === 1
      ? warehouses.data[0]?.warehouseId
      : undefined;
  useEffect(() => {
    if (onlyId && !value) onChange(onlyId);
  }, [onlyId, value, onChange]);

  if (chosenWarehouseId) {
    const chosen = warehouses.data?.find(
      (warehouse) => warehouse.warehouseId === chosenWarehouseId,
    );
    return (
      <div>
        <p className="text-[0.8125rem] font-medium">{L.warehouseLabel}</p>
        <p className="text-ink-primary mt-1 text-[0.875rem]" data-testid="release-chosen-warehouse">
          {chosenWarehouseName ??
            (chosen
              ? chosen.code
                ? `${chosen.name} (${chosen.code})`
                : chosen.name
              : L.chosenWarehouseUnknown)}
        </p>
        <p className="text-ink-tertiary mt-0.5 text-xs">{L.chosenWarehouseHint}</p>
        {error && (
          <p role="alert" className="text-danger mt-1 text-xs">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {L.warehouseLabel} <span className="text-danger">*</span>
      </Label>
      <Select value={value} onValueChange={onChange} disabled={!warehouses.data}>
        <SelectTrigger
          id={id}
          autoFocus
          aria-required="true"
          aria-invalid={error ? true : undefined}
          className="border-border-default bg-bg-surface text-ink-primary mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
        >
          <SelectValue
            placeholder={warehouses.isPending ? L.warehousesLoading : L.warehousePlaceholder}
          />
        </SelectTrigger>
        <SelectContent>
          {warehouses.data?.map((warehouse) => (
            <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
              {warehouse.code ? `${warehouse.code} — ${warehouse.name}` : warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {warehouses.isError && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {forbidden ? L.warehousesForbidden : L.warehousesFailed}
        </p>
      )}
      {warehouses.data?.length === 0 && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {L.warehousesEmpty}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
