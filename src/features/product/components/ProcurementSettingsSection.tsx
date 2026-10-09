import Link from "next/link";
import { Truck } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { SkuProcurementSettingsView } from "../procurement-settings/view-model";

const MISSING = "Chưa có dữ liệu";

function showNumber(value: number | null, suffix = "") {
  return value === null ? MISSING : `${value.toLocaleString("vi-VN")}${suffix}`;
}

export function ProcurementSettingsSection({
  settings,
  isMock,
}: {
  settings: SkuProcurementSettingsView;
  isMock: boolean;
}) {
  const defaultSupplier = settings.suppliers.find(
    (supplier) => supplier.supplierId === settings.defaultSupplierId,
  );

  return (
    <section aria-labelledby="procurement-settings-heading">
      <Card>
        <h2
          id="procurement-settings-heading"
          className="text-ink-primary mb-2 flex items-center gap-2 text-[0.9375rem] font-semibold"
        >
          <Truck className="text-accent size-4" aria-hidden="true" />
          Cài đặt mua hàng
        </h2>
        <p className="text-ink-tertiary mb-3 text-xs">
          {isMock ? "Dữ liệu minh hoạ · Chỉ xem" : "Chỉ xem · Chờ kết nối dữ liệu mua hàng"}
        </p>
        <dl className="border-border-default mb-4 grid gap-3 border-b pb-3 text-[0.8125rem] sm:grid-cols-2">
          <div>
            <dt className="text-ink-tertiary text-xs">Nhà cung cấp mặc định</dt>
            <dd className="text-ink-primary mt-1">{defaultSupplier?.supplierName ?? MISSING}</dd>
          </div>
          <div>
            <dt className="text-ink-tertiary text-xs">Điểm đặt hàng lại</dt>
            <dd className="text-ink-primary mt-1 tabular-nums">
              {showNumber(settings.reorderPoint)}
            </dd>
          </div>
        </dl>
        {settings.suppliers.length === 0 ? (
          <EmptyState
            title="Chưa có nhà cung cấp liên kết"
            description="Chưa có dữ liệu liên kết nhà cung cấp cho SKU này."
          />
        ) : (
          <Table>
            <TableCaption>Nhà cung cấp liên kết với SKU {settings.skuId}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Nhà cung cấp</TableHead>
                <TableHead scope="col">Mã hàng NCC</TableHead>
                <TableHead scope="col">Thời gian giao</TableHead>
                <TableHead scope="col">MOQ</TableHead>
                <TableHead scope="col">Bội số đặt hàng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.suppliers.map((supplier) => (
                <TableRow key={supplier.supplierId}>
                  <TableCell>
                    <Link
                      href={ADMIN_ROUTES.suppliers.detail(supplier.supplierId)}
                      className="text-accent hover:underline"
                    >
                      {supplier.supplierName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-[family-name:var(--font-mono)]">
                    {supplier.supplierItemCode ?? MISSING}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {showNumber(supplier.leadTimeDays, " ngày")}
                  </TableCell>
                  <TableCell className="tabular-nums">{showNumber(supplier.moq)}</TableCell>
                  <TableCell className="tabular-nums">
                    {showNumber(supplier.orderMultiple)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}
