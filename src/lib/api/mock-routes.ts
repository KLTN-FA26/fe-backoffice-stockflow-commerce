/**
 * Mock routes — register all mock API handlers.
 *
 * Each handler reads from mock-data.ts and returns paginated/filtered results.
 * Called once by activateMockAdapter() → registerAllMockRoutes().
 *
 * **Only this file + mock-adapter.ts may import mock-data.ts.**
 */

import { registerMockRoute, paginate } from "./mock-adapter";

import type {
  PrintArea,
  PrintTechnique,
  Product,
  ProductAttribute,
  ProductType,
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
  customizable?: unknown;
  weightKg?: unknown;
  lengthCm?: unknown;
  widthCm?: unknown;
  heightCm?: unknown;
  reason?: unknown;
}

type MockProduct = Product & {
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

const createdProducts: MockProduct[] = [];
const productOverrides = new Map<string, MockProduct>();
const MOCK_SUBMITTER_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_APPROVER_ID = "22222222-2222-4222-8222-222222222222";

export function registerAllMockRoutes(): void {
  /* ====================================================================
   * Module 01 — Products / SKUs / Categories / Suppliers
   * ==================================================================*/

  // GET /products
  registerMockRoute("GET", "/v1/products", async (config) => {
    const { products } = await import("@/lib/mock-data");
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

    let filtered = [...products, ...createdProducts].map(
      (product) => productOverrides.get(product.productId) ?? product,
    );
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
  registerMockRoute("GET", "/v1/products/:id", async (config) => {
    const { products } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const product =
      productOverrides.get(id) ?? [...products, ...createdProducts].find((p) => p.productId === id);
    if (!product) return { status: 404, data: { message: "Product not found" }, headers: {} };
    return { status: 200, data: product, headers: {} };
  });

  // POST /products
  registerMockRoute("POST", "/v1/products", async (config) => {
    const { categories, products } = await import("@/lib/mock-data");
    const body = parseCreateProductBody(config.data);
    const productId = readString(body.code) || readString(body.productId);
    const fieldErrors: Record<string, string> = {};

    if (!productId) fieldErrors.productId = "Nhập mã sản phẩm";
    if (!readString(body.name)) fieldErrors.name = "Nhập tên sản phẩm";
    if (!readString(body.brand)) fieldErrors.brand = "Nhập thương hiệu";
    if (!readString(body.categoryId)) fieldErrors.categoryId = "Chọn danh mục";
    if (Object.keys(fieldErrors).length > 0) {
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

    const duplicated = [...products, ...createdProducts].some(
      (product) => product.productId === productId,
    );
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
    const categoryExists = categories.some((category) => category.categoryId === categoryId);
    if (!categoryExists) {
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
      type: body.customizable === true ? "Customizable" : readProductType(body.type),
      categoryId,
      status: "Draft",
      description: readString(body.description),
      descriptionEn: readString(body.descriptionEn),
      images: readStringArray(body.images),
      model3dUrl: readOptionalString(body.model3dUrl),
      basePrice: readNumber(body.basePrice),
      attributes: readProductAttributes(body.attributes),
      printAreas: readPrintAreas(body.printAreas, productId),
      taxClass: readTaxClass(
        typeof body.taxClass === "string" ? body.taxClass.toLowerCase() : body.taxClass,
      ),
      uom: readUom(body.uom),
      brand: readString(body.brand),
      createdAt: now,
      createdBy: "Mock API",
      weightKg: readNullableNumber(body.weightKg),
      lengthCm: readNullableNumber(body.lengthCm),
      widthCm: readNullableNumber(body.widthCm),
      heightCm: readNullableNumber(body.heightCm),
    };

    createdProducts.push(product);
    return { status: 201, data: product, headers: {} };
  });

  registerMockRoute("PUT", "/v1/products/:id", async (config) => {
    const { products } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const current =
      productOverrides.get(id) ?? [...products, ...createdProducts].find((p) => p.productId === id);
    if (!current)
      return {
        status: 404,
        data: { errorCode: "PRODUCT_NOT_FOUND", message: "Product not found" },
        headers: {},
      };
    const body = parseCreateProductBody(config.data);
    const updated: MockProduct = {
      ...current,
      name: readString(body.name),
      nameEn: readString(body.nameEn),
      categoryId: readString(body.categoryId),
      description: readString(body.description),
      descriptionEn: readString(body.descriptionEn),
      brand: readString(body.brand),
      images: readStringArray(body.images),
      type: body.customizable === true ? "Customizable" : "Standard",
      taxClass: readTaxClass(
        typeof body.taxClass === "string" ? body.taxClass.toLowerCase() : body.taxClass,
      ),
      weightKg: readNullableNumber(body.weightKg),
      lengthCm: readNullableNumber(body.lengthCm),
      widthCm: readNullableNumber(body.widthCm),
      heightCm: readNullableNumber(body.heightCm),
    };
    productOverrides.set(id, updated);
    return { status: 200, data: updated, headers: {} };
  });

  registerProductTransitionRoutes();

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

  // GET /purchase-orders
  registerMockRoute("GET", "/purchase-orders", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const q = params.get("q")?.toLowerCase();
    const status = params.getAll("status");

    let filtered = [...purchaseOrders];
    if (q)
      filtered = filtered.filter(
        (po) => po.poNumber.toLowerCase().includes(q) || po.poId.toLowerCase().includes(q),
      );
    if (status.length) filtered = filtered.filter((po) => status.includes(po.status));

    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /purchase-orders/:id
  registerMockRoute("GET", "/purchase-orders/:id", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const po = purchaseOrders.find((p) => p.poId === id || p.poNumber === id);
    if (!po) return { status: 404, data: { message: "PO not found" }, headers: {} };
    return { status: 200, data: po, headers: {} };
  });

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

function registerProductTransitionRoutes(): void {
  registerProductTransition("submission", ["Draft"], "Pending Approval", (product) => ({
    ...product,
    submittedBy: MOCK_SUBMITTER_ID,
    submittedAt: new Date().toISOString(),
  }));
  registerProductTransition("approval", ["Pending Approval"], "Approved", (product) => ({
    ...product,
    approvedBy: MOCK_APPROVER_ID,
    approvedAt: new Date().toISOString(),
  }));
  registerProductTransition("discontinuation", ["Approved", "Published"], "Discontinued");
  registerProductTransition("unpublication", ["Published"], "Approved", undefined, true);
  registerProductTransition("publication", ["Approved"], "Published", undefined, true);

  registerMockRoute("POST", "/v1/products/:id/rejection", async (config) => {
    const body = parseCreateProductBody(config.data);
    if (!readString(body.reason)) {
      return mockValidationError("reason", "Lý do từ chối là bắt buộc.");
    }
    return transitionMockProduct(config, ["Pending Approval"], "Draft", (product) => ({
      ...product,
      submittedBy: undefined,
      submittedAt: undefined,
    }));
  });
}

function registerProductTransition(
  suffix: string,
  fromStatuses: Product["status"][],
  targetStatus: Product["status"],
  enrich?: (product: MockProduct) => MockProduct,
  voidResponse = false,
): void {
  registerMockRoute("POST", `/v1/products/:id/${suffix}`, (config) =>
    transitionMockProduct(config, fromStatuses, targetStatus, enrich, voidResponse),
  );
}

async function transitionMockProduct(
  config: import("axios").AxiosRequestConfig,
  fromStatuses: Product["status"][],
  targetStatus: Product["status"],
  enrich?: (product: MockProduct) => MockProduct,
  voidResponse = false,
) {
  const { products } = await import("@/lib/mock-data");
  const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  const current =
    productOverrides.get(id) ??
    [...products, ...createdProducts].find((item) => item.productId === id);
  if (!current) {
    return {
      status: 404,
      data: { errorCode: "PRODUCT_NOT_FOUND", message: "Product not found" },
      headers: {},
    };
  }
  if (!fromStatuses.includes(current.status)) {
    return {
      status: 409,
      data: {
        errorCode: "INVALID_PRODUCT_STATUS_TRANSITION",
        message: "This product cannot move to that status right now",
      },
      headers: {},
    };
  }
  const transitioned = enrich?.({ ...current, status: targetStatus }) ?? {
    ...current,
    status: targetStatus,
  };
  productOverrides.set(id, transitioned);
  return { status: 200, data: voidResponse ? null : transitioned, headers: {} };
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

function readOptionalString(value: unknown): string | undefined {
  const text = readString(value);
  return text ? text : undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    case "DISCONTINUED":
      return "Discontinued";
    default:
      return null;
  }
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
