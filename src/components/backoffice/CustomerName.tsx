"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useCustomerRef } from "@/lib/references/customer-lookup";

/**
 * Tên khách. Ưu tiên `name` do BE kèm sẵn trong dòng dữ liệu (đợt thanh toán, phiếu thu, đơn — kế toán
 * thấy tên mà không cần quyền xem khách, BE-15) → không gọi thêm API nào. Không có `name` thì tra theo
 * id khi có `customer-customers:READ` (BE thêm role check Sales / Quản trị TMĐT). Không có cả hai →
 * hiện mã khách BE trả (`code`) hoặc mã rút gọn, không đoán tên.
 */
export function CustomerName({
  id,
  name,
  code,
  link = true,
}: {
  id: string;
  name?: string | null;
  code?: string | null;
  link?: boolean;
}) {
  const canRead = useCan(CUSTOMER_PERMISSIONS.read);
  const ref = useCustomerRef(id, canRead && !name);
  const label = name || ref.data?.fullName || code || `KH ${id.slice(0, 8)}`;
  if (!link || !canRead)
    return (
      <span className="text-ink-secondary" title={code ? `${code} · ${id}` : id}>
        {label}
      </span>
    );
  return (
    <Link
      href={ADMIN_ROUTES.customers.detail(id)}
      className="text-ink-primary hover:underline"
      title={ref.data?.email ?? (code ? `${code} · ${id}` : id)}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}
