"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_LEGAL_PROFILE_PERMISSIONS,
  ORDER_PERMISSIONS,
  QUOTE_PERMISSIONS,
} from "@/constants";
import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";
import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";
import { useSalesOwner } from "@/lib/references/sales-owner";
import { canResendInvitation, canViewInvitation } from "@/features/customer/lifecycle";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { CreditProfileCard } from "./CreditProfileCard";
import { CustomerOrdersTab, CustomerQuotesTab } from "./CustomerDocumentsTab";
import { CUSTOMER_DOCUMENTS_COPY } from "./documents-copy";
import { InvitationCard } from "./InvitationCard";
import { LegalProfileCard } from "./LegalProfileCard";
import { SalesOwnerHistoryTab } from "./SalesOwnerHistoryTab";
import { StatusHistoryCard } from "./StatusHistoryCard";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Customer } from "@/features/customer/types";

const TABS = ["profile", "quotes", "orders", "portal", "history", "owners"] as const;
type TabKey = (typeof TABS)[number];
const LABEL: Record<TabKey, string> = {
  // Pháp lý và công nợ ít dữ liệu, cùng là hồ sơ thương mại → chung một tab (mặc định, để link "sửa pháp lý / công nợ"
  // từ trang khác mở đúng chỗ)
  profile: "Pháp lý & công nợ",
  quotes: CUSTOMER_DOCUMENTS_COPY.quotes.tab,
  orders: CUSTOMER_DOCUMENTS_COPY.orders.tab,
  portal: "Lời mời portal",
  history: "Lịch sử trạng thái",
  owners: SALES_OWNER_LABELS.history.tab,
};

/**
 * Nhóm của khách gom thành tab dưới bảng SKU riêng (backoffice-erp-ui B12) — tab đang chọn trên URL `?tab=`: pháp lý &
 * công nợ, báo giá và đơn của khách (bảng, link sang từng chứng từ), lời mời portal, lịch sử trạng thái. Tab không có
 * quyền xem thì ẩn.
 */
export function CustomerDetailTabs({
  customer,
  can,
}: {
  customer: Customer;
  can: (permission: PermissionCode) => boolean;
}) {
  // Tab không có quyền xem thì ẩn (B12). Báo giá / đơn của khách: BE `GET /quotes`, `GET /orders` lọc `customerId`.
  // Lịch sử phụ trách: cần `customer-sales-owners:READ`; BE chưa có endpoint (`null`) → ẩn tab.
  const canReadOwner = can(SALES_OWNER_PERMISSIONS.read);
  const owner = useSalesOwner(customer.customerId, canReadOwner);
  const visible: Record<TabKey, boolean> = {
    profile: true,
    quotes: can(QUOTE_PERMISSIONS.read),
    orders: can(ORDER_PERMISSIONS.read),
    portal: canViewInvitation(can),
    history: true,
    owners: canReadOwner && owner.data != null,
  };
  const tabs = TABS.filter((key) => visible[key]);
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS));
  // Link sửa pháp lý / công nợ (`?legalProfile=edit`, `?creditProfile=edit`) cần thẻ đó đang dựng → tab hồ sơ
  const [legalEdit] = useQueryState("legalProfile", parseAsString);
  const [creditEdit] = useQueryState("creditProfile", parseAsString);
  // Khách chờ kích hoạt: việc tiếp theo là lời mời portal → mở tab đó trước
  const fallback: TabKey =
    customer.status === "PENDING_ACTIVATION" && !legalEdit && !creditEdit && tabs.includes("portal")
      ? "portal"
      : "profile";
  const current: TabKey = tab && tabs.includes(tab) ? tab : fallback;
  return (
    <>
      <PageTabs
        tabs={tabs.map((value) => ({ value, label: LABEL[value] }))}
        value={current}
        onChange={(next) => void setTab(next === fallback ? null : next)}
        idPrefix="customer-detail"
        ariaLabel="Thông tin khách hàng"
      />
      <PageTabPanel idPrefix="customer-detail" value={current}>
        {current === "profile" && (
          <div className="space-y-5">
            <LegalProfileCard
              customerId={customer.customerId}
              customer={customer}
              canRead={can(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.read)}
              canUpdate={can(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.update)}
            />
            <CreditProfileCard
              customerId={customer.customerId}
              canRead={can(CREDIT_PROFILE_PERMISSIONS.read)}
              canApprove={can(CREDIT_PROFILE_PERMISSIONS.approve)}
            />
          </div>
        )}
        {current === "quotes" && <CustomerQuotesTab customerId={customer.customerId} />}
        {current === "orders" && <CustomerOrdersTab customerId={customer.customerId} />}
        {current === "portal" && (
          <InvitationCard
            customerId={customer.customerId}
            canRead={canViewInvitation(can)}
            canResend={canResendInvitation(customer.status, can)}
          />
        )}
        {current === "history" && <StatusHistoryCard customerId={customer.customerId} />}
        {current === "owners" && <SalesOwnerHistoryTab customerId={customer.customerId} />}
      </PageTabPanel>
    </>
  );
}
