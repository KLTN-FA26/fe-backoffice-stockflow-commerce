"use client";

import { CHAT_PERMISSIONS } from "@/constants";
import { SALES_OWNER_PERMISSIONS, SALES_WORKLOAD_PERMISSIONS } from "@/constants/sales-owner";

import { useCan } from "@/lib/auth";
import { useSalesOptions } from "@/lib/references/sales-workload";

/**
 * Sale phụ trách trên danh sách khách (sales-owner, BR-S11): cột + lọc chỉ khi đọc được (`customer-sales-owners:READ`).
 * Danh sách Sale cho lọc cột lấy từ bảng tải (quản lý) hoặc người trả lời chat (Sale); không có nguồn nào thì lọc cột
 * chỉ còn "Khách của tôi" / "Cần giao người phụ trách".
 */
export function useCustomerOwners() {
  const canRead = useCan(SALES_OWNER_PERMISSIONS.read);
  const workload = useCan(SALES_WORKLOAD_PERMISSIONS.read);
  const chat = useCan(CHAT_PERMISSIONS.read);
  const options = useSalesOptions({ workload: workload && canRead, agents: chat && canRead });
  return { canRead, sales: options.options ?? [] };
}
