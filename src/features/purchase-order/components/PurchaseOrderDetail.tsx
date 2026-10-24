"use client";

import { useRouter } from "next/navigation";
import { Package } from "lucide-react";

import { ADMIN_ROUTES, PO_PERMISSIONS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { PoActionPanel } from "./detail/PoActionPanel";
import { PoDeliveryCard } from "./detail/PoDeliveryCard";
import { PoDetailDialogs } from "./detail/PoDetailDialogs";
import { PoGeneralInfo } from "./detail/PoGeneralInfo";
import { PoLifecycleTimeline } from "./detail/PoLifecycleTimeline";
import { PoLinesTable } from "./detail/PoLinesTable";
import { PoOverview } from "./detail/PoOverview";
import { PoSupplierInfo } from "./detail/PoSupplierInfo";
import { PoTotals } from "./detail/PoTotals";
import { usePoDetail } from "./detail/usePoDetail";
import { PoLoadError } from "./PoLoadError";
import { PoPermissionGate } from "./PoPermissionGate";

export function PurchaseOrderDetail({ id }: { id: string }) {
  return (
    <PoPermissionGate permissions={[PO_PERMISSIONS.viewPage]}>
      <PurchaseOrderDetailBody id={id} />
    </PoPermissionGate>
  );
}

function PurchaseOrderDetailBody({ id }: { id: string }) {
  const d = usePoDetail(id);
  const router = useRouter();

  if (!d.canRead) return <PoLoadError error={null} kind="no-read" />;
  if (d.poQuery.isPending) return <PageSkeleton variant="detail" />;
  if (!d.po) {
    return <PoLoadError error={d.poQuery.error} onRetry={() => void d.poQuery.refetch()} />;
  }
  const po = d.po;
  const supplierName = d.supplierName;

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số PO và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{po.poNumber}</h1>
      {d.isDuplicate && (
        <Alert tone="warning" title="Cảnh báo trùng lặp (BR-PO-003)" className="mb-5">
          PO này có cùng NCC + ngày giao dự kiến + SKU với một đơn mở khác.
        </Alert>
      )}
      {/* min-w-0: cột lưới không giãn theo nội dung (bảng, tên NCC dài) → hết tràn ngang < 1280px. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
            <PoGeneralInfo po={po} />
            <PoSupplierInfo po={po} supplier={d.supplier} supplierName={supplierName} />
          </div>
          <section className="border-border-default bg-bg-surface min-w-0 rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
            <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-3.5" />
              Dòng hàng
            </h2>
            <PoLinesTable lines={po.lines} />
          </section>
          {/* Lịch sử gửi NCC nhiều thông tin → cột chính (rộng) */}
          <PoDeliveryCard po={po} />
          <PoTotals po={po} />
        </div>
        <div className="min-w-0 space-y-5">
          <PoActionPanel
            status={po.status}
            actions={d.actions}
            isMutating={d.isMutating}
            conflictError={d.conflictError}
            // "Nhận hàng" = tạo phiếu nhận cho PO này (SCRUM-436), không còn dialog nhận thẳng;
            // "Sửa nháp" = màn sửa PO nháp (BE SCRUM-462). Còn lại mở dialog xác nhận.
            onAction={(act) => {
              if (act.code === "receive") router.push(ADMIN_ROUTES.receipts.createFromPo(po.poId));
              else if (act.code === "edit") router.push(ADMIN_ROUTES.purchaseOrders.edit(po.poId));
              else d.open(act.code);
            }}
          />
          <PoOverview po={po} />
          <PoLifecycleTimeline status={po.status} />
        </div>
      </div>
      <PoDetailDialogs po={po} supplierName={supplierName} a={d} />
    </div>
  );
}
