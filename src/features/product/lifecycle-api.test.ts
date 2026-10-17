import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  deleteProduct,
  getOpenReferences,
  listProductVersions,
  resumeProduct,
  suspendProduct,
} from "./lifecycle-api";
import {
  CHANGE_TYPE_LABEL,
  changedFieldLabel,
  discontinueWarningLabel,
  historyStatusLabel,
} from "./lifecycle-labels";
import { PRODUCT_CHANGE_TYPES, productVersionSchema } from "./lifecycle-schemas";
import { parseDiscontinuationExtras } from "./lifecycle-api";

afterEach(() => vi.restoreAllMocks());

const ID = "11111111-1111-4111-8111-111111111111";
const backendProduct = {
  productId: ID,
  code: "CUP",
  name: "Ly",
  nameEn: "Cup",
  taxClass: "STANDARD",
  kind: "STANDARD",
  status: "INACTIVE",
  version: 4,
  createdAt: "2026-01-01T00:00:00Z",
  suspendedAt: "2026-02-01T00:00:00Z",
  suspendReason: "Kiểm tra chất lượng",
};

describe("suspend / resume / delete (BE ProductController)", () => {
  it("suspension posts { reason, version } (reason trimmed, 1–500) and keeps the suspend fields", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: backendProduct });
    const product = await suspendProduct({ id: ID, reason: "  Kiểm tra chất lượng  ", version: 3 });
    expect(post).toHaveBeenCalledWith(`/products/${ID}/suspension`, {
      reason: "Kiểm tra chất lượng",
      version: 3,
    });
    expect(product.status).toBe("Inactive");
    expect(product.suspendReason).toBe("Kiểm tra chất lượng");
    expect(product.suspendedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("refuses a blank or over-long suspension reason before calling the backend", async () => {
    const post = vi.spyOn(api, "post");
    await expect(suspendProduct({ id: ID, reason: "   ", version: 3 })).rejects.toThrow();
    await expect(suspendProduct({ id: ID, reason: "x".repeat(501), version: 3 })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("resumption posts { version } only", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({
      data: { ...backendProduct, status: "APPROVED", suspendedAt: null, suspendReason: null },
    });
    const product = await resumeProduct({ id: ID, version: 4 });
    expect(post).toHaveBeenCalledWith(`/products/${ID}/resumption`, { version: 4 });
    expect(product.status).toBe("Approved");
    expect(product.suspendReason).toBeUndefined();
  });

  it("delete sends the version as ?version= (BE @RequestParam long version)", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValueOnce({ data: null });
    await expect(deleteProduct({ id: ID, version: 2 })).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith(`/products/${ID}`, { params: { version: 2 } });
  });

  it("refuses a delete without an integer version", async () => {
    const del = vi.spyOn(api, "delete");
    await expect(deleteProduct({ id: ID, version: Number.NaN })).rejects.toThrow();
    expect(del).not.toHaveBeenCalled();
  });
});

describe("open references", () => {
  it("parses OpenReferencesResponse { references, truncated }", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        references: [
          { kind: "PURCHASE_ORDER_LINE", documentNumber: "PO-1", documentId: "p1", sku: "A" },
        ],
        truncated: true,
      },
    });
    const result = await getOpenReferences(ID);
    expect(result.truncated).toBe(true);
    expect(result.references[0]).toMatchObject({
      kind: "PURCHASE_ORDER_LINE",
      documentNumber: "PO-1",
    });
  });

  it("rejects an unknown reference kind (closed enum in BE SkuReference.Kind)", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        references: [{ kind: "INVOICE", documentNumber: "x", documentId: "y", sku: "A" }],
        truncated: false,
      },
    });
    await expect(getOpenReferences(ID)).rejects.toThrow();
  });

  it("discontinuation extras need warnings, openReferences and openReferencesTruncated", () => {
    expect(
      parseDiscontinuationExtras({
        warnings: [],
        openReferences: [],
        openReferencesTruncated: false,
      }),
    ).toEqual({ warnings: [], openReferences: [], openReferencesTruncated: false });
    expect(() => parseDiscontinuationExtras({ warnings: [] })).toThrow();
  });

  it("maps warning codes to Vietnamese and never echoes an unknown code", () => {
    expect(discontinueWarningLabel("OPEN_PURCHASE_ORDER_LINES")).toMatch(/đơn mua/);
    expect(discontinueWarningLabel("UNSHIPPED_ORDER_LINES")).toMatch(/đơn bán/);
    expect(discontinueWarningLabel("SOMETHING_NEW")).not.toContain("SOMETHING_NEW");
  });
});

describe("history (GET /products/{id}/versions)", () => {
  const entry = {
    action: "TRANSITION",
    actorName: "Admin",
    outcome: "SUCCESS",
    occurredAt: "2026-02-01T00:00:00Z",
    changeType: "SUSPENDED",
    subjectType: "PRODUCT",
    subjectId: null,
    fromStatus: "APPROVED",
    toStatus: "INACTIVE",
    reason: "Kiểm tra chất lượng",
    changedFields: [],
  };

  it("sends zero-based page/size and parses the PageResponse", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        items: [entry],
        page: 1,
        size: 10,
        totalElements: 11,
        totalPages: 2,
        hasNext: false,
        hasPrevious: true,
      },
    });
    const page = await listProductVersions(ID, { page: 1, size: 10 });
    expect(get).toHaveBeenCalledWith(`/products/${ID}/versions`, {
      params: { page: 1, size: 10 },
      signal: undefined,
    });
    expect(page.items[0]?.reason).toBe("Kiểm tra chất lượng");
    expect(page.totalPages).toBe(2);
  });

  it("accepts every BE ProductChangeType; an unknown type or subject becomes UNKNOWN instead of failing the page", () => {
    for (const changeType of PRODUCT_CHANGE_TYPES) {
      expect(productVersionSchema.parse({ ...entry, changeType }).changeType).toBe(changeType);
    }
    const future = productVersionSchema.parse({
      ...entry,
      changeType: "TELEPORTED",
      subjectType: "WAREHOUSE",
    });
    expect(future).toMatchObject({ changeType: "UNKNOWN", subjectType: "UNKNOWN" });
    expect(CHANGE_TYPE_LABEL.UNKNOWN).toBe("Thay đổi khác");
  });

  it("every change type, status and known field has a Vietnamese label", () => {
    for (const type of PRODUCT_CHANGE_TYPES) expect(CHANGE_TYPE_LABEL[type]).toBeTruthy();
    expect(historyStatusLabel("INACTIVE")).toBe("Tạm ngưng");
    expect(historyStatusLabel("OBSOLETE")).toBe("Ngừng dùng");
    expect(changedFieldLabel("axes")).toBe("Trục biến thể");
    expect(changedFieldLabel("reorderPoint")).toBe("Điểm đặt hàng lại");
  });
});
