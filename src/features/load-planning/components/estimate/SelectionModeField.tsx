"use client";

/** Một chế độ chọn xe: giá trị gửi BE, nhãn và câu giải thích dưới nhãn. */
export interface SelectionModeOption<M extends string> {
  value: M;
  label: string;
  hint: string;
}

interface SelectionModeFieldProps<M extends string> {
  legend: string;
  name: string;
  options: readonly SelectionModeOption<M>[];
  value: M;
  onChange: (mode: M) => void;
}

/**
 * Nhóm radio "Cách chọn xe" (docs 09 §4.2 "Chế độ chọn xe"): radio gốc có nhãn, bàn phím và trình đọc màn hình dùng
 * được, không cần dropdown. Danh sách chế độ do màn gọi quyết (ước tính của đơn: 2; ước tính thử: 5).
 */
export function SelectionModeField<M extends string>(props: SelectionModeFieldProps<M>) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="text-[0.8125rem] font-medium">{props.legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {props.options.map((option) => (
          <label
            key={option.value}
            className="border-border-default hover:bg-bg-muted has-[:checked]:border-ink-primary flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border px-2.5 py-1.5"
          >
            <input
              type="radio"
              name={props.name}
              value={option.value}
              checked={props.value === option.value}
              onChange={() => props.onChange(option.value)}
              className="accent-ink-primary mt-0.5"
            />
            <span className="text-[0.8125rem]">
              <span className="text-ink-primary block font-medium">{option.label}</span>
              <span className="text-ink-tertiary block text-xs">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
