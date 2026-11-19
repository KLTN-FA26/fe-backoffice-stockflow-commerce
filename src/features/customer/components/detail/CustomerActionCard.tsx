"use client";

import Link from "next/link";
import { FilePlus2, FileText, Pencil } from "lucide-react";

import {
  ADMIN_ROUTES,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_STATUS_BY_API,
  QUOTE_PERMISSIONS,
} from "@/constants";
import { canChangeCustomerStatus } from "@/features/customer/lifecycle";
import { DETAIL_ACTION_CLASS, DETAIL_CARD_CLASS } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { CustomerStatusActions } from "./CustomerStatusActions";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Customer } from "@/features/customer/types";

/**
 * Thẻ trạng thái + hành động ở cột phải (cùng bố cục thẻ hành động trang chi tiết sản phẩm): trạng thái hiện tại,
 * sửa hồ sơ, tạo báo giá (chỉ khách đang hoạt động), đổi trạng thái theo vòng đời, rồi liên kết báo giá của khách.
 * Quyền UI-only — Backend phải re-check.
 */
export function CustomerActionCard({
  customer,
  can,
  onEdit,
}: {
  customer: Customer;
  can: (permission: PermissionCode) => boolean;
  onEdit: () => void;
}) {
  const active = customer.status === "ACTIVE";
  return (
    <section className={DETAIL_CARD_CLASS}>
      <div className="mb-4 flex justify-center">
        <StatusDot domain="customer" status={CUSTOMER_STATUS_BY_API[customer.status]} size="md" />
      </div>
      <div className="space-y-2">
        {can(CUSTOMER_PERMISSIONS.update) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className={DETAIL_ACTION_CLASS.outline}
          >
            <Pencil className="size-3.5" /> Sửa
          </Button>
        )}
        {active && can(QUOTE_PERMISSIONS.create) && (
          <Button asChild size="sm" className={DETAIL_ACTION_CLASS.primary}>
            <Link href={ADMIN_ROUTES.quotes.createForCustomer(customer.customerId)}>
              <FilePlus2 className="size-3.5" /> Tạo báo giá
            </Link>
          </Button>
        )}
        <CustomerStatusActions customer={customer} canChangeStatus={canChangeCustomerStatus(can)} />
      </div>
      {can(QUOTE_PERMISSIONS.read) && (
        <div className="mt-3 border-t border-(--table-line) pt-3">
          <Button asChild variant="outline" size="sm" className={DETAIL_ACTION_CLASS.outline}>
            <Link href={ADMIN_ROUTES.quotes.byCustomer(customer.customerId)}>
              <FileText className="size-3.5" /> Báo giá của khách
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
