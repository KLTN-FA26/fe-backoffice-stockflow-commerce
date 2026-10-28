import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";
import { activateMockAdapter } from "./mock-adapter";
import { getPoStore, resetPoMockStore } from "./mock-routes-purchase-orders-store";
import {
  ensureSupplierCatalogSeeded,
  resetSupplierItemMockStore,
  supplierHasSku,
  seedMockSupplierItem,
} from "./mock-routes-supplier-items-store";
import { resetSupplierMockStore } from "./mock-routes-suppliers";

activateMockAdapter();

// Mỗi request mock trễ ~350ms (Math.random = 0.5).
vi.setConfig({ testTimeout: 30_000 });

const WAREHOUSE_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
const SUPPLIER = "SUP-001";
const OTHER_SUPPLIER = "SUP-002";

interface ItemWire {
  supplierItemId: string;
  sku: string;
  price: number;
  preferred: boolean;
  version: number;
}

interface Reply<T = Record<string, unknown>> {
  status: number;
  data: T;
}

interface FieldErr {
  field: string;
  code: string;
}

/** Gọi qua axios + mock adapter, trả cả status lỗi để đọc `errorCode` và `fieldErrors[].code`. */
async function send<T = Record<string, unknown>>(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  params?: Record<string, string>,
): Promise<Reply<T>> {
  const res = await api.request<T>({
    method,
    url,
    data,
    params: params ? new URLSearchParams(params) : undefined,
    validateStatus: () => true,
  });
  return { status: res.status, data: res.data };
}

const fieldErrorsOf = (r: Reply): FieldErr[] => (r.data as { fieldErrors: FieldErr[] }).fieldErrors;
const errorCodeOf = (r: Reply): unknown => (r.data as { errorCode: string }).errorCode;

async function listItems(supplierId: string): Promise<ItemWire[]> {
  const { data } = await send<{ items: ItemWire[] }>(
    "get",
    `/suppliers/${supplierId}/items`,
    undefined,
    { page: "0", size: "200" },
  );
  return data.items;
}

const body = (over: Record<string, unknown> = {}) => ({
  sku: "NEW-SKU-1",
  price: 1000,
  moq: 1,
  packSize: 1,
  ...over,
});

const poBody = (lines: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  supplierId: SUPPLIER,
  warehouseId: WAREHOUSE_ID,
  currency: "VND",
  expectedAt: "2099-01-01",
  lines,
  ...over,
});

