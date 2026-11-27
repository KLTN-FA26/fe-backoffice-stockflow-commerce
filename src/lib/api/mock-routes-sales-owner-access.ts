/**
 * Mock route — Sale phụ trách khách, phần màn BO-2 cần (HOP-DONG-API sales-owner, BE-A):
 * - `GET /customers/{id}/sales-owner` — người phụ trách theo quy tắc điền dữ liệu của BE (người gửi chứng từ gần nhất):
 *   hai khách của seed WF-02 (khách demo, Trà Sữa Mây) có báo giá / hợp đồng do `demo.sales` gửi → ASSIGNED cho người đó;
 *   khách khác chưa có chứng từ → UNASSIGNED. Không có người lo thay.
 * - `GET /customers/duplicates` — trùng MST / SĐT / email / tên chuẩn hoá trên dữ liệu mock khách.
 * - `GET /identity/users/{id}/handover-summary` — số khách và hội thoại mở của người đó theo hai nguồn trên.
 * Đăng ký TRƯỚC `/customers/:customerId` (khớp theo thứ tự đăng ký).
 */

import { registerMockRoute } from "./mock-adapter";
import { CHAT_SEED, CHAT_SEED_PEOPLE } from "./mock-chat-seed";
import { chatState, isEndedStatus } from "./mock-chat-store";
import { allMockCustomers, findMockCustomer } from "./mock-customer-store";
import { fail, isUuidText, ok, pathParams, queryOf, typeMismatch } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockCustomer } from "./mock-customer-store";

/** Khách → người phụ trách (theo người gửi báo giá / hợp đồng trong seed WF-02 của BE). */
const SEED_OWNERS: Readonly<Record<string, string>> = {
  [CHAT_SEED.demoCustomer]: CHAT_SEED.sales,
  [CHAT_SEED.traSuaMay]: CHAT_SEED.sales,
};

const SINCE = "2026-11-20T02:00:00Z";

function ownerOf(customerId: string) {
  const ownerId = SEED_OWNERS[customerId.toLowerCase()] ?? null;
  return {
    customerId,
    salesOwnerId: ownerId,
    salesOwnerName: ownerId ? (CHAT_SEED_PEOPLE[ownerId] ?? null) : null,
    active: ownerId ? true : null,
    state: ownerId ? "ASSIGNED" : "UNASSIGNED",
    since: ownerId ? SINCE : null,
    cover: null,
    version: 0,
  };
}

function ownerRoute(config: AxiosRequestConfig) {
  const { customerId = "" } = pathParams(config);
  if (!isUuidText(customerId)) return typeMismatch("customerId", "UUID");
  if (!findMockCustomer(customerId))
    return fail(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
  return ok(ownerOf(customerId));
}

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

function duplicatesRoute(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const rows = allMockCustomers()
    .map((customer) => ({ customer, keys: matchedOn(customer, query) }))
    .filter((row) => row.keys.length > 0)
    .slice(0, 5)
    .map(({ customer, keys }) => ({
      customerId: customer.customerId,
      fullName: customer.fullName,
      matchedOn: keys,
      salesOwnerName: ownerOf(customer.customerId).salesOwnerName,
    }));
  return ok(rows);
}

function handoverRoute(config: AxiosRequestConfig) {
  const { userId = "" } = pathParams(config);
  const id = userId.toLowerCase();
  const customers = Object.values(SEED_OWNERS).filter((owner) => owner === id).length;
  const openConversations = chatState().conversations.filter(
    (conversation) => conversation.assignedAgentId === id && !isEndedStatus(conversation.status),
  ).length;
  return ok({ customers, openConversations, openLeads: 0 });
}

export function registerSalesOwnerAccessMockRoutes(): void {
  registerMockRoute("GET", "/customers/duplicates", duplicatesRoute);
  registerMockRoute("GET", "/customers/:customerId/sales-owner", ownerRoute);
  registerMockRoute("GET", "/identity/users/:userId/handover-summary", handoverRoute);
}
