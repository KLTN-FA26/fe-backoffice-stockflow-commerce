"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { useCustomerRef } from "@/lib/references/customer-lookup";

/**
 * Tên khách. Ưu tiên `name` do BE kèm sẵn trong dòng dữ liệu (đợt thanh toán, phiếu thu, đơn — kế toán
 * thấy tên mà không cần quyền xem khách, BE-15) → không gọi thêm API nào. Không có `name` thì tra theo
 * id khi có `customer-customers:READ` (BE thêm role check Sales / Quản trị TMĐT). Không có cả hai →
 * hiện mã khách BE trả (`code`), không có mã thì nhãn trung tính "Khách hàng" — không mảnh UUID, không UUID trong
 * tooltip (BO-UX-6), không đoán tên.
 */
/** Nhãn khi không biết tên lẫn mã khách (thay cho mảnh UUID `KH 0c0000…`). */
export const CUSTOMER_FALLBACK_LABEL = "Khách hàng";

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
  const label = name || ref.data?.fullName || code || CUSTOMER_FALLBACK_LABEL;
  const title = code && code !== label ? code : undefined;
  if (!link || !canRead)
    return (
      <span className="text-ink-secondary" title={title}>
        {label}
      </span>
    );
  return (
    <Link
      href={ADMIN_ROUTES.customers.detail(id)}
      className="text-ink-primary hover:underline"
      title={ref.data?.email ?? title}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}
