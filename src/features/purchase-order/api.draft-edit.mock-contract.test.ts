/**
 * Contract test: mock `PUT /purchase-orders/{id}` (sửa nháp) khớp BE SCRUM-462
 * (`PurchaseOrderController#update`, `ProcurementServiceImpl#reviseDraft`).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { getPoStore, resetPoMockStore } from "@/lib/api/mock-routes-purchase-orders-store";
import {
  resetSupplierItemMockStore,
  seedMockSupplierItem,
} from "@/lib/api/mock-routes-supplier-items-store";
import { resetSupplierMockStore } from "@/lib/api/mock-routes-suppliers";

import { createPurchaseOrder, getPurchaseOrder, submitPurchaseOrder } from "./api";
import { updatePurchaseOrder } from "./draft-api";
import { updatePoSchema } from "./update-input-schema";

import type { CreatePoInput } from "./input-schemas";
import type { UpdatePoInput } from "./update-input-schema";

const FUTURE = "2099-01-01";
const WAREHOUSE_ID = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
const SKU_A = "SKU-EDIT-1";
const SKU_B = "SKU-EDIT-2";
const CATALOG_PRICE = 7;

type CreateLine = CreatePoInput["lines"][number];
type UpdateLine = UpdatePoInput["lines"][number];

const create = (lines: CreateLine[]) =>
  createPurchaseOrder({
    supplierId: "SUP-001",
    warehouseId: WAREHOUSE_ID,
    currency: "VND",
    expectedAt: FUTURE,
    lines,
  });

const createLine = (sku: string, unitPrice?: number): CreateLine => ({
  sku,
  description: "",
  quantityOrdered: 1,
  unitPrice,
});

const updateLine = (sku: string, extra: Partial<UpdateLine> = {}): UpdateLine => ({
  sku,
  description: "",
  quantityOrdered: 1,
  ...extra,
});

const body = (version: number, lines: UpdateLine[]): UpdatePoInput => ({
  version,
  warehouseId: WAREHOUSE_ID,
  expectedAt: FUTURE,
  lines,
});

async function expectApiError(p: Promise<unknown>, status: number, code: string) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status, code });
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetPoMockStore();
  resetSupplierMockStore();
  resetSupplierItemMockStore();
  // Giá danh mục khác giá thương lượng để phân biệt hai nguồn giá.
  for (const sku of [SKU_A, SKU_B]) {
    seedMockSupplierItem({ supplierId: "SUP-001", sku, price: CATALOG_PRICE, currency: "VND" });
  }
  activateMockAdapter();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("PUT /purchase-orders/{id} — sửa nháp (BE SCRUM-462)", () => {
  it("PO nháp trong seed (lineId seed không phải UUID) → GET trả lineId UUID ổn định, PUT giữ dòng → 200", async () => {
    const store = await getPoStore();
    const seedDraft = [...store.values()].find(
      (po) => po.status === "DRAFT" && po.type === "STANDARD",
    );
    expect(seedDraft).toBeDefined();
    if (!seedDraft) return;
    for (const line of seedDraft.lines) {
      seedMockSupplierItem({
        supplierId: seedDraft.supplierId,
        sku: line.sku,
        price: CATALOG_PRICE,
        currency: seedDraft.currency,
      });
    }
    const po = await getPurchaseOrder(seedDraft.purchaseOrderId);
    const input = body(
      po.version,
      po.lines.map((l) =>
        updateLine(l.skuId, {
          lineId: l.lineId,
          quantityOrdered: l.orderedQty,
          unitPrice: l.unitPrice,
        }),
      ),
    );
    // Cùng chốt chặn FE dùng trước khi PUT (`useEditDraftForm`)
    expect(updatePoSchema.safeParse(input).success).toBe(true);
    const updated = await updatePurchaseOrder({ id: po.poId, body: input });
    expect(updated.lines.map((l) => l.lineId)).toEqual(po.lines.map((l) => l.lineId));
  });

  it("PUT nháp: dòng cũ giữ unitPrice đã gửi, dòng mới thiếu giá lấy giá danh mục", async () => {
    const po = await create([createLine(SKU_A, 100)]);
    const lineId = po.lines[0]?.lineId;
    const updated = await updatePurchaseOrder({
      id: po.poId,
      body: body(po.version, [
        updateLine(SKU_A, { lineId, quantityOrdered: 3, unitPrice: 100 }),
        updateLine(SKU_B, { quantityOrdered: 2 }),
      ]),
    });
    expect(updated.lines[0]).toMatchObject({ lineId, orderedQty: 3, unitPrice: 100 });
    expect(updated.lines[1]).toMatchObject({ skuId: SKU_B, unitPrice: CATALOG_PRICE });
    expect(updated.subtotal).toBe(3 * 100 + 2 * CATALOG_PRICE);
  });

  it('cùng lineId hai lần → 400 VALIDATION_FAILED như BE reviseDraft ("or is named twice")', async () => {
    const po = await create([createLine(SKU_A, 5)]);
    const lineId = po.lines[0]?.lineId;
    const err = await updatePurchaseOrder({
      id: po.poId,
      body: body(po.version, [
        updateLine(SKU_A, { lineId, unitPrice: 5 }),
        updateLine(SKU_A, { lineId, unitPrice: 5 }),
      ]),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
  });

  it("version cũ → 409 OPTIMISTIC_LOCK", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    const lineId = po.lines[0]?.lineId;
    await updatePurchaseOrder({
      id: po.poId,
      body: body(po.version, [updateLine(SKU_A, { lineId, unitPrice: 5 })]),
    });
    await expectApiError(
      updatePurchaseOrder({ id: po.poId, body: body(po.version, [updateLine(SKU_A)]) }),
      409,
      "OPTIMISTIC_LOCK",
    );
  });

  it("PO đã gửi duyệt → 409 PURCHASE_ORDER_NOT_EDITABLE", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    const pending = await submitPurchaseOrder(po.poId);
    await expectApiError(
      updatePurchaseOrder({ id: po.poId, body: body(pending.version, [updateLine(SKU_A)]) }),
      409,
      "PURCHASE_ORDER_NOT_EDITABLE",
    );
  });

  it("DRAFT SUBCONTRACT → 409 PURCHASE_ORDER_NOT_EDITABLE", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    const store = await getPoStore();
    const stored = store.get(po.poId);
    if (stored) store.set(po.poId, { ...stored, type: "SUBCONTRACT" });
    await expectApiError(
      updatePurchaseOrder({
        id: po.poId,
        body: body(po.version, [updateLine(SKU_A, { unitPrice: 5 })]),
      }),
      409,
      "PURCHASE_ORDER_NOT_EDITABLE",
    );
  });

  it("đổi SKU của lineId → 400", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    await expectApiError(
      updatePurchaseOrder({
        id: po.poId,
        body: body(po.version, [updateLine(SKU_B, { lineId: po.lines[0]?.lineId, unitPrice: 5 })]),
      }),
      400,
      "VALIDATION_FAILED",
    );
  });

  it("lineId lạ, lineId trùng, SKU trùng → 400", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    const lineId = po.lines[0]?.lineId;
    const unknownId = "99999999-9999-4999-8999-999999999999";
    const rejects = (lines: UpdateLine[]) =>
      expectApiError(
        updatePurchaseOrder({ id: po.poId, body: body(po.version, lines) }),
        400,
        "VALIDATION_FAILED",
      );
    await rejects([updateLine(SKU_A, { lineId: unknownId, unitPrice: 5 })]);
    await rejects([
      updateLine(SKU_A, { lineId, unitPrice: 5 }),
      updateLine(SKU_B, { lineId, unitPrice: 5 }),
    ]);
    await rejects([updateLine(SKU_A, { lineId, unitPrice: 5 }), updateLine(SKU_A)]);
  });

  it("SKU ngoài danh mục NCC → 409 SUPPLIER_TERMS_VIOLATED", async () => {
    const po = await create([createLine(SKU_A, 5)]);
    await expectApiError(
      updatePurchaseOrder({
        id: po.poId,
        body: body(po.version, [updateLine("SKU-UNLISTED", { unitPrice: 5 })]),
      }),
      409,
      "SUPPLIER_TERMS_VIOLATED",
    );
  });

  it("bỏ một dòng → dòng đó biến mất, version tăng", async () => {
    const po = await create([createLine(SKU_A, 5), createLine(SKU_B, 5)]);
    const keep = po.lines[0];
    const updated = await updatePurchaseOrder({
      id: po.poId,
      body: body(po.version, [
        updateLine(keep?.skuId ?? SKU_A, { lineId: keep?.lineId, unitPrice: 5 }),
      ]),
    });
    expect(updated.lines).toHaveLength(1);
    expect(updated.version).toBe(po.version + 1);
    const reread = await getPurchaseOrder(po.poId);
    expect(reread.lines.map((l) => l.lineId)).toEqual([keep?.lineId]);
    expect(reread.version).toBe(po.version + 1);
  });
});
