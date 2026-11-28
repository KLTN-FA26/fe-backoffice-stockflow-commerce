"use client";

import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { useCan } from "@/lib/auth";
import { useAssignableSales } from "@/lib/references/sales-agents";

/**
 * Sale phụ trách trên danh sách khách (sales-owner, BR-S11): cột + lọc chỉ khi đọc được (`customer-sales-owners:READ`).
 * Danh sách Sale cho lọc cột = Sale giao được (D42, `useAssignableSales`: `GET /customers/sales-agents`, BE chưa có thì
 * nguồn cũ đã lọc); không có nguồn nào thì lọc cột chỉ còn "Khách của tôi" / "Cần giao người phụ trách".
 */
export function useCustomerOwners() {
  const canRead = useCan(SALES_OWNER_PERMISSIONS.read);
  const sales = useAssignableSales(canRead);
  return { canRead, sales: sales.options ?? [] };
}
