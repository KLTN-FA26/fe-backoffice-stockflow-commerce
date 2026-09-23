"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { useSupplier, useToggleSupplierStatus } from "@/features/supplier";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { ContactAddressCard } from "./supplier-detail/ContactAddressCard";
import { GeneralInfoCard } from "./supplier-detail/GeneralInfoCard";
import { LifecycleSection } from "./supplier-detail/LifecycleSection";
import { OpenPoSection } from "./supplier-detail/OpenPoSection";
import { ActionCard, OverviewCard } from "./supplier-detail/SidebarCards";
import { TermsOpsCard } from "./supplier-detail/TermsOpsCard";

export function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const router = useRouter();
  const [confirming, setConfirming] = useState<"activate" | "deactivate" | null>(null);
  const { data: supplier, isLoading, isError } = useSupplier(supplierId);
  const { mutate: toggleStatus, isPending: isToggling } = useToggleSupplierStatus();

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (isError || !supplier) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy nhà cung cấp"
          subtitle="Mã nhà cung cấp không tồn tại hoặc đã bị xoá."
        />
        <EmptyState
          title="Không tìm thấy nhà cung cấp"
          description="Mã nhà cung cấp không tồn tại hoặc đã bị xoá."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(ADMIN_ROUTES.suppliers.list)}
            >
              Về danh sách
            </Button>
          }
        />
      </>
    );
  }

  const openPoCount = supplier.openPoCount ?? 0;
  const isActive = supplier.status === "Active";
  const deactivating = confirming === "deactivate";
  const handleConfirmToggle = () => {
    if (!confirming || !supplier) return;
    toggleStatus(
      { id: supplier.supplierId, status: confirming === "activate" ? "Active" : "Inactive" },
      { onSuccess: () => setConfirming(null) },
    );
  };

  return (
    <>
      <PageHeader
        title={supplier.name}
        subtitle={`${supplier.supplierId}${supplier.code ? ` · ${supplier.code}` : ""} — hồ sơ nhà cung cấp`}
        actions={
          <Link
            href={ADMIN_ROUTES.suppliers.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Quay lại
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <GeneralInfoCard supplier={supplier} />
            <ContactAddressCard supplier={supplier} />
          </div>
          <TermsOpsCard supplier={supplier} />
          <OpenPoSection openPoCount={openPoCount} isActive={isActive} />
          <LifecycleSection isActive={isActive} />
        </div>

        <div className="space-y-5">
          <ActionCard
            supplier={supplier}
            isActive={isActive}
            isToggling={isToggling}
            onConfirm={setConfirming}
          />
          <OverviewCard supplier={supplier} openPoCount={openPoCount} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={deactivating ? "Vô hiệu hoá nhà cung cấp?" : "Kích hoạt nhà cung cấp?"}
        description={
          deactivating
            ? openPoCount > 0
              ? `Có ${openPoCount} đơn đặt hàng đang mở. Nếu backend chặn, thao tác sẽ báo lỗi — hãy đọc kỹ thông báo.`
              : "Nhà cung cấp sẽ ngừng xuất hiện trong bộ chọn khi tạo đơn mới."
            : "Nhà cung cấp sẽ hoạt động trở lại và xuất hiện trong bộ chọn đơn hàng."
        }
        confirmLabel={deactivating ? "Vô hiệu hoá" : "Kích hoạt"}
        variant={deactivating ? "danger" : "default"}
        loading={isToggling}
        onConfirm={handleConfirmToggle}
      />
    </>
  );
}
