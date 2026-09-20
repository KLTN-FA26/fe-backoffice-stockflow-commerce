"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Power, RotateCcw } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusDot } from "@/components/shared/StatusDot";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/shared/Card";
import { useSupplier, useToggleSupplierStatus } from "@/features/supplier";
import type { SupplierDto } from "@/features/supplier";

/* ── Info rows ────────────────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-default/60 flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-ink-secondary shrink-0 text-[0.8125rem]">{label}</span>
      <span className="text-ink-primary text-right text-[0.875rem] font-medium">{value}</span>
    </div>
  );
}

function AddressBlock({ address }: { address: SupplierDto["address"] }) {
  const line1 = `${address.street}, ${address.ward}`;
  const line2 = `${address.district}, ${address.province} ${address.postalCode}`;
  return (
    <div className="text-ink-primary text-[0.875rem] font-medium">
      <div>{line1}</div>
      <div>{line2}</div>
      <div className="text-ink-secondary text-[0.8125rem]">{address.country}</div>
    </div>
  );
}

/* ── Detail ───────────────────────────────────────────────────────────── */

export function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params);
  const router = useRouter();
  const [confirming, setConfirming] = useState<"activate" | "deactivate" | null>(null);
  const { data: supplier, isLoading, isError } = useSupplier(supplierId);
  const { mutate: toggleStatus } = useToggleSupplierStatus();

  if (isLoading) return <PageSkeleton />;
  if (isError || !supplier) {
    return (
      <EmptyState
        title="Không tìm thấy nhà cung cấp"
        description="Mã nhà cung cấp không tồn tại hoặc đã bị xoá."
        action={
          <Button variant="outline" size="sm" onClick={() => router.push(ADMIN_ROUTES.suppliers)}>
            Về danh sách
          </Button>
        }
      />
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
        subtitle={`${supplier.supplierId} — quản lý hồ sơ nhà cung cấp`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push(ADMIN_ROUTES.suppliers)}>
              <ArrowLeft size={16} className="mr-1" />
              Danh sách
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`${ADMIN_ROUTES.suppliers}/create`)}
            >
              <Pencil size={16} className="mr-1" />
              Chỉnh sửa
            </Button>
            {isActive ? (
              <Button
                size="sm"
                variant="outline"
                className="border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => setConfirming("deactivate")}
              >
                <Power size={16} className="mr-1" />
                Vô hiệu hoá
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirming("activate")}>
                <RotateCcw size={16} className="mr-1" />
                Kích hoạt
              </Button>
            )}
          </div>
        }
      />

      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-border-default mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-ink-primary font-semibold">Thông tin chung</h2>
            <StatusDot domain="sku" status={supplier.status} />
          </div>
          <InfoRow label="Mã nhà cung cấp" value={supplier.supplierId} />
          <InfoRow label="Mã số thuế" value={supplier.taxCode} />
          <InfoRow label="Điều khoản thanh toán" value={supplier.paymentTerms} />
          <InfoRow label="Tiền tệ" value={supplier.currency} />
          <InfoRow label="Lead time" value={`${supplier.leadTimeDays} ngày`} />
          <InfoRow label="Đánh giá" value={`${supplier.rating.toFixed(1)} / 5`} />
        </Card>

        <Card>
          <div className="border-border-default mb-3 border-b pb-2">
            <h2 className="text-ink-primary font-semibold">Liên hệ</h2>
          </div>
          <InfoRow label="Người liên hệ" value={supplier.contactName} />
          <InfoRow label="Email" value={supplier.contactEmail} />
          <InfoRow label="Điện thoại" value={supplier.contactPhone} />
          <InfoRow label="Địa chỉ" value="" />
          <div className="mt-1 text-right">
            <AddressBlock address={supplier.address} />
          </div>
        </Card>
      </div>

      <Card className="mt-4 max-w-4xl">
        <div className="border-border-default mb-3 border-b pb-2">
          <h2 className="text-ink-primary font-semibold">Đơn đặt hàng đang mở</h2>
        </div>
        {openPoCount > 0 ? (
          <p className="text-ink-secondary text-[0.875rem]">
            Nhà cung cấp này có {openPoCount} đơn đặt hàng chưa đóng.
            {isActive && (
              <>
                {" "}
                Nếu vô hiệu hoá, hệ thống sẽ cảnh báo hoặc chặn tuỳ nghiệp vụ backend (SCRUM-118).
              </>
            )}
          </p>
        ) : (
          <p className="text-ink-secondary text-[0.875rem]">
            Không có đơn đặt hàng nào đang mở. Có thể vô hiệu hoá nhà cung cấp này.
          </p>
        )}
      </Card>

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
        onConfirm={handleConfirmToggle}
      />
    </>
  );
}
