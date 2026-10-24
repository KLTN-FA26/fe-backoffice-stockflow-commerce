"use client";

import { ADMIN_ROUTES, GOODS_RECEIPT_PERMISSIONS, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";

import { ReceiptCreateForm } from "./create/ReceiptCreateForm";
import { ReceiptLoadError } from "./ReceiptLoadError";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

function ReceiptCreateContent() {
  // Hướng 2 (đã chốt): giữ seed BE — thiếu purchase-orders:READ thì báo rõ, không gọi API PO
  const canReadPo = useCan(PO_PERMISSIONS.read);
  return (
    <>
      <PageHeader
        title={UI_LABELS.receipt.action.create}
        subtitle="Chọn đơn đặt hàng đã chốt để bắt đầu kiểm đếm hàng về."
        actions={<BackLink href={ADMIN_ROUTES.receipts.list} />}
      />
      {canReadPo ? (
        <ReceiptCreateForm />
      ) : (
        <ReceiptLoadError inline error={null} kind="no-po-read" />
      )}
    </>
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
