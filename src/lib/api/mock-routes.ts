/**
 * Mock routes — register all mock API handlers.
 *
 * Each handler reads from mock-data.ts and returns paginated/filtered results.
 * Called once by activateMockAdapter() → registerAllMockRoutes().
 *
 * **Only this file + mock-adapter.ts may import mock-data.ts.**
 */

import { registerMockRoute, paginate } from "./mock-adapter";

import type { AxiosRequestConfig } from "axios";

import type {
  PrintArea,
  PrintTechnique,
  Product,
  ProductAttribute,
  ProductType,
  PoStatus,
  PurchaseOrder,
  Uom,
} from "@/lib/mock-data";

interface CreateProductMockBody {
  productId?: unknown;
  code?: unknown;
  name?: unknown;
  nameEn?: unknown;
  type?: unknown;
  categoryId?: unknown;
  description?: unknown;
  descriptionEn?: unknown;
  images?: unknown;
  model3dUrl?: unknown;
  basePrice?: unknown;
  attributes?: unknown;
  printAreas?: unknown;
  taxClass?: unknown;
  uom?: unknown;
  brand?: unknown;
}

const createdProducts: Product[] = [];

export function registerAllMockRoutes(): void {
  /* ====================================================================
   * Module 01 — Products / SKUs / Categories / Suppliers
   * ==================================================================*/

  // GET /products
  registerMockRoute("GET", "/products", async (config) => {
    const { products } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const q = params.get("q")?.toLowerCase();
    const status = params.getAll("status");

    let filtered = [...products, ...createdProducts];
    if (q)
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q),
      );
    if (status.length) filtered = filtered.filter((p) => status.includes(p.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /products/:id
  registerMockRoute("GET", "/products/:id", async (config) => {
    const { products } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const product = [...products, ...createdProducts].find((p) => p.productId === id);
    if (!product) return { status: 404, data: { message: "Product not found" }, headers: {} };
    return { status: 200, data: product, headers: {} };
  });

  // POST /products
  registerMockRoute("POST", "/products", async (config) => {
    const { categories, products } = await import("@/lib/mock-data");
    const body = parseCreateProductBody(config.data);
    const productId = readString(body.productId) || readString(body.code);
    const fieldErrors: Record<string, string> = {};

    if (!productId) fieldErrors.productId = "Nhập mã sản phẩm";
    if (!readString(body.name)) fieldErrors.name = "Nhập tên sản phẩm";
    if (!readString(body.brand)) fieldErrors.brand = "Nhập thương hiệu";
    if (!readString(body.categoryId)) fieldErrors.categoryId = "Chọn danh mục";
    if (readProductAttributes(body.attributes).length === 0) {
      fieldErrors.attributes = "Cần ít nhất 1 thuộc tính biến thể";
    }
    if (
      body.type === "Customizable" &&
      !readPrintAreas(body.printAreas, productId || "PRD-DRAFT")
    ) {
      fieldErrors.printAreas = "Sản phẩm tùy chỉnh cần ít nhất 1 vùng in";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return {
        status: 422,
        data: {
          code: "VALIDATION_FAILED",
          message: "Dữ liệu sản phẩm chưa hợp lệ.",
          fieldErrors,
        },
        headers: {},
      };
    }

    const duplicated = [...products, ...createdProducts].some(
      (product) => product.productId === productId,
    );
    if (duplicated) {
      return {
        status: 409,
        data: {
          code: "PRODUCT_CODE_ALREADY_EXISTS",
          message: "Mã sản phẩm đã tồn tại.",
          fieldErrors: {
            code: "Mã sản phẩm đã tồn tại.",
          },
        },
        headers: {},
      };
    }

    const categoryId = readString(body.categoryId);
    const categoryExists = categories.some((category) => category.categoryId === categoryId);
    if (!categoryExists) {
      return {
        status: 404,
        data: {
          code: "CATEGORY_NOT_FOUND",
          message: "Danh mục đã chọn không tồn tại.",
          fieldErrors: {
            categoryId: "Danh mục đã bị xoá hoặc không còn khả dụng.",
          },
        },
        headers: {},
      };
    }

    const now = new Date().toISOString();
    const product: Product = {
      productId,
      name: readString(body.name),
      nameEn: readString(body.nameEn) || readString(body.name),
      slug: slugify(readString(body.name) || productId),
      type: readProductType(body.type),
      categoryId,
      status: "Draft",
      description: readString(body.description),
      descriptionEn: readString(body.descriptionEn),
      images: readStringArray(body.images),
      model3dUrl: readOptionalString(body.model3dUrl),
      basePrice: readNumber(body.basePrice),
      attributes: readProductAttributes(body.attributes),
      printAreas: readPrintAreas(body.printAreas, productId),
      taxClass: readTaxClass(body.taxClass),
      uom: readUom(body.uom),
      brand: readString(body.brand),
      createdAt: now,
      createdBy: "Mock API",
    };

    createdProducts.push(product);
    return { status: 201, data: product, headers: {} };
  });

  // FE-only (no BE endpoint yet — BE has no GET /api/v1/skus). The PO screens
  // (create form / list / detail) read this master data from the mock so the
  // "Tạo PO" flow can be exercised end-to-end; swap for the real API once BE ships it.
  // GET /skus
  registerMockRoute("GET", "/skus", async (config) => {
    const { skus } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const q = params.get("q")?.toLowerCase();

    let filtered = [...skus];
    if (q)
      filtered = filtered.filter(
        (s) =>
          s.skuId.toLowerCase().includes(q) ||
          s.variantLabel.toLowerCase().includes(q) ||
          s.barcode.toLowerCase().includes(q),
      );

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /skus/:id
  registerMockRoute("GET", "/skus/:id", async (config) => {
    const { skus } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const sku = skus.find((s) => s.skuId === id);
    if (!sku) return { status: 404, data: { message: "SKU not found" }, headers: {} };
    return { status: 200, data: sku, headers: {} };
  });

  // GET /categories
  registerMockRoute("GET", "/categories", async () => {
    const { categories } = await import("@/lib/mock-data");
    return { status: 200, data: { items: categories, total: categories.length }, headers: {} };
  });

  // FE-only (no BE endpoint yet — BE has no GET /api/v1/suppliers). The PO screens
  // (create form / list / detail) read this master data from the mock so the
  // "Tạo PO" flow can be exercised end-to-end; swap for the real API once BE ships it.
  // GET /suppliers
  registerMockRoute("GET", "/suppliers", async (config) => {
    const { suppliers } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const q = params.get("q")?.toLowerCase();

    let filtered = [...suppliers];
    if (q)
      filtered = filtered.filter(
        (s) => s.name.toLowerCase().includes(q) || s.supplierId.toLowerCase().includes(q),
      );

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /suppliers/:id
  registerMockRoute("GET", "/suppliers/:id", async (config) => {
    const { suppliers } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const supplier = suppliers.find((s) => s.supplierId === id);
    if (!supplier) return { status: 404, data: { message: "Supplier not found" }, headers: {} };
    return { status: 200, data: supplier, headers: {} };
  });

  /* ====================================================================
   * Module 02 — Purchase Orders / Replenishment
   * ==================================================================*/

  registerPurchaseOrderMockRoutes();

  // FE-only (no BE endpoint yet — BE has no GET /api/v1/replenishment-proposals). The PO screens
  // (create form / list / detail) read this master data from the mock so the
  // "Tạo PO" flow can be exercised end-to-end; swap for the real API once BE ships it.
  // GET /replenishment-proposals
  registerMockRoute("GET", "/replenishment-proposals", async (config) => {
    const { replenishmentProposals } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;

    return { status: 200, data: paginate(replenishmentProposals, page, pageSize), headers: {} };
  });

  /* ====================================================================
   * Module 03 — Receipts / Lots
   * ==================================================================*/

  // GET /receipts
  registerMockRoute("GET", "/receipts", async (config) => {
    const { receipts } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...receipts];
    if (status.length) filtered = filtered.filter((r) => status.includes(r.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /receipts/:id
  registerMockRoute("GET", "/receipts/:id", async (config) => {
    const { receipts } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const receipt = receipts.find((r) => r.receiptId === id);
    if (!receipt) return { status: 404, data: { message: "Receipt not found" }, headers: {} };
    return { status: 200, data: receipt, headers: {} };
  });

  // GET /lots
  registerMockRoute("GET", "/lots", async (config) => {
    const { lots } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;

    return { status: 200, data: paginate(lots, page, pageSize), headers: {} };
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

  // FE-only (BE WarehouseController is still a stub with no endpoints). The PO list and
  // detail read warehouse names from here; swap for the real API once BE ships it.
  registerMockRoute("GET", "/warehouses", async () => {
    const { warehouses } = await import("@/lib/mock-data");
    return { status: 200, data: { items: warehouses, total: warehouses.length }, headers: {} };
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

  /* ====================================================================
   * Module 07 — Pick Tasks
   * ==================================================================*/

  registerMockRoute("GET", "/pick-tasks", async (config) => {
    const { pickTasks } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...pickTasks];
    if (status.length) filtered = filtered.filter((t) => status.includes(t.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/pick-tasks/:id", async (config) => {
    const { pickTasks } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const task = pickTasks.find((t) => t.pickId === id);
    if (!task) return { status: 404, data: { message: "Pick task not found" }, headers: {} };
    return { status: 200, data: task, headers: {} };
  });

  /* ====================================================================
   * Module 08 — Packing Tasks
   * ==================================================================*/

  registerMockRoute("GET", "/packing-tasks", async (config) => {
    const { packingTasks } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...packingTasks];
    if (status.length) filtered = filtered.filter((t) => status.includes(t.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/packing-tasks/:id", async (config) => {
    const { packingTasks } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const task = packingTasks.find((t) => t.taskId === id);
    if (!task) return { status: 404, data: { message: "Packing task not found" }, headers: {} };
    return { status: 200, data: task, headers: {} };
  });

  /* ====================================================================
   * Module 09 — Shipments / Carriers
   * ==================================================================*/

  registerMockRoute("GET", "/shipments", async (config) => {
    const { shipments } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...shipments];
    if (status.length) filtered = filtered.filter((s) => status.includes(s.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/shipments/:id", async (config) => {
    const { shipments } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const shipment = shipments.find((s) => s.shipmentId === id);
    if (!shipment) return { status: 404, data: { message: "Shipment not found" }, headers: {} };
    return { status: 200, data: shipment, headers: {} };
  });

  registerMockRoute("GET", "/carriers", async () => {
    const { carriers } = await import("@/lib/mock-data");
    return { status: 200, data: { items: carriers, total: carriers.length }, headers: {} };
  });

  /* ====================================================================
   * Module 10 — Transfer Orders
   * ==================================================================*/

  registerMockRoute("GET", "/transfer-orders", async (config) => {
    const { transferOrders } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...transferOrders];
    if (status.length) filtered = filtered.filter((t) => status.includes(t.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/transfer-orders/:id", async (config) => {
    const { transferOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const transfer = transferOrders.find((t) => t.transferOrderId === id);
    if (!transfer) return { status: 404, data: { message: "Transfer not found" }, headers: {} };
    return { status: 200, data: transfer, headers: {} };
  });

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
   * Module 14 — Orders
   * ==================================================================*/

  registerMockRoute("GET", "/orders", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const status = params.getAll("status");

    let filtered = [...orders];
    if (status.length) filtered = filtered.filter((o) => status.includes(o.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  registerMockRoute("GET", "/orders/:id", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const order = orders.find((o) => o.orderId === id);
    if (!order) return { status: 404, data: { message: "Order not found" }, headers: {} };
    return { status: 200, data: order, headers: {} };
  });

  /* ====================================================================
   * Staff Users (for admin user management)
   * ==================================================================*/

  registerMockRoute("GET", "/staff-users", async () => {
    const { staffUsers } = await import("@/lib/mock-data");
    return { status: 200, data: { items: staffUsers, total: staffUsers.length }, headers: {} };
  });

  /* ====================================================================
   * Auth routes (handled by auth-api.ts, registered here for completeness)
   * ==================================================================*/

  registerMockRoute("POST", "/auth/login", async (config) => {
    const { staffUsers } = await import("@/lib/mock-data");
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const user = staffUsers.find((u) => u.userId === body?.userId || u.email === body?.email);

    if (!user) {
      return { status: 401, data: { message: "Email hoặc mật khẩu không đúng" }, headers: {} };
    }

    return {
      status: 200,
      data: {
        accessToken: `mock-access-${user.userId}-${Date.now()}`,
        refreshToken: `mock-refresh-${user.userId}-${Date.now()}`,
        user: {
          userId: user.userId,
          fullName: user.fullName,
          email: user.email,
          roles: user.roles,
          warehouseIds: user.warehouseIds,
        },
      },
      headers: {},
    };
  });

  registerMockRoute("POST", "/auth/refresh", async () => {
    return {
      status: 200,
      data: {
        accessToken: `mock-access-refreshed-${Date.now()}`,
        refreshToken: `mock-refresh-refreshed-${Date.now()}`,
      },
      headers: {},
    };
  });

  registerMockRoute("POST", "/auth/logout", async () => {
    return { status: 200, data: { message: "Logged out" }, headers: {} };
  });
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

/** Parse an axios request body (string JSON or already-parsed object). */
function parseJsonBody(data: unknown): Record<string, unknown> {
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

/* Narrowing helpers for literal union types (mock bodies are `unknown`). */

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text ? text : undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readProductType(value: unknown): ProductType {
  return value === "Customizable" ? "Customizable" : "Standard";
}

function readUom(value: unknown): Uom {
  return isUom(value) ? value : "pcs";
}

function readTaxClass(value: unknown): Product["taxClass"] {
  return value === "reduced" || value === "exempt" ? value : "standard";
}

function readProductAttributes(value: unknown): ProductAttribute[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isProductAttribute);
}

function readPrintAreas(value: unknown, productId: string): PrintArea[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const printAreas = value.filter(isPrintAreaInput).map((area) => ({
    printAreaId: area.printAreaId,
    productId,
    name: area.name,
    position: area.position,
    widthMm: area.widthMm,
    heightMm: area.heightMm,
    minDpi: area.minDpi,
    bleedMm: area.bleedMm,
    safeMarginMm: area.safeMarginMm,
    allowedTechniques: area.allowedTechniques,
  }));
  return printAreas.length ? printAreas : undefined;
}

function isProductAttribute(value: unknown): value is ProductAttribute {
  if (!isRecord(value)) return false;
  return (
    typeof value.attributeId === "string" &&
    isBilingualLabel(value.name) &&
    Array.isArray(value.values) &&
    value.values.every((item) => typeof item === "string")
  );
}

function isPrintAreaInput(value: unknown): value is PrintArea {
  if (!isRecord(value)) return false;
  return (
    typeof value.printAreaId === "string" &&
    isBilingualLabel(value.name) &&
    isPrintAreaPosition(value.position) &&
    typeof value.widthMm === "number" &&
    typeof value.heightMm === "number" &&
    typeof value.minDpi === "number" &&
    typeof value.bleedMm === "number" &&
    typeof value.safeMarginMm === "number" &&
    Array.isArray(value.allowedTechniques) &&
    value.allowedTechniques.every(isPrintTechnique)
  );
}

function isBilingualLabel(value: unknown): value is ProductAttribute["name"] {
  return (
    isRecord(value) &&
    typeof value.vi === "string" &&
    value.vi.trim().length > 0 &&
    typeof value.en === "string" &&
    value.en.trim().length > 0
  );
}

function isPrintAreaPosition(value: unknown): value is PrintArea["position"] {
  return (
    value === "front" ||
    value === "back" ||
    value === "left-sleeve" ||
    value === "right-sleeve" ||
    value === "full"
  );
}

function isPrintTechnique(value: unknown): value is PrintTechnique {
  return (
    value === "DTG" ||
    value === "DTF" ||
    value === "Screen" ||
    value === "Embroidery" ||
    value === "Sublimation"
  );
}

function isUom(value: unknown): value is Uom {
  return (
    value === "pcs" ||
    value === "box" ||
    value === "kg" ||
    value === "m" ||
    value === "ream" ||
    value === "set"
  );
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

/* ======================================================================
 * Module 02 — Purchase Orders: mock mirrors BE PurchaseOrderController
 *
 * Wire shape = BE `PurchaseOrderResponse` / `POLineResponse` (UUID ids, SCREAMING_SNAKE
 * status, `totalAmount`, `openQuantity`), errors = BE `ApiResponse` failure envelope
 * `{success:false, errorCode, message, fieldErrors:[{field,message}]}`. Because the mock
 * speaks exactly the BE contract, `features/purchase-order/api.ts` has ONE code path and
 * never needs to know whether it talks to the mock or the real backend.
 * ====================================================================*/

/** BE `PurchaseOrderStatus.java` — 7 states. */
const BE_PO_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "CLOSED",
  "CLOSED_SHORT",
  "CANCELLED",
] as const;
type BePoStatus = (typeof BE_PO_STATUSES)[number];

/**
 * Seed `mock-data.ts` still uses the docs-02 Title Case vocabulary (10-state machine) and
 * cannot be edited (protected file). This is the ONLY place that vocabulary is translated —
 * nothing outside the mock ever sees Title Case.
 *
 * BE narrows the machine (javadoc `PurchaseOrderStatus`, SCRUM-113/116):
 * - `Pending Approval` → `DRAFT`: BE merged submit+approve into `approve()`, so an order
 *   waiting for approval is a DRAFT that has not been approved yet (NOT `APPROVED`).
 * - `Confirmed` → `SENT`: no separate "supplier acknowledged" step.
 * - `Received` → `CLOSED`: reaching zero open quantity closes the PO directly.
 */
const LEGACY_PO_STATUS: Record<PoStatus, BePoStatus> = {
  Draft: "DRAFT",
  "Pending Approval": "DRAFT",
  Approved: "APPROVED",
  Confirmed: "SENT",
  "Partially Received": "PARTIALLY_RECEIVED",
  Received: "CLOSED",
  Closed: "CLOSED",
  Cancelled: "CANCELLED",
};

/** BE `PurchaseOrderStatus#canTransitionTo` — single-edge transitions (receive is separate). */
const BE_PO_TRANSITIONS: Record<BePoStatus, readonly BePoStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["CANCELLED"],
  PARTIALLY_RECEIVED: ["CLOSED_SHORT"],
  CLOSED: [],
  CLOSED_SHORT: [],
  CANCELLED: [],
};

/** BE `ProcurementServiceImpl.SORT` whitelist. */
const PO_SORT_WHITELIST = ["poNumber", "expectedAt", "createdAt", "lastModifiedAt", "status"];
/** BE `Pages.MAX_PAGE_SIZE` / `Pages.DEFAULT_PAGE_SIZE`. */
const BE_MAX_PAGE_SIZE = 200;
const BE_DEFAULT_PAGE_SIZE = 20;
/** BE `common.domain.Sku` — code is trimmed, upper-cased, then must match this. */
const BE_SKU_PATTERN = /^[A-Z0-9-]{3,64}$/;
/** BE `ErrorCode.VALIDATION_FAILED` generic message (IllegalArgumentException handler). */
const BE_GENERIC_VALIDATION_MESSAGE = "Invalid request data";

interface MockBePoLine {
  lineId: string;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  openQuantity: number;
  unitPrice: number;
}

interface MockBePo {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  status: BePoStatus;
  currency: string;
  totalAmount: number;
  expectedAt: string | null;
  lines: MockBePoLine[];
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  possibleDuplicate: boolean;
  cancellationReason: string | null;
  closeShortReason: string | null;
}

interface MockFieldError {
  field: string;
  message: string;
}

const MOCK_PO_ACTOR = "mock-user";

let poStore: Map<string, MockBePo> | null = null;
const poNumberSequence = new Map<string, number>();

async function getPoStore(): Promise<Map<string, MockBePo>> {
  if (!poStore) {
    const { purchaseOrders } = await import("@/lib/mock-data");
    poStore = new Map(purchaseOrders.map((po) => [po.poId, seedToBePo(po)]));
  }
  return poStore;
}

function seedToBePo(po: PurchaseOrder): MockBePo {
  const lines: MockBePoLine[] = po.lines.map((l) => ({
    lineId: l.lineId,
    sku: l.skuId,
    description: null,
    quantityOrdered: l.orderedQty,
    quantityReceived: l.receivedQty,
    openQuantity: Math.max(0, l.orderedQty - l.receivedQty),
    unitPrice: l.unitPrice,
  }));
  const status = LEGACY_PO_STATUS[po.status];
  // Seed only has a calendar date; midnight VN time keeps the same date in Asia/Ho_Chi_Minh.
  const createdAt = `${po.orderDate}T00:00:00+07:00`;
  return {
    purchaseOrderId: po.poId,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    status,
    currency: po.currency,
    totalAmount: sumLines(lines),
    expectedAt: po.expectedDate || null,
    lines,
    createdAt,
    createdBy: po.createdBy,
    lastModifiedAt: createdAt,
    lastModifiedBy: po.createdBy,
    possibleDuplicate: false,
    cancellationReason: status === "CANCELLED" ? (po.rejectionReason ?? null) : null,
    closeShortReason: null,
  };
}

/** BE `PurchaseOrder#totalAmount` — Σ quantityOrdered × unitPrice (no tax/discount). */
function sumLines(lines: readonly MockBePoLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitPrice, 0);
}

function beOk(data: unknown, status = 200) {
  return { status, data, headers: {} };
}

function beError(
  status: number,
  errorCode: string,
  message: string,
  fieldErrors?: MockFieldError[],
) {
  return {
    status,
    data: { success: false, errorCode, message, fieldErrors: fieldErrors ?? [] },
    headers: {},
  };
}

function bePage<T>(all: readonly T[], page: number, size: number) {
  const totalElements = all.length;
  const totalPages = Math.ceil(totalElements / size);
  return {
    items: all.slice(page * size, page * size + size),
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

/** axios keeps query params in `config.params` (not in `config.url`) until its real adapter runs. */
function readParams(config: AxiosRequestConfig): Record<string, unknown> {
  const params: unknown = config.params;
  return isRecord(params) ? params : {};
}

function readInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : fallback;
}

function readRouteId(config: AxiosRequestConfig): string {
  const params: unknown = (config as Record<string, unknown>)._mockParams;
  return isRecord(params) ? readString(params.id) : "";
}

function isBePoStatus(value: string): value is BePoStatus {
  return (BE_PO_STATUSES as readonly string[]).includes(value);
}

function toArray(value: unknown): unknown[] {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** BE `SortWhitelist#parse` — "prop,dir;prop2,dir2". Returns null for a non-whitelisted prop. */
function parseSort(raw: string): { prop: keyof MockBePo; desc: boolean }[] | null {
  const clauses = raw
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);
  const out: { prop: keyof MockBePo; desc: boolean }[] = [];
  for (const clause of clauses) {
    const [prop = "", dir = ""] = clause.split(",").map((s) => s.trim());
    if (!PO_SORT_WHITELIST.includes(prop)) return null;
    out.push({ prop: prop as keyof MockBePo, desc: dir.toLowerCase() === "desc" });
  }
  return out.length ? out : [{ prop: "lastModifiedAt", desc: true }];
}

function comparePo(a: MockBePo, b: MockBePo, order: { prop: keyof MockBePo; desc: boolean }[]) {
  for (const { prop, desc } of order) {
    const cmp = String(a[prop] ?? "").localeCompare(String(b[prop] ?? ""));
    if (cmp !== 0) return desc ? -cmp : cmp;
  }
  return 0;
}

function nextPoNumber(): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = (poNumberSequence.get(ymd) ?? 0) + 1;
  poNumberSequence.set(ymd, seq);
  return `PO-${ymd}-${String(seq).padStart(6, "0")}`;
}

function touch(po: MockBePo, patch: Partial<MockBePo>): MockBePo {
  return {
    ...po,
    ...patch,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: MOCK_PO_ACTOR,
  };
}

function registerPurchaseOrderMockRoutes(): void {
  // GET /purchase-orders — BE: page (0-based), size, supplierId, status (repeatable), sort.
  // BE has no free-text `q` — the mock ignores it too so both behave the same.
  registerMockRoute("GET", "/purchase-orders", async (config) => {
    const store = await getPoStore();
    const p = readParams(config);
    const page = readInt(p.page, 0);
    const size = readInt(p.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "VALIDATION_FAILED", `Page size must not exceed ${BE_MAX_PAGE_SIZE}`);
    }
    const statuses = toArray(p.status).map(String);
    // BE: PurchaseOrderStatus::valueOf → IllegalArgumentException → generic 400.
    if (statuses.some((s) => !isBePoStatus(s))) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE);
    }
    const order = parseSort(readString(p.sort));
    if (!order) {
      return beError(
        400,
        "UNSUPPORTED_PARAMETER",
        `Cannot sort by '${readString(p.sort)}'. Allowed: ${PO_SORT_WHITELIST.join(", ")}`,
      );
    }
    const supplierId = readString(p.supplierId);
    const rows = [...store.values()]
      .filter((po) => !supplierId || po.supplierId === supplierId)
      .filter((po) => statuses.length === 0 || statuses.includes(po.status))
      .sort((a, b) => comparePo(a, b, order))
      // BE: `lines` is empty on a list row (PurchaseOrderSearchRepository).
      .map((po) => ({ ...po, lines: [] }));
    return beOk(bePage(rows, page, size));
  });

  // GET /purchase-orders/:id
  registerMockRoute("GET", "/purchase-orders/:id", async (config) => {
    const id = readRouteId(config);
    const po = (await getPoStore()).get(id);
    if (!po) {
      return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order with id ${id}`);
    }
    return beOk(po);
  });

  // GET /purchase-orders/reports/status-dashboard — BE returns every status, even empty ones.
  registerMockRoute("GET", "/purchase-orders/reports/status-dashboard", async () => {
    const all = [...(await getPoStore()).values()];
    return beOk(
      BE_PO_STATUSES.map((status) => ({
        status,
        count: all.filter((po) => po.status === status).length,
      })),
    );
  });

  // GET /purchase-orders/reports/supplier-spend — Σ totalAmount excluding DRAFT + CANCELLED.
  registerMockRoute("GET", "/purchase-orders/reports/supplier-spend", async (config) => {
    const { suppliers } = await import("@/lib/mock-data");
    const p = readParams(config);
    const page = readInt(p.page, 0);
    const size = readInt(p.size, BE_DEFAULT_PAGE_SIZE);
    const supplierIdFilter = readString(p.supplierId);
    const from = readString(p.expectedAtFrom);
    const to = readString(p.expectedAtTo);
    const bySupplier = new Map<string, { totalSpend: number; count: number }>();
    for (const po of (await getPoStore()).values()) {
      if (po.status === "DRAFT" || po.status === "CANCELLED") continue;
      if (supplierIdFilter && po.supplierId !== supplierIdFilter) continue;
      if (from && (po.expectedAt ?? "") < from) continue;
      if (to && (po.expectedAt ?? "") > to) continue;
      const cur = bySupplier.get(po.supplierId) ?? { totalSpend: 0, count: 0 };
      bySupplier.set(po.supplierId, {
        totalSpend: cur.totalSpend + po.totalAmount,
        count: cur.count + 1,
      });
    }
    const supById = new Map(suppliers.map((s) => [s.supplierId, s] as const));
    const rows = [...bySupplier.entries()]
      .map(([supplierId, agg]) => ({
        supplierId,
        supplierCode: supplierId,
        supplierName: supById.get(supplierId)?.name ?? supplierId,
        totalSpend: agg.totalSpend,
        purchaseOrderCount: agg.count,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
    return beOk(bePage(rows, page, size));
  });

  // POST /purchase-orders — BE CreatePurchaseOrderRequest + ProcurementServiceImpl.create.
  registerMockRoute("POST", "/purchase-orders", async (config) => {
    const { suppliers } = await import("@/lib/mock-data");
    const body = parseJsonBody(config.data);
    const supplierId = readString(body.supplierId);
    const currency = readString(body.currency);
    const expectedAt = readString(body.expectedAt) || null;
    const rawLines = Array.isArray(body.lines) ? body.lines : [];

    const fieldErrors: MockFieldError[] = [];
    if (!supplierId) fieldErrors.push({ field: "supplierId", message: "supplierId is required" });
    if (!/^[A-Z]{3}$/.test(currency)) {
      fieldErrors.push({ field: "currency", message: "currency must be a 3-letter ISO code" });
    }
    if (rawLines.length === 0) {
      fieldErrors.push({ field: "lines", message: "at least one line is required" });
    }
    const lines: MockBePoLine[] = rawLines.map((raw: unknown, idx) => {
      const r = isRecord(raw) ? raw : {};
      const sku = readString(r.sku).toUpperCase();
      const qty = r.quantityOrdered;
      const price = r.unitPrice;
      if (!BE_SKU_PATTERN.test(sku)) {
        fieldErrors.push({ field: `lines[${idx}].sku`, message: "sku is required" });
      }
      if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) {
        fieldErrors.push({
          field: `lines[${idx}].quantityOrdered`,
          message: "quantityOrdered must be positive",
        });
      }
      if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
        fieldErrors.push({
          field: `lines[${idx}].unitPrice`,
          message: "unitPrice must not be negative",
        });
      }
      const quantityOrdered = typeof qty === "number" ? qty : 0;
      return {
        lineId: crypto.randomUUID(),
        sku,
        description: readString(r.description) || null,
        quantityOrdered,
        quantityReceived: 0,
        openQuantity: quantityOrdered,
        unitPrice: typeof price === "number" ? price : 0,
      };
    });
    if (fieldErrors.length > 0) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, fieldErrors);
    }
    const supplier = suppliers.find((s) => s.supplierId === supplierId);
    if (!supplier) {
      return beError(404, "SUPPLIER_NOT_FOUND", `No supplier with id ${supplierId}`);
    }
    if (!supplier.active) {
      return beError(409, "SUPPLIER_INACTIVE", `Supplier ${supplierId} is INACTIVE`);
    }

    const store = await getPoStore();
    // BR-PO-003 (BE isPossibleDuplicate): another non-terminal PO, same supplier + expectedAt,
    // at least one overlapping SKU → warning flag, not a rejection.
    const skuSet = new Set(lines.map((l) => l.sku));
    const possibleDuplicate =
      expectedAt !== null &&
      [...store.values()].some(
        (po) =>
          po.supplierId === supplierId &&
          po.expectedAt === expectedAt &&
          po.status !== "CANCELLED" &&
          po.status !== "CLOSED" &&
          po.status !== "CLOSED_SHORT" &&
          po.lines.some((l) => skuSet.has(l.sku)),
      );
    const now = new Date().toISOString();
    const po: MockBePo = {
      purchaseOrderId: crypto.randomUUID(),
      poNumber: nextPoNumber(),
      supplierId,
      status: "DRAFT",
      currency,
      totalAmount: sumLines(lines),
      expectedAt,
      lines,
      createdAt: now,
      createdBy: MOCK_PO_ACTOR,
      lastModifiedAt: now,
      lastModifiedBy: MOCK_PO_ACTOR,
      possibleDuplicate: false,
      cancellationReason: null,
      closeShortReason: null,
    };
    store.set(po.purchaseOrderId, po);
    return beOk({ ...po, possibleDuplicate }, 201);
  });

  // Single-edge transitions — one endpoint per action (BE splits them for permission).
  const transition =
    (target: BePoStatus, reasonField?: "cancellationReason" | "closeShortReason") =>
    async (config: AxiosRequestConfig) => {
      const id = readRouteId(config);
      const store = await getPoStore();
      const po = store.get(id);
      if (!po) return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order with id ${id}`);
      const reason = readString(parseJsonBody(config.data).reason);
      if (reasonField && !reason) {
        return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, [
          { field: "reason", message: "reason is required" },
        ]);
      }
      if (!BE_PO_TRANSITIONS[po.status].includes(target)) {
        return beError(
          409,
          "INVALID_PURCHASE_ORDER_TRANSITION",
          `Purchase order ${id} cannot move from ${po.status} to ${target}`,
        );
      }
      const patch: Partial<MockBePo> = { status: target };
      if (reasonField) patch[reasonField] = reason;
      const updated = touch(po, patch);
      store.set(id, updated);
      return beOk(updated);
    };

  registerMockRoute("POST", "/purchase-orders/:id/approval", transition("APPROVED"));
  registerMockRoute("POST", "/purchase-orders/:id/sending", transition("SENT"));
  registerMockRoute(
    "POST",
    "/purchase-orders/:id/cancellation",
    transition("CANCELLED", "cancellationReason"),
  );
  registerMockRoute(
    "POST",
    "/purchase-orders/:id/closure-short",
    transition("CLOSED_SHORT", "closeShortReason"),
  );

  // POST /purchase-orders/:id/receipts — BE PurchaseOrder#receiveGoods + PoLine#receive.
  registerMockRoute("POST", "/purchase-orders/:id/receipts", async (config) => {
    const id = readRouteId(config);
    const store = await getPoStore();
    const po = store.get(id);
    if (!po) return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order with id ${id}`);
    const body = parseJsonBody(config.data);
    const requested = Array.isArray(body.lines) ? body.lines : [];
    if (requested.length === 0) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, [
        { field: "lines", message: "at least one line is required" },
      ]);
    }
    if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
      return beError(
        409,
        "INVALID_PURCHASE_ORDER_TRANSITION",
        `cannot receive goods while ${po.status} (must be SENT or PARTIALLY_RECEIVED)`,
      );
    }
    const received = new Map<string, number>();
    for (const raw of requested) {
      const r = isRecord(raw) ? raw : {};
      const lineId = readString(r.lineId);
      const qty = r.quantity;
      const line = po.lines.find((l) => l.lineId === lineId);
      // BE: unknown line / qty ≤ 0 / qty > openQuantity are IllegalArgumentException →
      // generic 400 without fieldErrors — the FE dialog must validate before sending.
      if (!line || typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) {
        return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE);
      }
      if (qty > line.openQuantity) {
        return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE);
      }
      received.set(lineId, qty);
    }
    const lines = po.lines.map((l) => {
      const qty = received.get(l.lineId) ?? 0;
      return {
        ...l,
        quantityReceived: l.quantityReceived + qty,
        openQuantity: l.openQuantity - qty,
      };
    });
    const status: BePoStatus = lines.every((l) => l.openQuantity === 0)
      ? "CLOSED"
      : "PARTIALLY_RECEIVED";
    const updated = touch(po, { lines, status });
    store.set(id, updated);
    return beOk(updated);
  });
}
