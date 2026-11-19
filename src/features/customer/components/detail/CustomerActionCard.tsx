"use client";

import Link from "next/link";
import { FilePlus2, FileText, FlaskConical, Pencil } from "lucide-react";

import {
  ADMIN_ROUTES,
  CUSTOMER_PERMISSIONS,
  CUSTOMER_STATUS_BY_API,
  QUOTE_PERMISSIONS,
  SAMPLE_REQUEST_PERMISSIONS,
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
 * sửa hồ sơ, tạo báo giá / yêu cầu mẫu (chỉ khách đang hoạt động), đổi trạng thái theo vòng đời, rồi các liên kết
 * tra cứu. Quyền UI-only — Backend phải re-check.
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
  const canReadQuotes = can(QUOTE_PERMISSIONS.read);
  const canReadSamples = can(SAMPLE_REQUEST_PERMISSIONS.read);
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
        {active && can(SAMPLE_REQUEST_PERMISSIONS.create) && (
          <Button asChild variant="outline" size="sm" className={DETAIL_ACTION_CLASS.outline}>
            <Link href={ADMIN_ROUTES.sampleRequests.createForCustomer(customer.customerId)}>
              <FlaskConical className="size-3.5" /> Tạo yêu cầu mẫu
            </Link>
          </Button>
        )}
        <CustomerStatusActions customer={customer} canChangeStatus={canChangeCustomerStatus(can)} />
      </div>
      {(canReadQuotes || canReadSamples) && (
        <div className="mt-3 space-y-2 border-t border-(--table-line) pt-3">
          {canReadQuotes && (
            <Button asChild variant="outline" size="sm" className={DETAIL_ACTION_CLASS.outline}>
              <Link href={ADMIN_ROUTES.quotes.byCustomer(customer.customerId)}>
                <FileText className="size-3.5" /> Báo giá của khách
              </Link>
            </Button>
          )}
          {canReadSamples && (
            <Button asChild variant="outline" size="sm" className={DETAIL_ACTION_CLASS.outline}>
              <Link href={ADMIN_ROUTES.sampleRequests.byCustomer(customer.customerId)}>
                <FlaskConical className="size-3.5" /> Yêu cầu mẫu
              </Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
