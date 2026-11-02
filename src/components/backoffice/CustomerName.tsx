"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useCustomerRef } from "@/lib/references/customer-lookup";

/**
 * Tên khách theo id — chỉ tra khi có `customer-customers:READ` (BE thêm role check Sales / Quản
 * trị TMĐT). Không có quyền / lỗi → hiện mã rút gọn, không đoán tên.
 */
export function CustomerName({ id, link = true }: { id: string; link?: boolean }) {
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const ref = useCustomerRef(id, canRead);
  const label = ref.data?.fullName ?? `KH ${id.slice(0, 8)}`;
  if (!link || !canRead)
    return (
      <span className="text-ink-secondary" title={id}>
        {label}
      </span>
    );
  return (
    <Link
      href={ADMIN_ROUTES.customers.detail(id)}
      className="text-ink-primary hover:underline"
      title={ref.data?.email ?? id}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}
