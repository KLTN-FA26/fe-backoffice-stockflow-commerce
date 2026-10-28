"use client";

import { useState } from "react";

import {
  useActivateSupplier,
  useBlacklistSupplier,
  useDeactivateSupplier,
} from "@/features/supplier";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { ContactChannelCard } from "./ContactChannelCard";
import { GeneralInfoCard } from "./GeneralInfoCard";
import { LifecycleSection } from "./LifecycleSection";
import { PurchaseOrdersSection } from "./PurchaseOrdersSection";
import { ActionCard, OverviewCard } from "./SidebarCards";
import { TermsOpsCard } from "./TermsOpsCard";

import type { PermissionCode } from "@/lib/auth";
import type { SupplierActionKey } from "@/features/supplier/lifecycle";
import type { SupplierDto } from "@/features/supplier/types";

const CONFIRM_DIALOG: Record<
  SupplierActionKey,
  { title: string; description: string; confirmLabel: string; variant: "danger" | "default" }
> = {
  activate: {
    title: "Kích hoạt lại nhà cung cấp?",
    description: "Nhà cung cấp sẽ hoạt động trở lại và xuất hiện trong bộ chọn khi tạo PO.",
    confirmLabel: "Kích hoạt lại",
    variant: "default",
  },
  deactivate: {
    title: "Ngừng hợp tác với nhà cung cấp?",
    description:
      "NCC sẽ không xuất hiện khi tạo PO mới. Nếu NCC còn đơn đặt hàng đang mở, hệ thống sẽ từ chối.",
    confirmLabel: "Ngừng hợp tác",
    variant: "danger",
  },
  blacklist: {
    title: "Đưa nhà cung cấp vào danh sách đen?",
    description:
      "NCC sẽ không nhận PO mới và được đánh dấu không hợp tác lại. Có thể gỡ bằng Kích hoạt lại.",
    confirmLabel: "Đưa vào danh sách đen",
    variant: "danger",
  },
};

/** Tab "Hồ sơ" của chi tiết NCC — thông tin, điều khoản, vòng đời và đổi trạng thái. */
export function SupplierProfileTab({
  supplier,
  can,
}: {
  supplier: SupplierDto;
  can: (code: PermissionCode) => boolean;
}) {
  const [confirming, setConfirming] = useState<SupplierActionKey | null>(null);
  const activate = useActivateSupplier();
  const deactivate = useDeactivateSupplier();
  const blacklist = useBlacklistSupplier();
  const isToggling = activate.isPending || deactivate.isPending || blacklist.isPending;

  const dialog = CONFIRM_DIALOG[confirming ?? "activate"];
  const handleConfirm = () => {
    const onSettled = () => setConfirming(null);
    if (confirming === "deactivate") deactivate.mutate(supplier, { onSettled });
    else if (confirming === "blacklist") blacklist.mutate(supplier, { onSettled });
    else activate.mutate(supplier, { onSettled });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <GeneralInfoCard supplier={supplier} />
            <ContactChannelCard supplier={supplier} />
          </div>
          <TermsOpsCard supplier={supplier} />
          <PurchaseOrdersSection supplierId={supplier.supplierId} />
          <LifecycleSection status={supplier.status} />
        </div>
        <div className="space-y-5">
          <ActionCard
            supplier={supplier}
            can={can}
            isToggling={isToggling}
            onConfirm={setConfirming}
          />
          <OverviewCard supplier={supplier} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        variant={dialog.variant}
        loading={isToggling}
        onConfirm={handleConfirm}
      />
    </>
  );
}
