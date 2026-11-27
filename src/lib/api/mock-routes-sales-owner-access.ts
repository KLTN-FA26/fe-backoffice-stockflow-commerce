/**
 * Mock route — phần màn BO-2 cần của Sale phụ trách khách (HOP-DONG-API sales-owner, BE-A):
 * - `GET /customers/duplicates` — trùng MST / SĐT / email / tên chuẩn hoá trên dữ liệu mock khách; tên người phụ trách
 *   lấy từ store chung (`mock-sales-owner-store`), như thẻ khách và danh sách.
 * - `GET /identity/users/{id}/handover-summary` — số khách đang phụ trách (store chung), hội thoại mở (chat mock) và lead
 *   đang mở (store lead) của người đó.
 * `GET /customers/{id}/sales-owner` KHÔNG ở đây: một route duy nhất trong `mock-routes-sales-owner.ts` cho mọi màn (thẻ
 * khách, báo giá, hợp đồng, chat), để một khách có cùng một người phụ trách ở mọi nơi.
 * Đăng ký TRƯỚC `/customers/:customerId` (khớp theo thứ tự đăng ký).
 */

import { registerMockRoute } from "./mock-adapter";
import { chatState, isEndedStatus } from "./mock-chat-store";
import { allMockCustomers } from "./mock-customer-store";
import { mockActorId } from "./mock-display-names";
import { ownerView } from "./mock-routes-sales-owner";
import { openLeadCountOf } from "./mock-routes-sales-work";
import { isUuidText, ok, pathParams, queryOf } from "./mock-route-utils";
import { salesOwnerStore } from "./mock-sales-owner-store";

import type { AxiosRequestConfig } from "axios";
import type { MockCustomer } from "./mock-customer-store";

/** Bỏ dấu, chữ thường, gộp khoảng trắng — "tên chuẩn hoá" của BR-S14. */
const normalName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const digits = (value: string | null) => (value ?? "").replace(/\D/g, "");

function matchedOn(customer: MockCustomer, query: URLSearchParams): string[] {
  const keys: string[] = [];
  const taxCode = query.get("taxCode");
  if (taxCode && customer.taxCode && digits(customer.taxCode) === digits(taxCode))
    keys.push("taxCode");
  const phone = query.get("phone");
  if (phone && customer.phone && digits(customer.phone).endsWith(digits(phone).slice(-9)))
    keys.push("phone");
  const email = query.get("email");
  if (email && customer.email.toLowerCase() === email.trim().toLowerCase()) keys.push("email");
  const name = query.get("name");
  if (name && normalName(customer.fullName).includes(normalName(name))) keys.push("name");
  return keys;
}

async function duplicatesRoute(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const matches = allMockCustomers()
    .map((customer) => ({ customer, keys: matchedOn(customer, query) }))
    .filter((row) => row.keys.length > 0)
    .slice(0, 5);
  const rows = await Promise.all(
    matches.map(async ({ customer, keys }) => {
      const owner = await ownerView(customer.customerId);
      return {
        customerId: customer.customerId,
        fullName: customer.fullName,
        matchedOn: keys,
        salesOwnerName: owner?.state === "ASSIGNED" ? owner.salesOwnerName : null,
      };
    }),
  );
  return ok(rows);
}

async function handoverRoute(config: AxiosRequestConfig) {
  const { userId = "" } = pathParams(config);
  // Màn tài khoản gửi id của tài khoản demo ("USER-SALE-01"); store / chat dùng id dạng UUID của cùng người. Id đã là
  // UUID (tài khoản seed như `demo.sales`) giữ nguyên.
  const id = isUuidText(userId) ? userId.toLowerCase() : mockActorId(userId);
  const customers = [...(await salesOwnerStore()).owners.values()].filter(
    (owner) => owner.ownerId === id && owner.state === "ASSIGNED",
  ).length;
  const openConversations = chatState().conversations.filter(
    (conversation) => conversation.assignedAgentId === id && !isEndedStatus(conversation.status),
  ).length;
  return ok({ customers, openConversations, openLeads: await openLeadCountOf(id) });
}

export function registerSalesOwnerAccessMockRoutes(): void {
  registerMockRoute("GET", "/customers/duplicates", duplicatesRoute);
  registerMockRoute("GET", "/identity/users/:userId/handover-summary", handoverRoute);
}
