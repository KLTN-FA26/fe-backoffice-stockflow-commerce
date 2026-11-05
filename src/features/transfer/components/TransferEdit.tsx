"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ADMIN_ROUTES,
  TRANSFER_ERROR_MESSAGES,
  TRANSFER_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { isStaleTransferError } from "@/features/transfer/errors";
import { isTransferEditable } from "@/features/transfer/lifecycle";
import { useUpdateTransferOrder } from "@/features/transfer/mutations";
import { useTransferOrderForEdit } from "@/features/transfer/queries";
import { toTransferFormValues } from "@/features/transfer/selectors";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { TransferForm } from "./form/TransferForm";
import { RefetchErrorNotice } from "./primitives";
import { TransferLoadError } from "./TransferLoadError";
import { TransferPermissionGate } from "./TransferPermissionGate";

const L = UI_LABELS.transfer;

function TransferEditBody({ id }: { id: string }) {
  const router = useRouter();
  const query = useTransferOrderForEdit(id);
  const update = useUpdateTransferOrder();
  // Lệnh đổi ở nơi khác → mutation tải lại lệnh, form dựng lại theo `version` mới. Thông báo giữ ở
  // đây (ngoài form) để không mất cùng lúc với form cũ.
  // Version tại lúc lưu gặp lỗi "dữ liệu cũ": chỉ báo "đã nạp lại" khi bản mới THẬT SỰ về (version đổi)
  const [staleAtVersion, setStaleAtVersion] = useState<number | null>(null);
  useBreadcrumbLabel(id, query.data?.number);

  // Chưa được dựng form từ dữ liệu đã tải ở màn này: chưa có dữ liệu (kể cả đang ở màn lỗi rồi bấm
  // Thử lại), hoặc chỉ có cache từ trang chi tiết — dựng từ cache rồi bản mới về sẽ dựng lại form
  // (key = version), mất phần vừa gõ
  const waiting = !query.data || !query.isFetchedAfterMount;
  // Mất mạng → lần tải bị tạm dừng (không pending / fetching): báo mạng, không skeleton mãi
  if (query.fetchStatus === "paused" && waiting) {
    return <TransferLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
  }
  if (query.isPending || (query.isFetching && waiting)) {
    return <PageSkeleton variant="form" />;
  }
  const transfer = query.data;
  if (!transfer) {
    return <TransferLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  const detailHref = ADMIN_ROUTES.transfers.detail(transfer.transferId);

  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số lệnh; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${L.editTitle} ${transfer.number}`}</h1>
      {query.isError && (
        <RefetchErrorNotice
          onRetry={() => {
            // Bản mới về khác version → form dựng lại, mất phần đang gõ: báo như lỗi dữ liệu cũ
            setStaleAtVersion(transfer.version);
            void query.refetch();
          }}
        />
      )}
      {staleAtVersion !== null &&
        staleAtVersion !== transfer.version &&
        isTransferEditable(transfer.status) && (
          // Form cũ (kèm lỗi trong form) vừa bị dựng lại → thông báo này phải được đọc cho người dùng
          <div role="status" className="mb-4">
            <Alert tone="warning">{L.reloadedNotice}</Alert>
          </div>
        )}
      {isTransferEditable(transfer.status) ? (
        <TransferForm
          // Lệnh tải lại (vd OPTIMISTIC_LOCK) → dựng lại form theo bản mới
          key={transfer.version}
          defaultValues={toTransferFormValues(transfer)}
          submitLabel={L.action.save}
          cancelHref={detailHref}
          isPending={update.isPending || update.isSuccess}
          onSubmit={async (values) => {
            setStaleAtVersion(null);
            try {
              await update.mutateAsync({
                transferId: transfer.transferId,
                version: transfer.version,
                values,
              });
            } catch (error: unknown) {
              if (isStaleTransferError(error)) setStaleAtVersion(transfer.version);
              throw error;
            }
            router.push(detailHref);
          }}
        />
      ) : (
        // SCRUM-462: chỉ sửa lệnh DRAFT (BE TRANSFER_ORDER_NOT_EDITABLE)
        <Alert tone="warning">
          {TRANSFER_ERROR_MESSAGES.TRANSFER_ORDER_NOT_EDITABLE}{" "}
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link href={detailHref}>{L.backToDetail}</Link>
          </Button>
        </Alert>
      )}
    </div>
  );
}

/** Sửa lệnh nháp (mới tạo hoặc bị từ chối về nháp) — cần `inventory-transfer-orders:CREATE`. */
export function TransferEdit({ id }: { id: string }) {
  return (
    <TransferPermissionGate
      permissions={[
        TRANSFER_PERMISSIONS.viewPage,
        TRANSFER_PERMISSIONS.read,
        TRANSFER_PERMISSIONS.create,
      ]}
      variant="form"
    >
      <TransferEditBody id={id} />
    </TransferPermissionGate>
  );
}
