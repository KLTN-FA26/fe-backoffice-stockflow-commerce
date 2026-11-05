/**
 * Mock routes — Nhà cung cấp (module 01), tách khỏi `mock-routes.ts` để PR NCC không sửa
 * chung đoạn code với các PR khác.
 *
 * Trả đúng hợp đồng BE SupplierController (PR #36, cập nhật PR #71): PageResponse trang từ 0, status
 * ACTIVE/INACTIVE/BLACKLISTED, lỗi `{ errorCode, message, fieldErrors[] }`. Không thêm field ngoài
 * hợp đồng.
 * File này + `mock-routes.ts` + `mock-adapter.ts` là nơi duy nhất đọc `mock-data.ts`.
 */

import { registerMockRoute } from "./mock-adapter";

import type { AxiosRequestConfig } from "axios";
import type { Supplier } from "@/lib/mock-data";

type ApiStatus = "ACTIVE" | "INACTIVE" | "BLACKLISTED";
const API_STATUSES: readonly string[] = ["ACTIVE", "INACTIVE", "BLACKLISTED"];
type Channel = "EMAIL" | "API";

interface MockSupplierRecord {
  supplierId: string;
  code: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  taxCode: string | null;
  status: ApiStatus;
  paymentTermDays: number;
  leadTimeDays: number;
  communicationChannel: Channel;
  apiEndpoint: string | null;
  overReceiptTolerancePercent: number | null;
  printSubcontractor: boolean;
  lossTolerancePercent: number | null;
  createdAt: string;
  lastModifiedAt: string;
}

/* ── Hằng số theo BE PR #36 ─────────────────────────────────────────── */

const MAX_PAGE_SIZE = 200; // Pages.MAX_PAGE_SIZE
const DEFAULT_PAGE_SIZE = 20; // Pages.DEFAULT_PAGE_SIZE
const SORTABLE = ["code", "name", "status", "createdAt", "lastModifiedAt"] as const;
const DEFAULT_PAYMENT_DAYS = 30; // CommercialTerms.PAYMENT_DAYS
const SEED_TIMESTAMP = "2026-09-01T00:00:00Z";
// BE PR #71 SaveSupplierRequest: @Size(max = 30) @Pattern("[A-Za-z0-9][A-Za-z0-9_-]*"), server upper-case.
const CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/;
// PO "mở" theo BE = mọi PO chưa đóng/huỷ (DRAFT … PARTIALLY_RECEIVED, RECEIVED chưa đóng).
// So theo dạng chuẩn hoá để đúng với cả nhãn mock-data ("Closed") lẫn mã BE ("CLOSED").
const CLOSED_PO_STATUSES: readonly string[] = ["CLOSED", "CANCELLED"];

function normalizePoStatus(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, "_");
}

/* ── Store in-memory (khởi tạo từ mock-data một lần) ───────────────── */

let store: MockSupplierRecord[] | null = null;

function parseNetDays(terms: string): number {
  const match = /\d+/.exec(terms);
  return match ? Number(match[0]) : DEFAULT_PAYMENT_DAYS;
}

function fromMockData(s: Supplier): MockSupplierRecord {
  return {
    supplierId: s.supplierId,
    code: s.supplierId,
    name: s.name,
    contactName: s.contactName || null,
    email: s.contactEmail || null,
    phone: s.contactPhone || null,
    taxCode: s.taxCode || null,
    status: s.active ? "ACTIVE" : "INACTIVE",
    paymentTermDays: parseNetDays(s.paymentTerms),
    leadTimeDays: s.leadTimeDays,
    communicationChannel: "EMAIL",
    apiEndpoint: null,
    overReceiptTolerancePercent: null,
    printSubcontractor: false,
    lossTolerancePercent: null,
    createdAt: SEED_TIMESTAMP,
    lastModifiedAt: SEED_TIMESTAMP,
  };
}

async function getStore(): Promise<MockSupplierRecord[]> {
  if (!store) {
    const { suppliers } = await import("@/lib/mock-data");
    store = suppliers.map(fromMockData);
  }
  return store;
}

/**
 * Tra một NCC trong store mock — dùng chung cho mock PO (`mock-routes-purchase-orders.ts`) để
 * tên/mã/điều khoản NCC của PO khớp đúng NCC mock đang hiển thị ở trang NCC.
 */
export async function findMockSupplier(
  supplierId: string,
): Promise<Pick<
  MockSupplierRecord,
  "supplierId" | "code" | "name" | "status" | "paymentTermDays" | "leadTimeDays"
