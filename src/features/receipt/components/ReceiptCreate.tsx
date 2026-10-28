"use client";

import { GOODS_RECEIPT_PERMISSIONS, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";

import { ReceiptCreateForm } from "./create/ReceiptCreateForm";
import { ReceiptLoadError } from "./ReceiptLoadError";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

function ReceiptCreateContent() {
  // Hướng 2 (đã chốt): giữ seed BE — thiếu purchase-orders:READ thì báo rõ, không gọi API PO
  const canReadPo = useCan(PO_PERMISSIONS.read);
  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên trang và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{UI_LABELS.receipt.action.create}</h1>
      {canReadPo ? (
        <ReceiptCreateForm />
      ) : (
        <ReceiptLoadError inline error={null} kind="no-po-read" />
      )}
    </div>
  );
}

export function ReceiptCreate() {
  return (
    <ReceiptPermissionGate
      permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage, GOODS_RECEIPT_PERMISSIONS.create]}
      variant="form"
    >
      <ReceiptCreateContent />
    </ReceiptPermissionGate>
  );
}
