"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CREDIT_PROFILE_PERMISSIONS, CUSTOMER_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";

interface CreditLimitLinkProps {
  customerId: string | null | undefined;
  /** Trang người dùng đang đứng (hàng đợi / chi tiết đơn) — thẻ hạn mức hiện link quay lại. */
  returnTo: string;
  className?: string;
}

/**
 * Lối tắt từ đơn bị giữ vì công nợ tới hộp cấp / sửa hạn mức trên trang khách (AUTH-6). Chỉ hiện khi người xem mở được
 * trang khách, đọc được và duyệt được hạn mức. UI-only — Backend phải re-check (PUT credit-profile cần APPROVE).
 */
export function CreditLimitLink({ customerId, returnTo, className }: CreditLimitLinkProps) {
  const can = usePermissionChecker();
  const allowed =
    can(CUSTOMER_PERMISSIONS.viewPage) &&
    can(CREDIT_PROFILE_PERMISSIONS.read) &&
    can(CREDIT_PROFILE_PERMISSIONS.approve);
  if (!allowed || !customerId) return null;
  return (
    <Link
      href={ADMIN_ROUTES.customers.creditProfile(customerId, returnTo)}
      className={`text-accent-text text-xs font-medium hover:underline ${className ?? ""}`}
    >
      Sửa hạn mức công nợ
    </Link>
  );
}