beforeEach(() => {
  resetSupplierMockStore();
  resetPoMockStore();
  resetSupplierItemMockStore();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mock /suppliers/{id}/items — hợp đồng BE #117", () => {
  it("GET phân trang + sort currentPrice,asc", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "PG-A", price: 300, currency: "VND" });
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "PG-B", price: 100, currency: "VND" });
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "PG-C", price: 200, currency: "VND" });
    const { data } = await send<{ items: ItemWire[]; totalElements: number }>(
      "get",
      `/suppliers/${SUPPLIER}/items`,
      undefined,
      { page: "0", size: "2", sort: "currentPrice,asc" },
    );
    expect(data).toMatchObject({ page: 0, size: 2, hasPrevious: false });
    const prices = data.items.map((i) => i.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(data.items).toHaveLength(2);
    expect(data.totalElements).toBeGreaterThan(2);
    expect(data.items[0]).toMatchObject({ preferred: false, version: 0, packSize: 1 });
  });

  it("sort ngoài whitelist hoặc size > 200 → 400; NCC lạ → 404", async () => {
    const url = `/suppliers/${SUPPLIER}/items`;
    expect((await send("get", url, undefined, { sort: "sku,asc" })).status).toBe(400);
    expect((await send("get", url, undefined, { size: "201" })).status).toBe(400);
    const missing = await send("get", "/suppliers/NOPE/items");
    expect(missing.status).toBe(404);
    expect(errorCodeOf(missing)).toBe("SUPPLIER_NOT_FOUND");
  });

  it("POST 201; trùng SKU → 409 SUPPLIER_ITEM_DUPLICATE; NCC Inactive → 409 SUPPLIER_INACTIVE", async () => {
    const created = await send("post", `/suppliers/${SUPPLIER}/items`, body({ preferred: true }));
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      sku: "NEW-SKU-1",
      currency: "VND",
      preferred: true,
      version: 0,
      moq: 1,
    });
    const dup = await send("post", `/suppliers/${SUPPLIER}/items`, body());
    expect(dup.status).toBe(409);
    expect(errorCodeOf(dup)).toBe("SUPPLIER_ITEM_DUPLICATE");

    const supplier = {
      code: "SUP-OFF",
      name: "NCC tạm ngưng",
      status: "ACTIVE",
      communicationChannel: "EMAIL",
      email: "a@b.vn",
    };
    await send("post", "/suppliers", supplier);
    await send("put", "/suppliers/SUP-OFF", { ...supplier, status: "INACTIVE" });
    const inactive = await send("post", "/suppliers/SUP-OFF/items", body());
    expect(inactive.status).toBe(409);
    expect(errorCodeOf(inactive)).toBe("SUPPLIER_INACTIVE");
  });

  it("moq 5, packSize 2 → 400, field moq code SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE", async () => {
    const res = await send("post", `/suppliers/${SUPPLIER}/items`, body({ moq: 5, packSize: 2 }));
    expect(res.status).toBe(400);
    expect(errorCodeOf(res)).toBe("VALIDATION_FAILED");
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "moq", code: "SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE" }),
    ]);
  });

  it("VND giá 1500.5 → field price code SUPPLIER_ITEM_PRICE_INVALID", async () => {
    const res = await send("post", `/suppliers/${SUPPLIER}/items`, body({ price: 1500.5 }));
    expect(res.status).toBe(400);
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "price", code: "SUPPLIER_ITEM_PRICE_INVALID" }),
    ]);
  });

  it("PUT version cũ → 409 OPTIMISTIC_LOCK", async () => {
    const created = await send<ItemWire>("post", `/suppliers/${SUPPLIER}/items`, body());
    const url = `/suppliers/${SUPPLIER}/items/${created.data.supplierItemId}`;
    const updated = await send("put", url, {
      ...body({ price: 2000 }),
      version: 0,
      preferred: false,
    });
    expect(updated.data).toMatchObject({ price: 2000, version: 1 });
    const stale = await send("put", url, { ...body(), version: 0, preferred: false });
    expect(stale.status).toBe(409);
    expect(errorCodeOf(stale)).toBe("OPTIMISTIC_LOCK");
  });

  it("PUT preferred true chuyển ưu tiên khỏi NCC khác cùng SKU", async () => {
    const mine = await send<ItemWire>("post", `/suppliers/${SUPPLIER}/items`, body());
    const theirs = await send<ItemWire>(
      "post",
      `/suppliers/${OTHER_SUPPLIER}/items`,
      body({ preferred: true }),
    );
    expect(theirs.data.preferred).toBe(true);
    await send("put", `/suppliers/${SUPPLIER}/items/${mine.data.supplierItemId}`, {
      ...body(),
      version: 0,
      preferred: true,
    });
    expect((await listItems(SUPPLIER)).find((i) => i.sku === "NEW-SKU-1")?.preferred).toBe(true);
    expect((await listItems(OTHER_SUPPLIER)).find((i) => i.sku === "NEW-SKU-1")?.preferred).toBe(
      false,
    );
  });

  it("PUT thiếu preferred trên dòng đang ưu tiên → preferred false", async () => {
    const created = await send<ItemWire>(
      "post",
      `/suppliers/${SUPPLIER}/items`,
      body({ preferred: true }),
    );
    const updated = await send<ItemWire>(
      "put",
      `/suppliers/${SUPPLIER}/items/${created.data.supplierItemId}`,
      { ...body(), version: 0 },
    );
    expect(updated.data.preferred).toBe(false);
  });

  // BE `SaveSupplierItemRequest`: `sku` chỉ dùng khi tạo, PUT bỏ qua — dòng giữ SKU của nó
  it("PUT không có / khác sku vẫn giữ SKU của dòng; bỏ ưu tiên xoá đúng NCC mặc định của SKU đó", async () => {
    const created = await send<ItemWire>(
      "post",
      `/suppliers/${SUPPLIER}/items`,
      body({ preferred: true }),
    );
    const url = `/suppliers/${SUPPLIER}/items/${created.data.supplierItemId}`;
    const { sku: _sku, ...withoutSku } = body();
    void _sku;
    const kept = await send<ItemWire>("put", url, { ...withoutSku, preferred: true, version: 0 });
    expect(kept.data.sku).toBe("NEW-SKU-1");
    const other = await send<ItemWire>("put", url, {
      ...body({ sku: "OTHER-SKU" }),
      preferred: false,
      version: 1,
    });
    expect(other.data.sku).toBe("NEW-SKU-1");
    const { data } = await send<{ preferred: boolean }[]>(
      "get",
      "/procurement/skus/NEW-SKU-1/suppliers",
    );
    expect(data.some((row) => row.preferred)).toBe(false);
  });

  it("DELETE khi PO Draft còn đặt cặp NCC×SKU → 409 SUPPLIER_ITEM_IN_USE", async () => {
    const created = await send<ItemWire>("post", `/suppliers/${SUPPLIER}/items`, body());
    const po = await send(
      "post",
      "/purchase-orders",
      poBody([{ sku: "NEW-SKU-1", quantityOrdered: 2 }]),
    );
    expect(po.status).toBe(201);
    const res = await send(
      "delete",
      `/suppliers/${SUPPLIER}/items/${created.data.supplierItemId}`,
      undefined,
      { version: "0" },
    );
    expect(res.status).toBe(409);
    expect(errorCodeOf(res)).toBe("SUPPLIER_ITEM_IN_USE");
  });

  it("DELETE dòng không còn PO mở → 204 và biến mất khỏi danh sách", async () => {
    const created = await send<ItemWire>("post", `/suppliers/${SUPPLIER}/items`, body());
    const res = await send(
      "delete",
      `/suppliers/${SUPPLIER}/items/${created.data.supplierItemId}`,
      undefined,
      { version: "0" },
    );
    expect(res.status).toBe(204);
    expect((await listItems(SUPPLIER)).some((i) => i.sku === "NEW-SKU-1")).toBe(false);
  });

  it("GET /procurement/skus/{sku}/suppliers → mọi NCC bán SKU, NCC mặc định đứng đầu", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "MULTI-1", price: 100, currency: "VND" });
    seedMockSupplierItem({
      supplierId: OTHER_SUPPLIER,
      sku: "MULTI-1",
      price: 90,
      currency: "VND",
      moq: 4,
      packSize: 2,
      preferred: true,
    });
    const res = await send<{ supplierId: string; moq: number; preferred: boolean }[]>(
      "get",
      "/procurement/skus/MULTI-1/suppliers",
    );
    expect(res.status).toBe(200);
    expect(res.data.map((r) => r.supplierId)).toEqual([OTHER_SUPPLIER, SUPPLIER]);
    expect(res.data[0]).toMatchObject({ moq: 4, preferred: true });
  });
});

