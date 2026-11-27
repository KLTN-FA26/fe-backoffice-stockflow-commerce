"use client";

import { WAREHOUSE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useWarehouseAreas } from "@/lib/references/warehouse-layout";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";

import type { AreaType } from "@/lib/references/warehouse-layout";

/** Giá trị đại diện cho "" (không chọn) — SelectItem không nhận value rỗng. */
const EMPTY_LOCATION = "__none__";

/**
 * Chọn vị trí trong kho của lệnh: có quyền xem sơ đồ → danh sách khu đúng loại; không có (QC,
 * sản xuất) hoặc kho chưa có khu → ô nhập / quét mã vị trí. BE kiểm tra loại khu và trạng thái.
 */
export function LocationField({
  id,
  label,
  warehouseId,
  areaType,
  value,
  onChange,
  error,
  required,
  emptyHint,
  autoFocus,
}: {
  id: string;
  label: string;
  warehouseId: string;
  /** Không truyền = mọi khu đang dùng được. */
  areaType?: AreaType;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  required?: boolean;
  /** Gợi ý khi để trống được phép (vd BE tự chọn khu đóng gói duy nhất). */
  emptyHint?: string;
  autoFocus?: boolean;
}) {
  const canReadLayout = useCan(WAREHOUSE_PERMISSIONS.locationsRead);
  const areas = useWarehouseAreas(warehouseId, canReadLayout);
  const options = (areas.data ?? []).filter((area) => !areaType || area.type === areaType);
  // Đang tải sơ đồ: giữ chỗ bằng select khoá — không hiện ô nhập rồi tráo sang select (mã đã gõ/quét
  // vào ô tạm sẽ còn trong state nhưng select không hiện, gửi đi một vị trí người dùng không thấy).
  const loading = canReadLayout && areas.isLoading;
  const hint =
    options.length || loading
      ? emptyHint
      : `Nhập hoặc quét mã vị trí.${emptyHint ? ` ${emptyHint}` : ""}`;

  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {loading ? (
        <Select disabled>
          <SelectTrigger {...fieldA11y(id, error, !!hint)} aria-busy className={FORM_SELECT_CLASS}>
            <SelectValue placeholder="Đang tải vị trí…" />
          </SelectTrigger>
        </Select>
      ) : options.length ? (
        <Select
          value={value === "" ? EMPTY_LOCATION : value}
          onValueChange={(next) => onChange(next === EMPTY_LOCATION ? "" : next)}
        >
          <SelectTrigger
            {...fieldA11y(id, error, !!hint)}
            className={FORM_SELECT_CLASS}
            autoFocus={autoFocus}
          >
            <SelectValue />
          </SelectTrigger>
          <TitledSelectContent title={label}>
            <SelectItem value={EMPTY_LOCATION}>
              {required ? "— Chọn vị trí —" : "— Để hệ thống chọn —"}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.locationCode} value={option.locationCode}>
                {option.label}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      ) : (
        <Input
          {...fieldA11y(id, error, !!hint)}
          value={value}
          onChange={(event) => onChange(event.target.value.trim().toUpperCase())}
          autoFocus={autoFocus}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] uppercase`}
        />
      )}
    </FormField>
  );
}
