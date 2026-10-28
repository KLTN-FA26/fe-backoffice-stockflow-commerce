/**
 * Mock routes — khách hàng (BE `CustomerController`): `GET /customers` (phân trang, `q`, `status`,
 * `segmentId`, `sort`) và `GET /customers/{customerId}`. Danh sách che mã số thuế
 * (`toMaskedResponse`); chi tiết trả nguyên. Lỗi theo `GlobalExceptionHandler` / `Pages` / `SortWhitelist`.
 */
import { registerMockRoute } from "./mock-adapter";
import {
  CUSTOMER_SORT_FIELDS,
  MOCK_CUSTOMER_STATUSES,
  allMockCustomers,
  findMockCustomer,
  maskTaxCode,
  matchesSearch,
  sortCustomers,
} from "./mock-customer-store";
import {
  fail,
  isUuidText,
  ok,
  pageOf,
  pathParams,
  queryOf,
  typeMismatch,
} from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { CustomerSortField, MockCustomer, SortOrder } from "./mock-customer-store";

/** BE `Pages`. */
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

const unsupported = (message: string) => fail(400, "UNSUPPORTED_PARAMETER", message);

/** `@RequestParam int` / `Integer`: chuỗi không phải số nguyên → lỗi chuyển kiểu (null = vắng). */
function intParam(raw: string | null): number | null | "invalid" {
  if (raw === null || raw === "") return null;
  return /^-?\d+$/.test(raw.trim()) ? Number(raw.trim()) : "invalid";
}

/** BE `SortWhitelist.parse`: `prop,dir;prop,dir`; thuộc tính ngoài danh sách → UNSUPPORTED_PARAMETER. */
function parseSort(raw: string | null): SortOrder[] | string {
  const clauses = (raw ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length === 0) return [{ field: "createdAt", desc: true }];
  const orders: SortOrder[] = [];
  for (const clause of clauses) {
    const [property = "", direction = ""] = clause.split(",", 2).map((p) => p.trim());
    if (!(CUSTOMER_SORT_FIELDS as readonly string[]).includes(property)) {
      return `Cannot sort by '${property}'. Allowed: ${CUSTOMER_SORT_FIELDS.join(", ")}`;
    }
    orders.push({ field: property as CustomerSortField, desc: direction.toLowerCase() === "desc" });
  }
  return orders;
}

/** BE `CustomerResponse`; `ok` bỏ field null như Jackson `non_null`. */
const toResponse = (c: MockCustomer, masked: boolean) => ({
  ...c,
  taxCode: masked ? maskTaxCode(c.taxCode) : c.taxCode,
});

function listRoute(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const page = intParam(query.get("page"));
  const size = intParam(query.get("size"));
  if (page === "invalid") return typeMismatch("page", "int");
  if (size === "invalid") return typeMismatch("size", "Integer");
  const segmentId = query.get("segmentId");
  if (segmentId && !isUuidText(segmentId)) return typeMismatch("segmentId", "UUID");
  const pageNumber = page ?? 0;
  const pageSize = size ?? DEFAULT_PAGE_SIZE;
  // BE `Pages.of`: kiểm sort trước (SORT.parse là đối số), rồi trang / cỡ trang
  const sort = parseSort(query.get("sort"));
  if (typeof sort === "string") return unsupported(sort);
  if (pageNumber < 0) return unsupported(`Page number must not be negative, got ${pageNumber}`);
  if (pageSize < 1) return unsupported(`Page size must be at least 1, got ${pageSize}`);
  if (pageSize > MAX_PAGE_SIZE) {
    return unsupported(`Page size must not exceed ${MAX_PAGE_SIZE}, got ${pageSize}`);
  }
  const status = query.get("status");
  if (status && !(MOCK_CUSTOMER_STATUSES as readonly string[]).includes(status)) {
    return unsupported(`Unknown customer status ${status}`);
  }
  const q = query.get("q") ?? "";
  const rows = allMockCustomers().filter(
    (c) =>
      matchesSearch(c, q) &&
      (!segmentId || c.segmentId === segmentId.toLowerCase()) &&
      (!status || c.status === status),
  );
  const sorted = sortCustomers(rows, sort).map((c) => toResponse(c, true));
  return ok(pageOf(sorted, pageNumber, pageSize));
}

function detailRoute(config: AxiosRequestConfig) {
  const { customerId = "" } = pathParams(config);
  if (!isUuidText(customerId)) return typeMismatch("customerId", "UUID");
  const customer = findMockCustomer(customerId);
  return customer
    ? ok(toResponse(customer, false))
    : fail(404, "CUSTOMER_NOT_FOUND", "Customer not found");
}

export function registerCustomerMockRoutes(): void {
  registerMockRoute("GET", "/customers", listRoute);
  registerMockRoute("GET", "/customers/:customerId", detailRoute);
}
