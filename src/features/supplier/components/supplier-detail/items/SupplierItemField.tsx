import { cn } from "cn";

/** Khung một ô của form danh mục hàng NCC: nhãn (kèm `*` khi bắt buộc), ô nhập, dòng lỗi / gợi ý. */
export function SupplierItemField({
  id,
  label,
  required,
  wide,
  note,
  isError,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  wide?: boolean;
  /** Lỗi (khi `isError`) hoặc gợi ý; render với id `${id}-note` để ô nhập `aria-describedby`. */
  note?: string;
  isError?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", wide && "col-span-3")}>
      <label htmlFor={id} className="text-ink-secondary text-xs font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {note && (
        <p
          id={`${id}-note`}
          className={cn("text-xs", isError ? "text-danger" : "text-ink-tertiary")}
        >
          {note}
        </p>
      )}
    </div>
  );
}
