"use client";

import { Plus, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { RowsEditorStatus } from "./useRowsEditor";

const T = UI_LABELS.shipping.waybill.carriers.config.table;

/**
 * Khung một bảng dòng sửa được của hộp thoại hãng: tiêu đề + mô tả, trạng thái tải (đang tải / lỗi tải có "Thử lại" — bảng
 * chưa đọc thì KHÔNG cho sửa để không ghi đè cả danh sách đã lưu), nút thêm dòng.
 */
export function RowsSection({
  id,
  title,
  description,
  status,
  onRetry,
  addLabel,
  onAdd,
  isEmpty,
  emptyText,
  notice,
  children,
}: {
  id: string;
  title: string;
  description: string;
  status: RowsEditorStatus;
  onRetry: () => void;
  addLabel: string;
  onAdd: () => void;
  isEmpty: boolean;
  emptyText: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0">
      <h3 id={`${id}-title`} className="text-ink-primary text-[0.8125rem] font-semibold">
        {title}
      </h3>
      <p className="text-ink-secondary mt-0.5 mb-2 text-xs">{description}</p>
      {notice && <p className="text-ink-tertiary mb-2 text-xs">{notice}</p>}
      {status === "loading" && (
        <p role="status" className="text-ink-tertiary text-xs">
          {T.loading}
        </p>
      )}
      {status === "error" && (
        <Alert tone="warning">
          {T.loadFailed}{" "}
          <Button variant="link" size="sm" onClick={onRetry} className="h-auto p-0" type="button">
            {T.retry}
          </Button>
        </Alert>
      )}
      {status === "ready" && (
        <>
          {isEmpty ? (
            <p className="text-ink-tertiary border-border-default rounded-[var(--r-sm)] border border-dashed px-3 py-2.5 text-xs">
              {emptyText}
            </p>
          ) : (
            <div className="overflow-x-auto">{children}</div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onAdd} className="mt-2">
            <Plus aria-hidden />
            {addLabel}
          </Button>
        </>
      )}
    </section>
  );
}

/** Nút xoá một dòng. */
export function RemoveRowButton({ index, onClick }: { index: number; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={T.removeAria(index + 1)}
      title={T.remove}
    >
      <Trash2 aria-hidden />
    </Button>
  );
}

/** Cột của bảng dòng sửa được: nhãn + bề rộng (tỉ lệ) — bảng chia cột cố định để ô chọn dài không đẩy nút xoá ra ngoài khung. */
export interface RowsColumn {
  label: string;
  /** Lớp Tailwind bề rộng, vd `w-[30%]`. */
  width: string;
}

/** Dòng tiêu đề cột của bảng dòng sửa được. */
export function RowsHead({ columns }: { columns: readonly RowsColumn[] }) {
  return (
    <thead>
      <tr className="bg-bg-subtle text-ink-tertiary text-left text-xs">
        {columns.map((column) => (
          <th key={column.label} scope="col" className={`${column.width} px-1.5 py-2 font-medium`}>
            {column.label}
          </th>
        ))}
        <th scope="col" className="w-9 px-1.5 py-2">
          <span className="sr-only">{T.remove}</span>
        </th>
      </tr>
    </thead>
  );
}
