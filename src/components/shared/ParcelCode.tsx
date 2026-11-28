import { cn } from "cn";

interface ParcelCodeProps {
  /** LPN của thùng (docs 08 §4.3 bước 6: mã kiện = LPN). BE cũ chưa trả thì chỉ hiện mã nhãn. */
  lpn?: string | null;
  /** Mã nhãn `SO-…-C1` — hiện nhỏ bên dưới LPN; quét vẫn nhận cả hai. */
  labelCode: string;
  className?: string;
}

/** Mã kiện trên màn xếp xe: LPN là mã chính, mã nhãn nhỏ bên dưới (WF4-F5). */
export function ParcelCode({ lpn, labelCode, className }: ParcelCodeProps) {
  if (!lpn || lpn === labelCode) return <span className={className}>{labelCode}</span>;
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span>{lpn}</span>
      <span className="text-ink-tertiary text-xs font-normal">{labelCode}</span>
    </span>
  );
}

/** Mã hiện cho một kiện khi chỉ có chỗ cho một mã (câu thông báo): LPN nếu có, không thì mã nhãn. */
export function parcelDisplayCode(parcel: { lpn?: string | null; labelCode: string }): string {
  return parcel.lpn || parcel.labelCode;
}