describe("mock POST /purchase-orders — chặn dòng theo danh mục (BE #118)", () => {
  it("SKU chưa có trong danh mục → 409 SUPPLIER_TERMS_VIOLATED, lines[0].sku", async () => {
    const res = await send(
      "post",
      "/purchase-orders",
      poBody([{ sku: "NOT-LISTED", quantityOrdered: 1, unitPrice: 5 }]),
    );
    expect(res.status).toBe(409);
    expect(errorCodeOf(res)).toBe("SUPPLIER_TERMS_VIOLATED");
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "lines[0].sku", code: "SUPPLIER_ITEM_NOT_LISTED" }),
    ]);
  });

  it("SL 3 với moq 10 pack 5 → hai lỗi ở lines[0].quantityOrdered", async () => {
    seedMockSupplierItem({
      supplierId: SUPPLIER,
      sku: "MOQ-1",
      price: 100,
      currency: "VND",
      moq: 10,
      packSize: 5,
    });
    const res = await send(
      "post",
      "/purchase-orders",
      poBody([{ sku: "MOQ-1", quantityOrdered: 3 }]),
    );
    expect(errorCodeOf(res)).toBe("SUPPLIER_TERMS_VIOLATED");
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "lines[0].quantityOrdered", code: "PO_LINE_BELOW_MOQ" }),
      expect.objectContaining({
        field: "lines[0].quantityOrdered",
        code: "PO_LINE_NOT_PACK_MULTIPLE",
      }),
    ]);
  });

  it("thiếu unitPrice cùng tiền tệ → dòng lấy giá danh mục", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "CAT-PRICE", price: 777, currency: "VND" });
    const res = await send<{ lines: { unitPrice: number; lineTotal: number }[]; subtotal: number }>(
      "post",
      "/purchase-orders",
      poBody([{ sku: "CAT-PRICE", quantityOrdered: 2 }]),
    );
    expect(res.status).toBe(201);
    expect(res.data.lines[0]).toMatchObject({ unitPrice: 777, lineTotal: 1554 });
    expect(res.data.subtotal).toBe(1554);
  });

  it("giá gõ tay thắng giá danh mục", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "TYPED", price: 777, currency: "VND" });
    const res = await send<{ lines: { unitPrice: number }[] }>(
      "post",
      "/purchase-orders",
      poBody([{ sku: "TYPED", quantityOrdered: 1, unitPrice: 500 }]),
    );
    expect(res.data.lines[0]?.unitPrice).toBe(500);
  });

  it("thiếu unitPrice khác tiền tệ → lines[0].unitPrice", async () => {
    seedMockSupplierItem({ supplierId: SUPPLIER, sku: "FX-1", price: 777, currency: "VND" });
    const res = await send(
      "post",
      "/purchase-orders",
      poBody([{ sku: "FX-1", quantityOrdered: 1 }], { currency: "USD" }),
    );
    expect(errorCodeOf(res)).toBe("SUPPLIER_TERMS_VIOLATED");
    expect(fieldErrorsOf(res)).toEqual([
      expect.objectContaining({ field: "lines[0].unitPrice", code: "PO_LINE_PRICE_REQUIRED" }),
    ]);
  });

  it("thiếu expectedAt → hôm nay (giờ VN) + lead time lớn nhất", async () => {
    // Đồng hồ cố định 23:59:59 giờ VN (16:59:59Z) — test không còn phụ thuộc giờ chạy thật, và
    // kiểm luôn mock tính "hôm nay" theo Asia/Ho_Chi_Minh chứ không theo UTC. Chỉ giả `Date`:
    // độ trễ mock (setTimeout) vẫn chạy thật.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T16:59:59Z"));
    seedMockSupplierItem({
      supplierId: SUPPLIER,
      sku: "LEAD-A",
      price: 1,
      currency: "VND",
      leadTimeDays: 3,
    });
    seedMockSupplierItem({
      supplierId: SUPPLIER,
      sku: "LEAD-B",
      price: 1,
      currency: "VND",
      leadTimeDays: 12,
    });
    const res = await send<{ expectedAt: string }>(
      "post",
      "/purchase-orders",
      poBody(
        [
          { sku: "LEAD-A", quantityOrdered: 1 },
          { sku: "LEAD-B", quantityOrdered: 1 },
        ],
        { expectedAt: undefined },
      ),
    );
    // 2026-10-20 (VN) + 12 ngày.
    expect(res.data.expectedAt).toBe("2026-11-01");
  });
});

describe("seed danh mục từ PO mock", () => {
  it("hai lời gọi đồng thời trên store mới đều thấy seed (không race)", async () => {
    const [po] = [...(await getPoStore()).values()];
    const line = po?.lines[0];
    if (!po || !line) throw new Error("mock PO seed is empty");
    resetSupplierItemMockStore();
    const first = ensureSupplierCatalogSeeded();
    const second = ensureSupplierCatalogSeeded();
    await second;
    expect(supplierHasSku(po.supplierId, line.sku)).toBe(true);
    await first;
    const [listed, created] = await Promise.all([
      send<{ items: ItemWire[] }>("get", `/suppliers/${po.supplierId}/items`, undefined, {
        size: "200",
      }),
      send(
        "post",
        "/purchase-orders",
        poBody([{ sku: line.sku, quantityOrdered: 1 }], {
          supplierId: po.supplierId,
          currency: po.currency,
        }),
      ),
    ]);
    expect(listed.data.items.some((i) => i.sku === line.sku)).toBe(true);
    expect(created.status).toBe(201);
  });
});
