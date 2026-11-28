"use client";

import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";

import {
  CHANGE_TYPE_LABEL,
  changedFieldLabel,
  historyActorLabel,
  historyStatusLabel,
} from "../lifecycle-labels";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ProductVersion } from "../lifecycle-schemas";

const MONO = "font-[family-name:var(--font-mono)]";
const N = UI_LABELS.product.names;

/** Dòng "từ → đến" của một lần đổi trạng thái; trống nếu dòng không đổi trạng thái. */
function StatusMove({ entry }: { entry: ProductVersion }) {
  if (!entry.toStatus) return null;
  return (
    <span className="text-ink-secondary inline-flex items-center gap-1 text-xs">
      {entry.fromStatus && (
        <>
          {historyStatusLabel(entry.fromStatus)}
          <ArrowRight className="size-3" aria-label="chuyển sang" />
        </>
      )}
      <span className="text-ink-primary font-medium">{historyStatusLabel(entry.toStatus)}</span>
    </span>
  );
}

/**
 * Nhãn một mục `changedFields`. Dòng đơn vị bán / quy đổi đơn vị tính BE ghi `unit:<mã ĐVT>` (vd
 * `unit:THUNG`) — hiện "Đơn vị: THUNG" thay vì chuỗi kỹ thuật; còn lại tra `changedFieldLabel`.
 */
function fieldLabel(field: string): string {
  return field.startsWith("unit:")
    ? `Đơn vị: ${field.slice("unit:".length)}`
    : changedFieldLabel(field);
}

/**
 * SKU mà dòng lịch sử nói tới: `subjectSku` BE trả kèm (issue #286); BE cũ chưa có thì tra `skuById`
 * (`subjectId` = variantId) từ danh sách biến thể trang đã tải sẵn. Dòng của sản phẩm thì rỗng.
 */
export function historySku(row: ProductVersion, skuById: ReadonlyMap<string, string>): string {
  if (row.subjectSku) return row.subjectSku;
  return row.subjectId ? (skuById.get(row.subjectId) ?? "") : "";
}

/**
 * Cột bảng lịch sử, mỗi ý một cột theo thứ tự đọc của một dòng nhật ký ERP: khi nào → loại thay đổi →
 * biến thể nào → nội dung thay đổi → ai làm → vì sao. Độ rộng tối thiểu để bảng cuộn ngang trên màn hẹp.
 */
export const historyColumns = (
  skuById: ReadonlyMap<string, string>,
): ColumnDef<ProductVersion>[] => [
  {
    key: "occurredAt",
    header: "Thời gian",
    className: "min-w-40 whitespace-nowrap",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.occurredAt)}</span>,
  },
  {
    key: "changeType",
    header: "Loại thay đổi",
    className: "min-w-40 text-ink-primary font-medium",
    cell: (row) => CHANGE_TYPE_LABEL[row.changeType],
  },
  {
    key: "sku",
    header: "Biến thể",
    className: `min-w-32 ${MONO}`,
    cell: (row) => {
      const sku = historySku(row, skuById);
      // `subjectLabel` (issue #286): tên biến thể hoặc tên file ảnh — dòng phụ dưới SKU
      const label = row.subjectLabel;
      if (!sku && !label) {
        return (
          <span className="text-ink-tertiary font-[family-name:var(--font-sans)]">
            {row.subjectId ? N.historyDeletedSubject : N.historyProductRow}
          </span>
        );
      }
      return (
        <div className="space-y-0.5">
          {sku && <div className="text-ink-primary font-medium">{sku}</div>}
          {label && (
            <div className="text-ink-tertiary font-[family-name:var(--font-sans)] text-xs">
              {label}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: "detail",
    header: "Nội dung thay đổi",
    className: "min-w-48",
    cell: (row) => {
      const fields = row.changedFields?.map(fieldLabel).join(", ");
      if (!row.toStatus && !fields) return <span className="text-ink-tertiary">—</span>;
      return (
        <div className="space-y-0.5">
          <StatusMove entry={row} />
          {fields && <div className="text-ink-tertiary text-xs">{fields}</div>}
        </div>
      );
    },
  },
  {
    key: "actor",
    header: "Người thực hiện",
    className: "min-w-40",
    cell: (row) => historyActorLabel(row.actorName),
  },
  {
    key: "reason",
    header: "Lý do",
    className: "min-w-56 text-ink-secondary whitespace-normal",
    cell: (row) => row.reason || "—",
  },
];
