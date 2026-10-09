"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import {
  qcRequiredLineCount,
  statusAfterConfirm,
  totalReceivedQuantity,
} from "@/features/receipt/selectors";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { ReceiptLoadError } from "../ReceiptLoadError";
import { CountSection } from "./ReceiptInfo";
import { ReceiptLinesTable } from "./ReceiptLinesTable";

import type { GoodsReceipt } from "@/features/receipt/types";

const L = UI_LABELS.receipt;

/**
 * Phiếu DRAFT (docs 03 bước 3–6). `PUT /goods-receipts/{id}/lines` trả lại phiếu với dòng đã lưu:
 * BE chuẩn hoá mã vị trí, gắn SKU / số dòng PO và chốt `qcRequired` (luồng 2 hay 3 bước) theo cờ
 * SKU. Vì vậy sau khi lưu màn hiện KẾT QUẢ từ BE (không phải form vừa nhập) + phiếu sẽ sang trạng
 * thái nào khi xác nhận; form chỉ mở khi chưa có dòng nào hoặc bấm "Sửa kiểm đếm".
 */
export function DraftCountPanel({
  receipt,
  canCount,
  canUpdate,
  onDirtyChange,
}: {
  receipt: GoodsReceipt;
  /** Có quyền lưu kiểm đếm (gồm purchase-orders:READ để đọc dòng PO). */
  canCount: boolean;
  /** Có goods-receipts:UPDATE — dùng để báo thiếu quyền đọc PO thay vì ẩn im lặng. */
  canUpdate: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const hasSaved = receipt.lines.length > 0;
  const [editing, setEditing] = useState(!hasSaved);
  const close = () => {
    onDirtyChange(false);
    setEditing(false);
  };

  if (canCount && (editing || !hasSaved)) {
    return (
      <CountSection
        receipt={receipt}
        onDirtyChange={onDirtyChange}
        onSaved={close}
        onCancel={hasSaved ? close : undefined}
      />
    );
  }

  const next = statusAfterConfirm(receipt);
  const qcLines = qcRequiredLineCount(receipt);
  return (
    <Section
      title={L.countSaved}
      description={L.countSavedDescription}
      actions={
        canCount ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> {L.editCount}
          </Button>
        ) : undefined
      }
    >
      {!canCount && canUpdate && (
        <div className="mb-3">
          <ReceiptLoadError inline error={null} kind="no-po-read" />
        </div>
      )}
      {hasSaved ? (
        <>
          <ReceiptLinesTable receipt={receipt} draft />
          <p className="text-ink-secondary mt-3 text-[0.8125rem]" aria-live="polite">
            Tổng{" "}
            <span className="text-ink-primary font-semibold tabular-nums">
              {totalReceivedQuantity(receipt)}
            </span>{" "}
            đơn vị trên {receipt.lines.length} dòng · {qcLines} dòng cần QC. Sau khi xác nhận nhập
            kho, phiếu chuyển sang{" "}
            <span className="text-ink-primary font-medium">“{STATUS_LABEL_VI[next] ?? next}”</span>.
          </p>
        </>
      ) : (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.noCountLines}</p>
      )}
    </Section>
  );
}
