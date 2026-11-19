"use client";

import { FormSelect } from "@/components/shared/FormSelect";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { REQUIRED } from "@/features/shipping/carrier-row-core";

import { FieldError, MONO, fieldClass } from "../primitives";

const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full min-w-0 rounded-[var(--r-sm)] text-[0.8125rem]";

/** Chữ lỗi của ô: ô trống bắt buộc (`REQUIRED`) chỉ đánh dấu đỏ, không in chữ. */
const messageOf = (error?: string) => (error && error !== REQUIRED ? error : undefined);

/** Ô nhập chữ (không có `<td>`) để ghép thêm nút cùng ô, vd nút tra dịch vụ. */
export function TextCellBody({
  label,
  value,
  onChange,
  error,
  maxLength,
  mono = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  maxLength: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <>
      <Input
        aria-label={label}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass(!!error)} ${mono ? MONO : ""}`}
      />
      <FieldError>{messageOf(error)}</FieldError>
    </>
  );
}

/** Ô chữ trong một dòng của bảng sửa được. */
export function TextCell(props: Parameters<typeof TextCellBody>[0]) {
  return (
    <td className="px-1.5 py-1 align-top">
      <TextCellBody {...props} />
    </td>
  );
}

export interface CellOption {
  value: string;
  label: string;
}

/** Ô chọn trong một dòng; giá trị đã lưu mà không còn trong danh sách vẫn hiện (nhãn dự phòng) để không mất khi sửa dòng khác. */
export function SelectCell({
  label,
  title,
  value,
  options,
  fallbackLabel,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  title: string;
  value: string;
  options: readonly CellOption[];
  /** Nhãn hiện khi `value` không có trong `options` (vd loại xe đã ngừng dùng / danh mục chưa tải). */
  fallbackLabel?: string;
  onChange: (next: string) => void;
  error?: string;
  placeholder: string;
}) {
  const known = value === "" || options.some((option) => option.value === value);
  return (
    <td className="px-1.5 py-1 align-top">
      <FormSelect value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          aria-invalid={error ? true : undefined}
          className={TRIGGER}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <TitledSelectContent title={title}>
          {!known && <SelectItem value={value}>{fallbackLabel || value}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </FormSelect>
      <FieldError>{messageOf(error)}</FieldError>
    </td>
  );
}
