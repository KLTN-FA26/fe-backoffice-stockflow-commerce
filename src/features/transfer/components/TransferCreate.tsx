"use client";

import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, TRANSFER_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCreateTransferOrder } from "@/features/transfer/mutations";

import { EMPTY_TRANSFER_FORM, TransferForm } from "./form/TransferForm";
import { TransferPermissionGate } from "./TransferPermissionGate";

const L = UI_LABELS.transfer;

function TransferCreateBody() {
  const router = useRouter();
  const create = useCreateTransferOrder();
  return (
    // Giao diện kiểu Vercel như wizard sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có tên trang; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{L.createTitle}</h1>
      <TransferForm
        defaultValues={EMPTY_TRANSFER_FORM}
        submitLabel={L.action.create}
        cancelHref={ADMIN_ROUTES.transfers.list}
        // Thành công → giữ khoá tới khi chuyển trang, không cho tạo lệnh thứ hai
        isPending={create.isPending || create.isSuccess}
        onSubmit={async (values) => {
          const transfer = await create.mutateAsync(values);
          router.push(ADMIN_ROUTES.transfers.detail(transfer.transferId));
        }}
      />
    </div>
  );
}

/** Tạo lệnh DRAFT — cần `inventory-transfer-orders:CREATE` (Inventory Planner / quản lý kho). */
export function TransferCreate() {
  return (
    <TransferPermissionGate
      permissions={[TRANSFER_PERMISSIONS.viewPage, TRANSFER_PERMISSIONS.create]}
      variant="form"
    >
      <TransferCreateBody />
    </TransferPermissionGate>
  );
}
