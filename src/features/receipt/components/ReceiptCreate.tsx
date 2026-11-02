"use client";

import Link from "next/link";
import { cn } from "cn";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, GOODS_RECEIPT_PERMISSIONS, PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { RECEIPT_CREATE_WITHOUT_PO_PERMISSIONS } from "@/features/receipt/lifecycle";

import { ReceiptCreateForm } from "./create/ReceiptCreateForm";
import { ReceiptCreateWithoutPoForm } from "./create/ReceiptCreateWithoutPoForm";
import { ReceiptLoadError } from "./ReceiptLoadError";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

const MODES = ["po", "without-po"] as const;
const L = UI_LABELS.receipt.blind;

const TAB =
  "rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors";

function ReceiptCreateContent() {
  // Hướng 2 (đã chốt): giữ seed BE — thiếu purchase-orders:READ thì báo rõ, không gọi API PO
  const canReadPo = useCan(PO_PERMISSIONS.read);
  const can = usePermissionChecker();
  // BR-RCP-002 (SCRUM-478): hàng về không có PO — cần thêm quyền xem NCC và kho để chọn
  const canWithoutPo = RECEIPT_CREATE_WITHOUT_PO_PERMISSIONS.every(can);
  const [mode, setMode] = useQueryState("mode", parseAsStringLiteral(MODES).withDefault("po"));
  const withoutPo = mode === "without-po";
  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên trang và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{UI_LABELS.receipt.action.create}</h1>
      {canWithoutPo && (
        <div role="tablist" aria-label="Loại phiếu nhận" className="mb-4 flex gap-2">
          <Link
            href={ADMIN_ROUTES.receipts.create}
            role="tab"
            aria-selected={!withoutPo}
            onClick={(event) => {
              event.preventDefault();
              void setMode("po");
            }}
            className={cn(
              TAB,
              !withoutPo ? "border-brand bg-brand text-ink-inverse" : "border-border-default",
            )}
          >
            {L.modeWithPo}
          </Link>
          <Link
            href={ADMIN_ROUTES.receipts.createWithoutPo}
            role="tab"
            aria-selected={withoutPo}
            onClick={(event) => {
              event.preventDefault();
              void setMode("without-po");
            }}
            className={cn(
              TAB,
              withoutPo ? "border-brand bg-brand text-ink-inverse" : "border-border-default",
            )}
          >
            {L.modeWithoutPo}
          </Link>
        </div>
      )}
      {withoutPo ? (
        canWithoutPo ? (
          <ReceiptCreateWithoutPoForm />
        ) : (
          <ReceiptLoadError inline error={null} kind="no-blind-lookup" />
        )
      ) : canReadPo ? (
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
