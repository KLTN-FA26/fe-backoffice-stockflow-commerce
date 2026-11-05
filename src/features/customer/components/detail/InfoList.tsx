import type { ReactNode } from "react";

/** Danh sách nhãn — giá trị dạng `<dl>` cho thẻ chi tiết (Mode A, dày đặc). */
export function InfoList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-tertiary">{item.label}</dt>
          <dd className="text-ink-primary min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
