/**
 * Store mock Nhà cung cấp — chỉ còn là nguồn seed cho PO mock → phiếu mua hàng cũ → tồn kho mock. BE đã bỏ mua
 * hàng (4A-8) nên không còn route `/suppliers`.
 */

import type { Supplier } from "@/lib/mock-data";

interface MockSupplierRecord {
  supplierId: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  paymentTermDays: number;
  leadTimeDays: number;
}

const DEFAULT_PAYMENT_DAYS = 30; // CommercialTerms.PAYMENT_DAYS

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
    status: s.active ? "ACTIVE" : "INACTIVE",
    paymentTermDays: parseNetDays(s.paymentTerms),
    leadTimeDays: s.leadTimeDays,
  };
}

async function getStore(): Promise<MockSupplierRecord[]> {
  if (!store) {
    const { suppliers } = await import("@/lib/mock-data");
    store = suppliers.map(fromMockData);
  }
  return store;
}

/** Tra một NCC trong store mock — để tên / mã / điều khoản NCC của PO mock khớp seed. */
export async function findMockSupplier(supplierId: string): Promise<MockSupplierRecord | null> {
  return (await getStore()).find((s) => s.supplierId === supplierId) ?? null;
}

/** Chỉ dùng trong test: đưa store về dữ liệu gốc. */
export function resetSupplierMockStore(): void {
  store = null;
}
