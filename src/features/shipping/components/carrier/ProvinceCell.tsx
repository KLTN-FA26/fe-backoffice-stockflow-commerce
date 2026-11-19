"use client";

import { useVnProvinces } from "@/lib/references/vn-divisions";

import { SelectCell, TextCell } from "./RowCells";

/**
 * Ô tỉnh / thành của một dòng: chọn từ danh mục hành chính (cùng nguồn với ô địa chỉ kho; mã tỉnh lưu dạng chuỗi số như địa
 * chỉ đơn hàng mang), danh mục không tải được thì nhập thẳng mã tỉnh.
 */
export function ProvinceCell({
  label,
  title,
  value,
  onChange,
  error,
  placeholder,
  maxLength,
}: {
  label: string;
  title: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  placeholder: string;
  maxLength: number;
}) {
  const provinces = useVnProvinces();
  if (provinces.isError) {
    return (
      <TextCell
        label={label}
        value={value}
        onChange={onChange}
        error={error}
        maxLength={maxLength}
        placeholder={placeholder}
        mono
      />
    );
  }
  return (
    <SelectCell
      label={label}
      title={title}
      value={value}
      fallbackLabel={value}
      options={(provinces.data ?? []).map((province) => ({
        value: String(province.code),
        label: province.name,
      }))}
      onChange={onChange}
      error={error}
      placeholder={placeholder}
    />
  );
}
