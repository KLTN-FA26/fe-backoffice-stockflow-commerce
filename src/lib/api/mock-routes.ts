/**
 * Mock routes — register all mock API handlers.
 *
 * Each handler reads from mock-data.ts and returns paginated/filtered results.
 * Called once by activateMockAdapter() → registerAllMockRoutes().
 *
 * **Only this file + mock-adapter.ts may import mock-data.ts.**
 */

import { registerMockRoute, paginate } from "./mock-adapter";
import {
  allMockProducts,
  createdProducts,
  deleteMockProduct,
  findMockProduct,
  saveMockProduct,
} from "./mock-product-store";
import {
  beProductStatus,
  clearMockHistory,
  mockHistoryPage,
  recordMockHistory,
} from "./mock-product-history";
import { fail, noContent, ok, queryOf } from "./mock-route-utils";
import { brandStore, findMockBrand, findMockCategory } from "./mock-routes-taxonomy-store";
import {
  activateMockDraftVariants,
  createMockProductMatrix,
  deleteMockProductVariants,
  mockOpenReferences,
  obsoleteMockVariants,
} from "./mock-routes-variants";

import type { Product } from "@/lib/mock-data";
import type { MockProduct } from "./mock-product-store";

/** BE PR #71 `CreateProductRequest` / `UpdateProductRequest` (+ `reason` của rejection). */
interface CreateProductMockBody {
  productId?: unknown;
  code?: unknown;
  name?: unknown;
  nameEn?: unknown;
  brandId?: unknown;
  categoryId?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  descriptionEn?: unknown;
  taxClass?: unknown;
  kind?: unknown;
  reason?: unknown;
  version?: unknown;
  /** BE PR #116 `CreateProductRequest.axes`. */
  axes?: unknown;
}

/**
 * Seed mock chỉ có tên thương hiệu; BE PR #71 trả kèm `brandId`. Thương hiệu / danh mục đọc từ store
 * của màn Thương hiệu & danh mục (`mock-routes-taxonomy-store.ts`) — bản vừa tạo dùng được ngay.
 */
function withBrandId(product: MockProduct): MockProduct {
  return {
    ...product,
    version: product.version ?? 0,
    brandId:
      product.brandId || (brandStore().find((b) => b.name === product.brand)?.brandId ?? null),
  };
}

function validationFailed(fieldErrors: Record<string, string>) {
  return {
    status: 422,
    data: {
      errorCode: "VALIDATION_FAILED",
      message: "Dữ liệu sản phẩm chưa hợp lệ.",
      fieldErrors: Object.entries(fieldErrors).map(([field, message]) => ({
        field,
        message,
        code: "NotBlank",
      })),
    },
    headers: {},
  };
}

const brandNotFound = () => ({
  status: 404,
  data: {
    errorCode: "BRAND_NOT_FOUND",
    message: "Thương hiệu đã chọn không tồn tại.",
    fieldErrors: [{ field: "brandId", message: "Thương hiệu không còn khả dụng.", code: "Exists" }],
  },
  headers: {},
});
const MOCK_SUBMITTER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_APPROVER_ID = "22222222-2222-4222-8222-222222222222";

