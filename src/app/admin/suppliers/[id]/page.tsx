"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  ArrowLeft,
  Building2,
  Contact,
  FileText,
  Landmark,
  MapPin,
  Star,
  ShoppingCart,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { toast } from "@/components/shared/Toast";
import {
  suppliers,
  purchaseOrders,
  formatVND,
  type Supplier,
  type PurchaseOrder,
  type Currency,
  CURRENCY_SYMBOL,
} from "@/lib/mock-data";
import { StatusDot } from "@/components/shared/StatusDot";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatMoney(amount: number, currency: Currency): string {
  if (currency === "VND") return formatVND(amount);
  if (currency === "USD")
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  return `${CURRENCY_SYMBOL[currency]}${amount.toLocaleString()}`;
}

function InfoRow({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border-default flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="text-ink-tertiary shrink-0 text-xs">{label}</span>
      {children ?? (
        <span
          className={cn(
            "text-ink-primary text-right text-[0.8125rem] font-medium",
            mono && "font-[family-name:var(--font-mono)]",
          )}
        >
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

function fullAddress(supplier: Supplier) {
  const { street, ward, district, province, postalCode } = supplier.address;
  return [street, ward, district, province, postalCode].filter(Boolean).join(", ");
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);

  const supplier = suppliers.find((s) => s.supplierId === id);

  const relatedPOs = useMemo(
    () => (supplier ? purchaseOrders.filter((po) => po.supplierId === supplier.supplierId) : []),
    [supplier],
  );

  const poStats = useMemo(() => {
    const total = relatedPOs.length;
    const totalValue = relatedPOs
      .filter((po) => po.currency === "VND")
      .reduce((s, po) => s + po.grandTotal, 0);
    const open = relatedPOs.filter(
      (po) => !["Closed", "Cancelled", "Received"].includes(po.status),
    ).length;
    return { total, totalValue, open };
  }, [relatedPOs]);

  const poColumns: ColumnDef<PurchaseOrder>[] = [
    {
      key: "poNumber",
      header: "Mã PO",
      sortable: true,
      compare: (a, b) => a.poNumber.localeCompare(b.poNumber),
      cell: (row) => (
        <Link
          href={`/admin/purchase-orders/${row.poId}`}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {row.poNumber}
        </Link>
      ),
    },
    {
      key: "orderDate",
      header: "Ngày đặt",
      sortable: true,
      compare: (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime(),
      cell: (row) => (
        <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
          {new Date(row.orderDate).toLocaleDateString("vi-VN")}
        </span>
      ),
    },
    {
      key: "grandTotal",
      header: "Tổng tiền",
      align: "right",
      sortable: true,
      compare: (a, b) => a.grandTotal - b.grandTotal,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
          {formatMoney(row.grandTotal, row.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => <StatusDot domain="po" status={row.status} withIcon />,
    },
  ];

  if (!supplier) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy NCC"
          subtitle="Nhà cung cấp không tồn tại hoặc đã bị xoá khỏi dữ liệu mock."
        />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <Building2 className="mb-3 size-12 opacity-40" />
          <p className="text-[0.8125rem]">
            Nhà cung cấp{" "}
            <code className="bg-bg-muted text-ink-primary rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)]">
              {id}
            </code>{" "}
            không tồn tại trong mock data.
          </p>
          <Link
            href="/admin/suppliers"
            className="text-accent mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={supplier.name}
        subtitle={`Mã NCC: ${supplier.supplierId} · MST: ${supplier.taxCode}`}
        actions={
          <Link
            href="/admin/suppliers"
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {/* Profile + Contact */}
          <div className="grid gap-5 md:grid-cols-2">
            <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <Building2 className="text-accent size-4" />
                Hồ sơ NCC
              </h2>
              <div className="divide-border-default mt-3 divide-y">
                <InfoRow label="Mã NCC" value={supplier.supplierId} mono />
                <InfoRow label="Tên NCC" value={supplier.name} />
                <InfoRow label="MST" value={supplier.taxCode} mono />
                <InfoRow label="Trạng thái">
                  <StatusDot domain="product" status={supplier.active ? "Active" : "Inactive"} />
                </InfoRow>
              </div>
            </section>

            <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <Contact className="text-accent size-4" />
                Liên hệ
              </h2>
              <div className="divide-border-default mt-3 divide-y">
                <InfoRow label="Người liên hệ" value={supplier.contactName} />
                <InfoRow label="Email" value={supplier.contactEmail} />
                <InfoRow label="Điện thoại" value={supplier.contactPhone} mono />
              </div>
            </section>
          </div>

          {/* Address */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
              <MapPin className="text-accent size-4" />
              Địa chỉ
            </h2>
            <div className="divide-border-default mt-3 divide-y">
              <InfoRow label="Đường / số nhà" value={supplier.address.street} />
              <InfoRow label="Phường / xã" value={supplier.address.ward} />
              <InfoRow label="Quận / huyện" value={supplier.address.district} />
              <InfoRow label="Tỉnh / TP" value={supplier.address.province} />
              <InfoRow label="Mã bưu chính" value={supplier.address.postalCode} mono />
            </div>
            <div className="border-border-default bg-bg-subtle text-ink-secondary mt-3 rounded-[var(--r-sm)] border px-3 py-2 text-xs">
              {fullAddress(supplier)}
            </div>
          </section>

          {/* Related POs */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="text-accent size-4" />
                Đơn đặt hàng liên quan
                <span className="bg-bg-subtle text-ink-secondary rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
                  {relatedPOs.length}
                </span>
              </h2>
              <Link
                href="/admin/purchase-orders"
                className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                Xem tất cả PO
                <ExternalLink className="size-3" />
              </Link>
            </div>
            {relatedPOs.length > 0 ? (
              <DataTable
                data={relatedPOs}
                columns={poColumns}
                rowKey={(row) => row.poId}
                caption={`Hiển thị ${relatedPOs.length} đơn đặt hàng`}
                pageSize={15}
              />
            ) : (
              <div className="text-ink-tertiary flex flex-col items-center py-10">
                <FileText className="mb-2 size-8 opacity-40" />
                <p className="text-[0.8125rem]">Chưa có đơn đặt hàng nào từ NCC này.</p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-5">
          {/* Action Card */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <div className="mb-4 flex justify-center">
              <StatusDot
                domain="product"
                status={supplier.active ? "Active" : "Inactive"}
                size="md"
              />
            </div>
            <div className="space-y-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  toast.success("Mock action", `Cập nhật hồ sơ ${supplier.supplierId} là UI-only.`)
                }
                className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse flex w-full items-center justify-center gap-2 rounded-[var(--r-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors"
              >
                Cập nhật hồ sơ
              </Button>
              {supplier.active ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    toast.warning("Mock action", `Tạm ngưng ${supplier.supplierId} là UI-only.`)
                  }
                  className="border-danger/30 bg-bg-surface text-danger hover:bg-danger/5 flex w-full items-center justify-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium transition-colors"
                >
                  Tạm ngưng NCC
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    toast.success("Mock action", `Kích hoạt lại ${supplier.supplierId} là UI-only.`)
                  }
                  className="border-positive/30 bg-bg-surface text-positive hover:bg-positive/5 flex w-full items-center justify-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium transition-colors"
                >
                  Kích hoạt lại
                </Button>
              )}
            </div>
          </section>

          {/* Terms Card */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary flex items-center gap-2 text-sm font-semibold">
              <Landmark className="text-accent size-4" />
              Điều khoản thương mại
            </h2>
            <div className="divide-border-default mt-3 divide-y">
              <InfoRow label="Thanh toán" value={supplier.paymentTerms} />
              <InfoRow label="Tiền tệ PO" value={supplier.currency} mono />
              <InfoRow label="Lead time" value={`${supplier.leadTimeDays} ngày`} />
              <InfoRow label="Rating">
                <span className="text-ink-primary inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
                  <Star className="text-warning size-3.5" />
                  {supplier.rating.toFixed(1)} / 5.0
                </span>
              </InfoRow>
            </div>
          </section>

          {/* Quick stats */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary text-sm font-semibold">Thống kê PO</h2>
            <div className="divide-border-default mt-3 divide-y">
              <InfoRow label="Tổng PO" value={poStats.total.toString()} />
              <InfoRow label="PO đang mở" value={poStats.open.toString()} />
              <InfoRow label="Tổng giá trị (VND)" value={formatVND(poStats.totalValue)} mono />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
