"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES, GOODS_RECEIPT_PERMISSIONS, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

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
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.receipts.list}>
              <ArrowLeft className="size-3.5" /> {UI_LABELS.common.backToList}
            </Link>
          </Button>
        }
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
