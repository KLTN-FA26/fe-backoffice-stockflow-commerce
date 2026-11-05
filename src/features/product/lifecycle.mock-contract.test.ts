/**
 * Contract test: mock adapter nói đúng hợp đồng BE SCRUM-461 cho tạm ngưng / tiếp tục / xoá nháp /
 * chứng từ còn mở / lịch sử, để các hàm `lifecycle-api.ts` (parse zod) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetProductHistoryMock } from "@/lib/api/mock-product-history";
import { resetProductMockStore } from "@/lib/api/mock-product-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  createProduct,
  discontinueProduct,
  getProduct,
  listBrands,
  listCategories,
  listProducts,
  transitionProduct,
  updateProduct,
} from "./api";
import {
  deleteProduct,
  getOpenReferences,
  listProductVersions,
  resumeProduct,
  suspendProduct,
} from "./lifecycle-api";
import { listVariants } from "./variant-api";

vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  // Ghim độ trễ + lỗi 500 ngẫu nhiên 5% của adapter để test ổn định.
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetProductMockStore();
  resetProductHistoryMock();
  resetVariantMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
}

let counter = 0;
async function draft() {
  const [category] = (await listCategories()).items;
  const [brand] = await listBrands();
  counter += 1;
  return createProduct({
    code: `LIFE-${Date.now()}-${counter}`,
    name: "Sản phẩm vòng đời",
    nameEn: "Lifecycle product",
    categoryId: category?.categoryId ?? "",
    brandId: brand?.brandId ?? "",
    description: "",
    descriptionEn: "",
    taxClass: "STANDARD",
    kind: "STANDARD",
  });
}

async function approved() {
  const created = await draft();
  await transitionProduct({ id: created.productId, action: "submit" });
  return transitionProduct({ id: created.productId, action: "approve" });
}

describe("tạm ngưng / tiếp tục", () => {
  it("tạm ngưng từ Approved: lưu lý do + thời điểm, tăng version; tiếp tục về Approved và xoá lý do", async () => {
    const product = await approved();
    const suspended = await suspendProduct({
      id: product.productId,
      reason: "Kiểm tra chất lượng",
      version: product.version,
    });
    expect(suspended.status).toBe("Inactive");
    expect(suspended.version).toBe(product.version + 1);
    expect(suspended.suspendReason).toBe("Kiểm tra chất lượng");
    expect(suspended.suspendedAt).toBeTruthy();

    const resumed = await resumeProduct({ id: product.productId, version: suspended.version });
    expect(resumed.status).toBe("Approved");
    expect(resumed.suspendReason).toBeUndefined();
    expect((await getProduct(product.productId)).status).toBe("Approved");
  });

  it("version cũ → 409 OPTIMISTIC_LOCK; trạng thái không hợp lệ → 409 INVALID_PRODUCT_STATUS_TRANSITION", async () => {
    const product = await approved();
    const stale = await apiError(
      suspendProduct({ id: product.productId, reason: "x", version: product.version - 1 }),
    );
    expect(stale.code).toBe("OPTIMISTIC_LOCK");

    // Resume khi chưa tạm ngưng; suspend từ Draft.
    const notSuspended = await apiError(
      resumeProduct({ id: product.productId, version: product.version }),
    );
    expect(notSuspended.code).toBe("INVALID_PRODUCT_STATUS_TRANSITION");
    const fresh = await draft();
    const fromDraft = await apiError(
      suspendProduct({ id: fresh.productId, reason: "x", version: fresh.version }),
    );
    expect(fromDraft.code).toBe("INVALID_PRODUCT_STATUS_TRANSITION");
  });

  it("sản phẩm tạm ngưng vẫn ngừng kinh doanh được (BE: INACTIVE → DISCONTINUED)", async () => {
    const product = await approved();
    const suspended = await suspendProduct({
      id: product.productId,
      reason: "Tạm dừng",
      version: product.version,
    });
    const result = await discontinueProduct({
      id: product.productId,
      reason: "Ngừng hẳn",
      version: suspended.version,
    });
    expect(result.product.status).toBe("Discontinued");
    expect(result.product.discontinueReason).toBe("Ngừng hẳn");
    expect(result.product.suspendReason).toBeUndefined();
  });
});

describe("xoá bản nháp", () => {
  it("xoá Draft với version đúng → biến mất khỏi danh sách, GET 404", async () => {
    const product = await draft();
    await expect(
      deleteProduct({ id: product.productId, version: product.version }),
    ).resolves.toBeUndefined();
    const page = await listProducts({ q: product.productId });
    expect(page.items.some((p) => p.productId === product.productId)).toBe(false);
    expect((await apiError(getProduct(product.productId))).status).toBe(404);
    // Xoá cả biến thể mặc định đã tạo cùng sản phẩm.
    expect(await listVariants(product.productId)).toEqual([]);
  });

  it("version cũ → 409 OPTIMISTIC_LOCK; sản phẩm đã gửi duyệt → 409 PRODUCT_NOT_DELETABLE (BR-02)", async () => {
    const product = await draft();
    expect(
      (await apiError(deleteProduct({ id: product.productId, version: product.version + 5 }))).code,
    ).toBe("OPTIMISTIC_LOCK");
    const submitted = await transitionProduct({ id: product.productId, action: "submit" });
    expect(
      (await apiError(deleteProduct({ id: product.productId, version: submitted.version }))).code,
    ).toBe("PRODUCT_NOT_DELETABLE");
  });
});

describe("chứng từ còn mở + cảnh báo khi ngừng kinh doanh", () => {
  async function productWithOpenReferences() {
    for (const product of (await listProducts({ size: 50 })).items) {
      const open = await getOpenReferences(product.productId);
      if (open.references.length > 0) return { product, open };
    }
    return null;
  }

  it("dữ liệu mẫu có sản phẩm còn đơn mua / đơn bán mở; mỗi chứng từ có đủ trường", async () => {
    const found = await productWithOpenReferences();
    expect(found).not.toBeNull();
    for (const reference of found?.open.references ?? []) {
      expect(["PURCHASE_ORDER_LINE", "SALES_ORDER_LINE"]).toContain(reference.kind);
      expect(reference.documentNumber).toBeTruthy();
      expect(reference.sku).toBeTruthy();
    }
    expect((found?.open.references.length ?? 0) <= 20).toBe(true);
  });

  it("ngừng kinh doanh trả cảnh báo + chứng từ (không từ chối) và mọi biến thể thành OBSOLETE", async () => {
    const found = await productWithOpenReferences();
    expect(found).not.toBeNull();
    if (!found) return;
    const { product, open } = found;
    // Đưa sản phẩm tới trạng thái có thể ngừng: sản phẩm seed đã ở Approved / Published / Inactive?
    const current = await getProduct(product.productId);
    if (!["Approved", "Published", "Inactive"].includes(current.status)) return;
    const result = await discontinueProduct({
      id: product.productId,
      reason: "Ngừng để thử cảnh báo",
      version: current.version,
    });
    expect(result.product.status).toBe("Discontinued");
    const kinds = new Set(open.references.map((r) => r.kind));
    expect(result.warnings.includes("OPEN_PURCHASE_ORDER_LINES")).toBe(
      kinds.has("PURCHASE_ORDER_LINE"),
    );
    expect(result.warnings.includes("UNSHIPPED_ORDER_LINES")).toBe(kinds.has("SALES_ORDER_LINE"));
    expect(result.openReferences.length).toBe(open.references.length);
    expect((await listVariants(product.productId)).every((v) => v.status === "OBSOLETE")).toBe(
      true,
    );
  });

  it("không còn chứng từ mở → danh sách rỗng, không có cảnh báo", async () => {
    const product = await approved();
    expect(await getOpenReferences(product.productId)).toEqual({
      references: [],
      truncated: false,
    });
    const result = await discontinueProduct({
      id: product.productId,
      reason: "Hết mẫu",
      version: product.version,
    });
    expect(result.warnings).toEqual([]);
    expect(result.openReferences).toEqual([]);
    expect(result.openReferencesTruncated).toBe(false);
  });
});

describe("lịch sử thay đổi", () => {
  it("ghi mới nhất trước, kèm lý do; duyệt kích hoạt biến thể nháp (BE ghi cả VARIANT_STATUS); phân trang theo page/size", async () => {
    const product = await approved();
    await suspendProduct({
      id: product.productId,
      reason: "Lý do tạm ngưng",
      version: product.version,
    });

    const first = await listProductVersions(product.productId, { page: 0, size: 2 });
    expect(first.items.map((e) => e.changeType)).toEqual(["SUSPENDED", "APPROVED"]);
    expect(first.items[0]).toMatchObject({
      action: "TRANSITION",
      subjectType: "PRODUCT",
      fromStatus: "APPROVED",
      toStatus: "INACTIVE",
      reason: "Lý do tạm ngưng",
      outcome: "SUCCESS",
    });
    expect(first.totalElements).toBe(5);
    expect(first.totalPages).toBe(3);
    expect(first.hasNext).toBe(true);
    expect(first.hasPrevious).toBe(false);

    const second = await listProductVersions(product.productId, { page: 1, size: 2 });
    expect(second.items.map((e) => e.changeType)).toEqual(["VARIANT_STATUS", "SUBMITTED"]);
    expect(second.items[0]).toMatchObject({
      subjectType: "VARIANT",
      fromStatus: "DRAFT",
      toStatus: "ACTIVE",
    });

    const third = await listProductVersions(product.productId, { page: 2, size: 2 });
    expect(third.items.map((e) => e.changeType)).toEqual(["CREATED"]);
    expect(third.hasNext).toBe(false);
    expect(third.hasPrevious).toBe(true);
  });

  it("sửa thông tin ghi tên các trường đã đổi; sửa không đổi gì thì không ghi dòng mới", async () => {
    const product = await draft();
    const body = {
      name: "Tên mới",
      nameEn: product.nameEn,
      categoryId: product.categoryId ?? "",
      brandId: product.brandId ?? "",
      description: "",
      descriptionEn: "",
      taxClass: "STANDARD" as const,
      kind: "STANDARD" as const,
    };
    const saved = await updateProduct({ id: product.productId, ...body, version: product.version });
    const history = await listProductVersions(product.productId);
    expect(history.items.map((e) => [e.changeType, e.changedFields])).toEqual([
      ["UPDATED", ["name"]],
      ["CREATED", []],
    ]);
    await updateProduct({ id: product.productId, ...body, version: saved.version });
    expect((await listProductVersions(product.productId)).totalElements).toBe(2);
  });

  it("sản phẩm không tồn tại → 404 PRODUCT_NOT_FOUND", async () => {
    expect((await apiError(listProductVersions("không-có"))).code).toBe("PRODUCT_NOT_FOUND");
    expect((await apiError(getOpenReferences("không-có"))).code).toBe("PRODUCT_NOT_FOUND");
  });
});
