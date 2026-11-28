"use client";

import { FilePlus2, FileText } from "lucide-react";

import { ADMIN_ROUTES, CUSTOMER_STATUS_BY_API, QUOTE_PERMISSIONS } from "@/constants";
import { allowedCustomerActions, canChangeCustomerStatus } from "@/features/customer/lifecycle";
import { ActionTrigger, ObjectActions } from "@/components/shared/ObjectActions";
import { ObjectHeader } from "@/components/shared/ObjectPage";
import { StatusDot } from "@/components/shared/StatusDot";

import { CustomerStatusAction, isDangerCustomerAction } from "./CustomerStatusAction";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Customer } from "@/features/customer/types";

/**
 * Đầu trang chi tiết khách (backoffice-erp-ui B10): tên công ty lớn, mã khách mono, trạng thái, email; bên phải MỘT nút
 * chính — "Tạo báo giá" (khách đang hoạt động), không thì bước mở khoá / mở lại, không nữa thì "Báo giá của khách" — mọi
 * việc khác trong menu "⋯" (tạm khoá /
 * đóng chữ đỏ). "Chỉnh sửa" ở đầu khung hồ sơ. UI-only — Backend phải re-check.
 */
export function CustomerObjectHeader({
  customer,
  can,
}: {
  customer: Customer;
  can: (permission: PermissionCode) => boolean;
}) {
  const canQuote = customer.status === "ACTIVE" && can(QUOTE_PERMISSIONS.create);
  const statusActions = allowedCustomerActions(customer.status, canChangeCustomerStatus(can));
  // Nút chính: tạo báo giá; khách bị khoá / đã đóng thì bước đưa khách về hoạt động
  const primaryStatus = canQuote
    ? undefined
    : statusActions.find((action) => !isDangerCustomerAction(action));
  const menuStatus = statusActions.filter((action) => action !== primaryStatus);
  const canReadQuotes = can(QUOTE_PERMISSIONS.read);
  // Không có việc chính nào khác (vd khách chờ kích hoạt) → "Báo giá của khách" là nút chính
  const quotesPrimary = canReadQuotes && !canQuote && !primaryStatus;
  const quotesLink = canReadQuotes && !quotesPrimary;
  const quotesTrigger = (
    <ActionTrigger
      icon={FileText}
      label="Báo giá của khách"
      href={ADMIN_ROUTES.quotes.byCustomer(customer.customerId)}
    />
  );
  return (
    <ObjectHeader
      name={customer.fullName}
      code={customer.customerId}
      codeLabel="Mã khách hàng"
      status={
        <StatusDot domain="customer" status={CUSTOMER_STATUS_BY_API[customer.status]} size="sm" />
      }
      meta={<span className="break-all">{customer.email}</span>}
      actions={
        <ObjectActions
          menuLabel="Thao tác khác với khách hàng"
          hasMenu={quotesLink || menuStatus.length > 0}
          primary={
            canQuote ? (
              <ActionTrigger
                icon={FilePlus2}
                label="Tạo báo giá"
                href={ADMIN_ROUTES.quotes.createForCustomer(customer.customerId)}
              />
            ) : primaryStatus ? (
              <CustomerStatusAction customer={customer} action={primaryStatus} />
            ) : quotesPrimary ? (
              quotesTrigger
            ) : undefined
          }
        >
          {quotesLink && quotesTrigger}
          {/* Việc thường trước, việc phá huỷ (chữ đỏ) cuối menu */}
          {[...menuStatus]
            .sort((a, b) => Number(isDangerCustomerAction(a)) - Number(isDangerCustomerAction(b)))
            .map((action) => (
              <CustomerStatusAction key={action} customer={customer} action={action} />
            ))}
        </ObjectActions>
      }
    />
  );
}