export function registerAllMockRoutes(): void {
  /* ====================================================================
   * Module 01 — Products / SKUs / Categories / Suppliers
   * ==================================================================*/

  // GET /products
  registerMockRoute("GET", "/products", async (config) => {
    const products = await allMockProducts();
    const params = readRequestSearchParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const pageSize = Math.max(1, Number(params.get("size")) || 15);
    const q = params.get("q")?.trim().toLowerCase();
    const statuses = params
      .getAll("status")
      .map(readProductStatus)
      .filter((status): status is Product["status"] => status !== null);
    const [sortField = "code", sortDirection = "asc"] = (params.get("sort") ?? "code,asc").split(
      ",",
    );

    let filtered = products.map(withBrandId);
    if (q)
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q),
      );
    if (statuses.length) filtered = filtered.filter((p) => statuses.includes(p.status));
    if (sortField === "code" || sortField === "name" || sortField === "status") {
      filtered.sort((left, right) => {
        const leftValue = sortField === "code" ? left.productId : left[sortField];
        const rightValue = sortField === "code" ? right.productId : right[sortField];
        return sortDirection === "desc"
          ? rightValue.localeCompare(leftValue)
          : leftValue.localeCompare(rightValue);
      });
    }

    const totalElements = filtered.length;
    const totalPages = Math.ceil(totalElements / pageSize);
    const start = page * pageSize;
    return {
      status: 200,
      data: {
        items: filtered.slice(start, start + pageSize),
        page,
        size: pageSize,
        totalElements,
        totalPages,
        hasNext: page + 1 < totalPages,
        hasPrevious: page > 0,
      },
      headers: {},
    };
  });

  // GET /products/:id
  registerMockRoute("GET", "/products/:id", async (config) => {
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const product = await findMockProduct(id);
    if (!product) return { status: 404, data: { message: "Product not found" }, headers: {} };
    return { status: 200, data: withBrandId(product), headers: {} };
  });

  // POST /products
  registerMockRoute("POST", "/products", async (config) => {
    const body = parseCreateProductBody(config.data);
    // BE upper-cases the code (`ProductWebMapper#toCommand`); mock products are keyed by it.
    const productId = (readString(body.code) || readString(body.productId)).toUpperCase();
    const fieldErrors: Record<string, string> = {};

    if (!productId) fieldErrors.productId = "Nhập mã sản phẩm";
    if (!readString(body.name)) fieldErrors.name = "Nhập tên sản phẩm";
    if (!readString(body.nameEn)) fieldErrors.nameEn = "Nhập tên tiếng Anh";
    if (!readString(body.categoryId)) fieldErrors.categoryId = "Chọn danh mục";
    if (Object.keys(fieldErrors).length > 0) return validationFailed(fieldErrors);
    const brand = findMockBrand(readString(body.brandId));
    if (readString(body.brandId) && !brand) return brandNotFound();

    const duplicated = (await allMockProducts()).some((product) => product.productId === productId);
    if (duplicated) {
      return {
        status: 409,
        data: {
          errorCode: "PRODUCT_CODE_ALREADY_EXISTS",
          message: "Mã sản phẩm đã tồn tại.",
          fieldErrors: [{ field: "code", message: "Mã sản phẩm đã tồn tại.", code: "Unique" }],
        },
        headers: {},
      };
    }

    const categoryId = readString(body.categoryId);
    if (!(await findMockCategory(categoryId))) {
      return {
        status: 404,
        data: {
          errorCode: "CATEGORY_NOT_FOUND",
          message: "Danh mục đã chọn không tồn tại.",
          fieldErrors: [
            {
              field: "categoryId",
              message: "Danh mục đã bị xoá hoặc không còn khả dụng.",
              code: "Exists",
            },
          ],
        },
        headers: {},
      };
    }

    const now = new Date().toISOString();
    const product: MockProduct = {
      productId,
      name: readString(body.name),
      nameEn: readString(body.nameEn) || readString(body.name),
      slug: slugify(readString(body.name) || productId),
      // BE PR #71: `kind` thay `customizable`; ảnh theo biến thể, logistics theo SKU.
      type: body.kind === "CUSTOMIZABLE" ? "Customizable" : "Standard",
      categoryId,
      status: "Draft",
      shortDescription: readString(body.shortDescription) || undefined,
      description: readString(body.description),
      descriptionEn: readString(body.descriptionEn),
      images: [],
      basePrice: 0,
      attributes: [],
      taxClass: readTaxClass(
        typeof body.taxClass === "string" ? body.taxClass.toLowerCase() : body.taxClass,
      ),
      uom: "pcs",
      brand: brand?.name ?? "",
      brandId: brand?.brandId ?? null,
      createdAt: now,
      createdBy: "Mock API",
      version: 0,
    };

    // BE PR #116: có `axes` thì tạo cả ma trận trong cùng giao dịch — bị từ chối (SKU trùng, ma trận
    // quá lớn…) thì không để lại sản phẩm nào (ở mock: kiểm tra hết rồi mới ghi).
    const matrix = await createMockProductMatrix({
      productId,
      productName: product.name,
      axes: body.axes,
    });
    if (matrix.error) return matrix.error;

    createdProducts.push(product);
    recordMockHistory(productId, "CREATED", { toStatus: "DRAFT" });
    return { status: 201, data: product, headers: {} };
  });

  registerMockRoute("PUT", "/products/:id", async (config) => {
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current = await findMockProduct(id);
    if (!current)
      return {
        status: 404,
        data: { errorCode: "PRODUCT_NOT_FOUND", message: "Product not found" },
        headers: {},
      };
    const body = parseCreateProductBody(config.data);
    // BE `UpdateProductRequest.version` @NotNull; đã đổi kể từ lần đọc → 409 OPTIMISTIC_LOCK.
    const stale = checkProductVersion(body.version, current);
    if (stale) return stale;
    const brand = findMockBrand(readString(body.brandId));
    if (readString(body.brandId) && !brand) return brandNotFound();
    const updated: MockProduct = {
      ...current,
      version: (current.version ?? 0) + 1,
      name: readString(body.name),
      nameEn: readString(body.nameEn),
      categoryId: readString(body.categoryId),
      shortDescription: readString(body.shortDescription) || undefined,
      description: readString(body.description),
      descriptionEn: readString(body.descriptionEn),
      brand: brand?.name ?? "",
      brandId: brand?.brandId ?? null,
      type: body.kind === "CUSTOMIZABLE" ? "Customizable" : "Standard",
      taxClass: readTaxClass(
        typeof body.taxClass === "string" ? body.taxClass.toLowerCase() : body.taxClass,
      ),
    };
    // BE `Product.updateDetails`: chỉ sửa được khi còn Nháp.
    if (current.status !== "Draft") return invalidTransition();
    saveMockProduct(updated);
    const changed = changedProductFields(current, updated);
    if (changed.length > 0) recordMockHistory(id, "UPDATED", { changedFields: changed });
    return { status: 200, data: updated, headers: {} };
  });

  registerProductTransitionRoutes();
  registerProductLifecycleRoutes();

  // GET /categories, /brands (+ tạo / sửa): mock-routes-taxonomy.ts

  // Suppliers: xem mock-routes-suppliers.ts (đăng ký trong mock-adapter.ts)

  /* ====================================================================
   * Module 02 — Purchase Orders / Replenishment
   * ==================================================================*/

  // Purchase orders: mock-routes-purchase-orders.ts (BE PurchaseOrderController contract).

  // FE-only: BE has no GET /api/v1/replenishment-proposals yet.
  // GET /replenishment-proposals
  registerMockRoute("GET", "/replenishment-proposals", async (config) => {
    const { replenishmentProposals } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;

    return { status: 200, data: paginate(replenishmentProposals, page, pageSize), headers: {} };
  });

  /* ====================================================================
   * Module 04 — Invoices
   * ==================================================================*/

  registerMockRoute("GET", "/invoices", async (config) => {
    const { invoices } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...invoices];
    if (status.length) filtered = filtered.filter((i) => status.includes(i.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/invoices/:id", async (config) => {
    const { invoices } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const invoice = invoices.find((i) => i.invoiceId === id);
    if (!invoice) return { status: 404, data: { message: "Invoice not found" }, headers: {} };
    return { status: 200, data: invoice, headers: {} };
  });

  /* ====================================================================
   * Module 05 — Putaway Tasks
   * ==================================================================*/

  registerMockRoute("GET", "/putaway-tasks", async (config) => {
    const { putawayTasks } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...putawayTasks];
    if (status.length) filtered = filtered.filter((t) => status.includes(t.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/putaway-tasks/:id", async (config) => {
    const { putawayTasks } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const task = putawayTasks.find((t) => t.taskId === id);
    if (!task) return { status: 404, data: { message: "Putaway task not found" }, headers: {} };
    return { status: 200, data: task, headers: {} };
  });

  /* ====================================================================
   * Module 06 — Warehouses / Zones / Locations / Slotting
   * ==================================================================*/

  registerMockRoute("GET", "/warehouses", async (config) => {
    const { warehouses } = await import("@/lib/mock-data");
    // = BE `?status=ACTIVE|INACTIVE` (bỏ trống = mọi trạng thái): màn chọn kho chỉ hiện kho đang hoạt động
    const status = new URLSearchParams(config.url?.split("?")[1] ?? "").get("status");
    const items = status
      ? warehouses.filter((w) => (w.active ? "ACTIVE" : "INACTIVE") === status.toUpperCase())
      : warehouses;
    return { status: 200, data: { items, total: items.length }, headers: {} };
  });

  registerMockRoute("GET", "/warehouses/:id", async (config) => {
    const { warehouses } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const wh = warehouses.find((w) => w.warehouseId === id);
    if (!wh) return { status: 404, data: { message: "Warehouse not found" }, headers: {} };
    return { status: 200, data: wh, headers: {} };
  });

  registerMockRoute("GET", "/zones", async () => {
    const { zones } = await import("@/lib/mock-data");
    return { status: 200, data: { items: zones, total: zones.length }, headers: {} };
  });

  registerMockRoute("GET", "/locations", async (config) => {
    const { locations } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 50;

    return { status: 200, data: paginate(locations, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/slotting-suggestions", async () => {
    const { slottingSuggestions } = await import("@/lib/mock-data");
    return {
      status: 200,
      data: { items: slottingSuggestions, total: slottingSuggestions.length },
      headers: {},
    };
  });

  registerMockRoute("GET", "/warehouse-kpis", async () => {
    const { warehouseKpis } = await import("@/lib/mock-data");
    return {
      status: 200,
      data: { items: warehouseKpis, total: warehouseKpis.length },
      headers: {},
    };
  });

  // Module 07/08 (lấy hàng, đóng gói): API thật `/fulfillment/tasks` — mock ở
  // `mock-routes-fulfillment.ts` (SCRUM-437).

  // Module 09 (chuyến xe) và 10 (lệnh chuyển kho) theo hợp đồng BE: mock-routes-dispatch.ts,
  // mock-routes-transfer-orders.ts — route cũ /shipments, /carriers, /transfer-orders đã bỏ.

  /* ====================================================================
   * Module 11 — Move Tasks
   * ==================================================================*/

  registerMockRoute("GET", "/move-tasks", async (config) => {
    const { moveTasks } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...moveTasks];
    if (status.length) filtered = filtered.filter((t) => status.includes(t.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/move-tasks/:id", async (config) => {
    const { moveTasks } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const task = moveTasks.find((t) => t.moveTaskId === id);
    if (!task) return { status: 404, data: { message: "Move task not found" }, headers: {} };
    return { status: 200, data: task, headers: {} };
  });

  /* ====================================================================
   * Staff Users (for admin user management)
   * ==================================================================*/

  registerMockRoute("GET", "/staff-users", async () => {
    const { staffUsers } = await import("@/lib/mock-data");
    return { status: 200, data: { items: staffUsers, total: staffUsers.length }, headers: {} };
  });
}

/** Ghi lịch sử cho một lần chuyển trạng thái thành công (như `ProductServiceImpl` ghi `product_change_log`). */
interface TransitionHistory {
  type: "SUBMITTED" | "APPROVED" | "REJECTED" | "SUSPENDED" | "RESUMED" | "DISCONTINUED";
  reason?: string;
}

function registerProductTransitionRoutes(): void {
  registerProductTransition(
    "submission",
    ["Draft"],
    "Pending Approval",
    (product) => ({
      ...product,
      submittedBy: MOCK_SUBMITTER_ID,
      submittedAt: new Date().toISOString(),
    }),
    false,
    () => ({ type: "SUBMITTED" }),
  );
  registerProductTransition(
    "approval",
    ["Pending Approval"],
    "Approved",
    (product) => ({
      ...product,
      approvedBy: MOCK_APPROVER_ID,
      approvedAt: new Date().toISOString(),
    }),
    false,
    () => ({ type: "APPROVED" }),
    // BE `ProductServiceImpl.approve`: các biến thể nháp được kích hoạt cùng sản phẩm.
    (id) => activateMockDraftVariants(id),
  );
  // BE `DiscontinueProductRequest`: `reason` (≤ 500) + `version` bắt buộc; từ Approved / Published /
  // Inactive. Trả sản phẩm + `warnings` (PO / đơn mở còn tham chiếu SKU — cảnh báo, không từ chối) và
  // chính các chứng từ đó; mọi biến thể thành OBSOLETE.
  registerMockRoute("POST", "/products/:id/discontinuation", async (config) => {
    const body = parseCreateProductBody(config.data);
    const reason = readString(body.reason);
    if (!reason || reason.length > 500) {
      return mockValidationError("reason", "reason is required (at most 500 characters)");
    }
    if (typeof body.version !== "number")
      return mockValidationError("version", "version is required");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current = await findMockProduct(id);
    const stale = current ? checkProductVersion(body.version, current) : null;
    if (stale) return stale;
    // Đọc chứng từ còn mở TRƯỚC khi các biến thể bị ngừng dùng (như BE).
    const open = await mockOpenReferences(id);
    const result = await transitionMockProduct(
      config,
      ["Approved", "Published", "Inactive"],
      "Discontinued",
      (product) => ({
        ...product,
        discontinuedAt: new Date().toISOString(),
        discontinueReason: reason,
        suspendedAt: undefined,
        suspendReason: undefined,
      }),
      false,
      () => ({ type: "DISCONTINUED", reason }),
      (productId) => obsoleteMockVariants(productId, reason),
    );
    if (result.status !== 200) return result;
    const kinds = new Set(open.references.map((reference) => reference.kind));
    const warnings = [
      ...(kinds.has("PURCHASE_ORDER_LINE") ? ["OPEN_PURCHASE_ORDER_LINES"] : []),
      ...(kinds.has("SALES_ORDER_LINE") ? ["UNSHIPPED_ORDER_LINES"] : []),
    ];
    return {
      ...result,
      data: {
        ...(result.data as object),
        warnings,
        openReferences: open.references,
        openReferencesTruncated: open.truncated,
      },
    };
  });
  registerProductTransition("unpublication", ["Published"], "Approved", undefined, true);
  registerProductTransition("publication", ["Approved"], "Published", undefined, true);

  registerMockRoute("POST", "/products/:id/rejection", async (config) => {
    const body = parseCreateProductBody(config.data);
    const reason = readString(body.reason);
    if (!reason) {
      return mockValidationError("reason", "Lý do từ chối là bắt buộc.");
    }
    return transitionMockProduct(
      config,
      ["Pending Approval"],
      "Draft",
      (product) => ({
        ...product,
        submittedBy: undefined,
        submittedAt: undefined,
      }),
      false,
      () => ({ type: "REJECTED", reason }),
    );
  });
}

/**
 * BE SCRUM-461: tạm ngưng (`reason` + `version`, từ Approved / Published), tiếp tục (`version`, từ
 * Inactive), xoá nháp (`?version=`, chỉ Draft), chứng từ còn mở và lịch sử thay đổi.
 */
function registerProductLifecycleRoutes(): void {
  registerMockRoute("POST", "/products/:id/suspension", async (config) => {
    const body = parseCreateProductBody(config.data);
    const reason = readString(body.reason);
    if (!reason || reason.length > 500) {
      return mockValidationError("reason", "reason is required (at most 500 characters)");
    }
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current = await findMockProduct(id);
    const stale = current ? checkProductVersion(body.version, current) : null;
    if (stale) return stale;
    return transitionMockProduct(
      config,
      ["Approved", "Published"],
      "Inactive",
      (product) => ({
        ...product,
        suspendedAt: new Date().toISOString(),
        suspendReason: reason,
      }),
      false,
      () => ({ type: "SUSPENDED", reason }),
    );
  });

  registerMockRoute("POST", "/products/:id/resumption", async (config) => {
    const body = parseCreateProductBody(config.data);
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current = await findMockProduct(id);
    const stale = current ? checkProductVersion(body.version, current) : null;
    if (stale) return stale;
    return transitionMockProduct(
      config,
      ["Inactive"],
      "Approved",
      (product) => ({ ...product, suspendedAt: undefined, suspendReason: undefined }),
      false,
      () => ({ type: "RESUMED" }),
    );
  });

  registerMockRoute("DELETE", "/products/:id", async (config) => {
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current = await findMockProduct(id);
    if (!current) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const raw = readRequestSearchParams(config).get("version");
    if (raw === null || raw === "" || !Number.isInteger(Number(raw))) {
      return mockValidationError("version", "version is required");
    }
    const stale = checkProductVersion(Number(raw), current);
    if (stale) return stale;
    // BE `Product.requireDeletable` (BR-02 docs 01): chỉ xoá được sản phẩm Nháp.
    if (current.status !== "Draft") {
      return fail(409, "PRODUCT_NOT_DELETABLE", "Only a draft product can be deleted");
    }
    // BE `ProductService.deleteDraft`: còn PO / đơn mở tham chiếu SKU → 409 PRODUCT_IN_USE.
    const open = await mockOpenReferences(id);
    if (open.references.length > 0) {
      return fail(409, "PRODUCT_IN_USE", "A SKU of this product is still referenced");
    }
    await deleteMockProductVariants(id);
    deleteMockProduct(id);
    clearMockHistory(id);
    return noContent();
  });

  registerMockRoute("GET", "/products/:id/open-references", async (config) => {
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    if (!(await findMockProduct(id))) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    return ok(await mockOpenReferences(id));
  });

  registerMockRoute("GET", "/products/:id/versions", async (config) => {
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    if (!(await findMockProduct(id))) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
    const query = queryOf(config);
    const page = Math.max(0, Number(query.get("page")) || 0);
    const size = Math.min(200, Math.max(1, Number(query.get("size")) || 20));
    return ok(mockHistoryPage(id, page, size));
  });
}

function registerProductTransition(
  suffix: string,
  fromStatuses: Product["status"][],
  targetStatus: Product["status"],
  enrich?: (product: MockProduct) => MockProduct,
  voidResponse = false,
  history?: () => TransitionHistory,
  afterCommit?: (productId: string) => void | Promise<void>,
): void {
  registerMockRoute("POST", `/products/:id/${suffix}`, (config) =>
    transitionMockProduct(
      config,
      fromStatuses,
      targetStatus,
      enrich,
      voidResponse,
      history,
      afterCommit,
    ),
  );
}

const invalidTransition = () =>
  fail(
    409,
    "INVALID_PRODUCT_STATUS_TRANSITION",
    "This product cannot move to that status right now",
  );

async function transitionMockProduct(
  config: import("axios").AxiosRequestConfig,
  fromStatuses: Product["status"][],
  targetStatus: Product["status"],
  enrich?: (product: MockProduct) => MockProduct,
  voidResponse = false,
  history?: () => TransitionHistory,
  afterCommit?: (productId: string) => void | Promise<void>,
) {
  const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  const current = await findMockProduct(id);
  if (!current) {
    return {
      status: 404,
      data: { errorCode: "PRODUCT_NOT_FOUND", message: "Product not found" },
      headers: {},
    };
  }
  if (!fromStatuses.includes(current.status)) return invalidTransition();
  const next = { ...current, status: targetStatus, version: (current.version ?? 0) + 1 };
  const transitioned = enrich?.(next) ?? next;
  saveMockProduct(transitioned);
  await afterCommit?.(id);
  const entry = history?.();
  if (entry) {
    recordMockHistory(id, entry.type, {
      fromStatus: beProductStatus(current.status),
      toStatus: beProductStatus(targetStatus),
      reason: entry.reason,
    });
  }
  return { status: 200, data: voidResponse ? null : transitioned, headers: {} };
}

/** Tên các trường mà một lần sửa nháp đã đổi — như `Product.updateDetails` trả về cho lịch sử. */
function changedProductFields(before: MockProduct, after: MockProduct): string[] {
  const pairs: [string, unknown, unknown][] = [
    ["name", before.name, after.name],
    ["nameEn", before.nameEn, after.nameEn],
    ["brandId", before.brandId ?? null, after.brandId ?? null],
    ["categoryId", before.categoryId, after.categoryId],
    ["shortDescription", before.shortDescription ?? "", after.shortDescription ?? ""],
    ["description", before.description, after.description],
    ["descriptionEn", before.descriptionEn, after.descriptionEn],
    ["taxClass", before.taxClass, after.taxClass],
    ["kind", before.type, after.type],
  ];
  return pairs.filter(([, left, right]) => left !== right).map(([field]) => field);
}

/** `version` thiếu → 400 VALIDATION_FAILED; khác bản hiện tại → 409 OPTIMISTIC_LOCK (như BE). */
function checkProductVersion(version: unknown, current: MockProduct) {
  if (typeof version !== "number") return mockValidationError("version", "version is required");
  if (version !== (current.version ?? 0)) {
    return {
      status: 409,
      data: {
        errorCode: "OPTIMISTIC_LOCK",
        message: "The record changed meanwhile, please retry",
      },
      headers: {},
    };
  }
  return null;
}

function mockValidationError(field: string, message: string) {
  return {
    status: 400,
    data: {
      errorCode: "VALIDATION_FAILED",
      message: "Dữ liệu không hợp lệ.",
      fieldErrors: [{ field, message, code: "NotBlank" }],
    },
    headers: {},
  };
}

function parseCreateProductBody(data: unknown): CreateProductMockBody {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(data) ? data : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRequestSearchParams(config: { url?: string; params?: unknown }): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

function readProductStatus(value: string): Product["status"] | null {
  switch (value) {
    case "DRAFT":
      return "Draft";
    case "PENDING_APPROVAL":
      return "Pending Approval";
    case "APPROVED":
      return "Approved";
    case "PUBLISHED":
      return "Published";
    case "INACTIVE":
      return "Inactive";
    case "DISCONTINUED":
      return "Discontinued";
    default:
      return null;
  }
}

function readTaxClass(value: unknown): Product["taxClass"] {
  return value === "reduced" || value === "exempt" ? value : "standard";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
