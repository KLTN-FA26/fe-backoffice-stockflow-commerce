import { openReferenceKindLabel } from "@/features/product";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { OpenReference } from "@/features/product";

const MONO = "font-[family-name:var(--font-mono)]";

export const uniqueOptions = (pairs: readonly (readonly [string, string])[]) =>
  [...new Map(pairs).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));

/** Cột bảng chứng từ còn mở — độ rộng tối thiểu để bảng cuộn ngang thay vì bóp chữ trên màn hẹp. */
export const OPEN_REFERENCE_COLUMNS: ColumnDef<OpenReference>[] = [
  {
    key: "kind",
    header: "Loại chứng từ",
    className: "min-w-44 text-ink-secondary",
    cell: (row) => openReferenceKindLabel(row.kind),
  },
  {
    key: "documentNumber",
    header: "Số chứng từ",
    className: `min-w-52 text-ink-primary font-medium ${MONO}`,
    cell: (row) => row.documentNumber,
  },
  {
    key: "sku",
    header: "SKU",
    className: `min-w-36 text-ink-secondary ${MONO}`,
    cell: (row) => row.sku,
  },
];