> | null> {
  return (await getStore()).find((s) => s.supplierId === supplierId) ?? null;
}

/** Chỉ dùng trong test: đưa store về dữ liệu gốc. */
export function resetSupplierMockStore(): void {
  store = null;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function readParams(config: AxiosRequestConfig): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

function readSupplierBody(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

/** BE `@DecimalMin("0") @DecimalMax("100")`, tuỳ chọn. `undefined` = sai phạm vi. */
function percent(value: unknown): number | null | undefined {
  if (value == null || value === "") return null;
  return typeof value === "number" && value >= 0 && value <= 100 ? value : undefined;
}

function idParam(config: AxiosRequestConfig): string {
  const params = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  return decodeURIComponent(params.id ?? "");
}

function error(status: number, errorCode: string, message: string, fieldErrors?: unknown[]) {
  return { status, data: { success: false, errorCode, message, fieldErrors }, headers: {} };
}

function validationError(field: string, message: string) {
  return error(400, "VALIDATION_FAILED", "Dữ liệu không hợp lệ", [{ field, message }]);
}

function isDeliveryContactValid(channel: Channel, email: string | null, endpoint: string | null) {
  if (channel === "EMAIL") return email !== null;
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.search && !url.hash && !url.username;
  } catch {
    return false;
  }
}

/** Đọc + validate body theo SaveSupplierRequest. Trả record hoặc response lỗi. */
function readSaveRequest(data: unknown, existing: MockSupplierRecord | null) {
  const body = readSupplierBody(data);
  const code = str(body.code)?.toUpperCase() ?? null;
  const name = str(body.name);
  const status =
    typeof body.status === "string" && API_STATUSES.includes(body.status)
      ? (body.status as ApiStatus)
      : null;
  const channel =
    body.communicationChannel === "EMAIL" || body.communicationChannel === "API"
      ? body.communicationChannel
      : null;
  if (!code || !CODE_REGEX.test(code))
    return validationError("code", "Mã nhà cung cấp không hợp lệ");
  if (!name) return validationError("name", "Tên nhà cung cấp không được để trống");
  if (!status) return validationError("status", "Trạng thái không được để trống");
  if (!channel) return validationError("communicationChannel", "Kênh gửi PO không được để trống");
  const email = str(body.email);
  const apiEndpoint = str(body.apiEndpoint);
  if (!isDeliveryContactValid(channel, email, apiEndpoint)) {
    return validationError("deliveryContactValid", "Thông tin kênh gửi PO không hợp lệ");
  }
  const overReceipt = percent(body.overReceiptTolerancePercent);
  const loss = percent(body.lossTolerancePercent);
  if (overReceipt === undefined) {
    return validationError("overReceiptTolerancePercent", "Dung sai phải trong 0–100");
  }
  if (loss === undefined)
    return validationError("lossTolerancePercent", "Dung sai phải trong 0–100");
  const now = new Date().toISOString();
  const record: MockSupplierRecord = {
    supplierId: existing?.supplierId ?? code,
    code,
    name,
    contactName: str(body.contactName),
    email,
    phone: str(body.phone),
    taxCode: str(body.taxCode),
    status,
    paymentTermDays: num(body.paymentTermDays, existing?.paymentTermDays ?? DEFAULT_PAYMENT_DAYS),
    leadTimeDays: num(body.leadTimeDays, existing?.leadTimeDays ?? 0),
    communicationChannel: channel,
    apiEndpoint: channel === "API" ? apiEndpoint : null,
    // BE PUT thay toàn bộ: field vắng mặt = null / false.
    overReceiptTolerancePercent: overReceipt,
    printSubcontractor: body.printSubcontractor === true,
    lossTolerancePercent: loss,
    createdAt: existing?.createdAt ?? now,
    lastModifiedAt: now,
  };
  return record;
}

function duplicateError(
  all: MockSupplierRecord[],
  record: MockSupplierRecord,
  selfId: string | null,
) {
  const others = all.filter((s) => s.supplierId !== selfId);
  if (others.some((s) => s.code.toLowerCase() === record.code.toLowerCase())) {
    return error(409, "SUPPLIER_CODE_ALREADY_EXISTS", "Mã nhà cung cấp đã tồn tại");
  }
  if (record.taxCode && others.some((s) => s.taxCode === record.taxCode)) {
    return error(409, "SUPPLIER_TAX_CODE_ALREADY_EXISTS", "Mã số thuế đã thuộc nhà cung cấp khác");
  }
  return null;
}

async function hasOpenPurchaseOrders(supplierId: string): Promise<boolean> {
  const { purchaseOrders } = await import("@/lib/mock-data");
  return purchaseOrders.some(
    (po) =>
      po.supplierId === supplierId && !CLOSED_PO_STATUSES.includes(normalizePoStatus(po.status)),
  );
}

function compare(a: MockSupplierRecord, b: MockSupplierRecord, field: (typeof SORTABLE)[number]) {
  return String(a[field]).localeCompare(String(b[field]), "vi");
}

/* ── Routes ─────────────────────────────────────────────────────────── */

export function registerSupplierMockRoutes(): void {
  registerMockRoute("GET", "/suppliers", async (config) => {
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Number(params.get("size")) || DEFAULT_PAGE_SIZE;
    if (size > MAX_PAGE_SIZE)
      return validationError("size", `Tối đa ${MAX_PAGE_SIZE} dòng mỗi trang`);

    let items = [...(await getStore())];
    const search = params.get("search")?.trim().toLowerCase();
    if (search) {
      items = items.filter((s) =>
        [s.code, s.name, s.taxCode ?? ""].some((v) => v.toLowerCase().includes(search)),
      );
    }
    const status = params.get("status");
    if (status) items = items.filter((s) => s.status === status);

    const [field, dir] = (params.get("sort") ?? "lastModifiedAt,desc").split(",");
    const sortField = SORTABLE.find((f) => f === field);
    if (!sortField) return validationError("sort", "Trường sắp xếp không được hỗ trợ");
    items.sort((a, b) => (dir === "desc" ? -1 : 1) * compare(a, b, sortField));

    const totalElements = items.length;
    const totalPages = Math.ceil(totalElements / size);
    return {
      status: 200,
      data: {
        items: items.slice(page * size, page * size + size),
        page,
        size,
        totalElements,
        totalPages,
        hasNext: page + 1 < totalPages,
        hasPrevious: page > 0,
      },
      headers: {},
    };
  });

  registerMockRoute("GET", "/suppliers/:id", async (config) => {
    const found = (await getStore()).find((s) => s.supplierId === idParam(config));
    if (!found) return error(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp");
    return { status: 200, data: found, headers: {} };
  });

  registerMockRoute("POST", "/suppliers", async (config) => {
    const all = await getStore();
    const record = readSaveRequest(config.data, null);
    if ("headers" in record) return record;
    const duplicate = duplicateError(all, record, null);
    if (duplicate) return duplicate;
    all.unshift(record);
    return { status: 201, data: record, headers: {} };
  });

  registerMockRoute("PUT", "/suppliers/:id", async (config) => {
    const all = await getStore();
    const idx = all.findIndex((s) => s.supplierId === idParam(config));
    const existing = all[idx];
    if (!existing) return error(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp");
    const record = readSaveRequest(config.data, existing);
    if ("headers" in record) return record;
    // BE: mã NCC không được đổi sau khi tạo
    if (record.code.toLowerCase() !== existing.code.toLowerCase()) {
      return error(409, "CONFLICT", "Không được đổi mã nhà cung cấp");
    }
    const duplicate = duplicateError(all, record, existing.supplierId);
    if (duplicate) return duplicate;
    // BE Supplier#update: rời ACTIVE (INACTIVE hoặc BLACKLISTED) khi còn PO mở → 409.
    if (
      record.status !== "ACTIVE" &&
      existing.status === "ACTIVE" &&
      (await hasOpenPurchaseOrders(existing.supplierId))
    ) {
      return error(
        409,
        "SUPPLIER_HAS_OPEN_PURCHASE_ORDERS",
        "Nhà cung cấp còn đơn đặt hàng đang mở",
      );
    }
    all[idx] = record;
    return { status: 200, data: record, headers: {} };
  });

  registerMockRoute("DELETE", "/suppliers/:id", async (config) => {
    const all = await getStore();
    const idx = all.findIndex((s) => s.supplierId === idParam(config));
    const existing = all[idx];
    if (!existing) return error(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp");
    if (await hasOpenPurchaseOrders(existing.supplierId)) {
      return error(
        409,
        "SUPPLIER_HAS_OPEN_PURCHASE_ORDERS",
        "Nhà cung cấp còn đơn đặt hàng đang mở",
      );
    }
    all[idx] = { ...existing, status: "INACTIVE", lastModifiedAt: new Date().toISOString() };
    return { status: 204, data: null, headers: {} };
  });
}
