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
  PurchaseOrder,
  Supplier,
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

const OPEN_PO_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Confirmed",
  "Partially Received",
  "Received",
] as const;

function toSupplierDto(s: Supplier, purchaseOrders?: PurchaseOrder[]) {
  const openPoCount = purchaseOrders
    ? purchaseOrders.filter(
        (po) =>
          po.supplierId === s.supplierId &&
          OPEN_PO_STATUSES.includes(po.status as (typeof OPEN_PO_STATUSES)[number]),
      ).length
    : 0;
  return {
    supplierId: s.supplierId,
    name: s.name,
    taxCode: s.taxCode,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    paymentTerms: s.paymentTerms,
    currency: s.currency,
    leadTimeDays: s.leadTimeDays,
    rating: s.rating,
    status: (s.active ? "Active" : "Inactive") as "Active" | "Inactive",
    openPoCount,
  };
}

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
    const { suppliers, purchaseOrders } = await import("@/lib/mock-data");
    const params = new URLSearchParams(config.url?.split("?")[1] ?? "");
    const page = Number(params.get("page")) || 1;
    const pageSize = Number(params.get("pageSize")) || 15;
    const q = params.get("q")?.toLowerCase();
    const status = params.getAll("status");

    let filtered = [...suppliers];
    if (q)
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.supplierId.toLowerCase().includes(q) ||
          s.taxCode.toLowerCase().includes(q) ||
          s.contactEmail.toLowerCase().includes(q),
      );
    if (status.length)
      filtered = filtered.filter((s) => status.includes(s.active ? "Active" : "Inactive"));

    const dtoList = filtered.map((s) => toSupplierDto(s, purchaseOrders));
    return { status: 200, data: paginate(dtoList, page, pageSize), headers: {} };
  });

  // GET /suppliers/:id
  registerMockRoute("GET", "/suppliers/:id", async (config) => {
    const { suppliers, purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const supplier = suppliers.find((s) => s.supplierId === id);
    if (!supplier) return { status: 404, data: { message: "Supplier not found" }, headers: {} };
    return { status: 200, data: toSupplierDto(supplier, purchaseOrders), headers: {} };
  });

  // POST /suppliers — create; duplicate taxCode → inline field error
  registerMockRoute("POST", "/suppliers", async (config) => {
    const { suppliers, purchaseOrders } = await import("@/lib/mock-data");
    const body = JSON.parse(config.data ?? "{}");
    const taxCode = String(body.taxCode ?? "").trim();

    if (suppliers.some((s) => s.taxCode.trim() === taxCode)) {
      return {
        status: 409,
        data: {
          code: "SUPPLIER_CODE_ALREADY_EXISTS",
          message: "Mã số thuế đã tồn tại trong hệ thống",
          fieldErrors: { taxCode: "Mã số thuế đã tồn tại — không thể lưu trùng." },
        },
        headers: {},
      };
    }

    const nextId = `SUP-${String(suppliers.length + 1).padStart(3, "0")}`;
    const created = {
      supplierId: nextId,
      name: String(body.name ?? ""),
      taxCode,
      contactName: String(body.contactName ?? ""),
      contactEmail: String(body.contactEmail ?? ""),
      contactPhone: String(body.contactPhone ?? ""),
      address: body.address ?? {},
      paymentTerms: String(body.paymentTerms ?? "Net 30"),
      currency: body.currency ?? "VND",
      leadTimeDays: Number(body.leadTimeDays ?? 14),
      rating: 3.5,
      active: true,
    };
    suppliers.push(created);
    return { status: 201, data: toSupplierDto(created, purchaseOrders), headers: {} };
  });

  // PUT /suppliers/:id — edit; duplicate taxCode on another supplier → inline error
  registerMockRoute("PUT", "/suppliers/:id", async (config) => {
    const { suppliers, purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = JSON.parse(config.data ?? "{}");
    const idx = suppliers.findIndex((s) => s.supplierId === id);
    if (idx === -1) return { status: 404, data: { message: "Supplier not found" }, headers: {} };

    const taxCode = String(body.taxCode ?? "").trim();
    const dup = suppliers.find((s) => s.supplierId !== id && s.taxCode.trim() === taxCode);
    if (dup) {
      return {
        status: 409,
        data: {
          code: "SUPPLIER_CODE_ALREADY_EXISTS",
          message: "Mã số thuế đã thuộc nhà cung cấp khác",
          fieldErrors: { taxCode: "Mã số thuế đã thuộc nhà cung cấp khác." },
        },
        headers: {},
      };
    }

    suppliers[idx] = { ...suppliers[idx]!, ...body };
    return { status: 200, data: toSupplierDto(suppliers[idx]!, purchaseOrders), headers: {} };
  });

  // PATCH /suppliers/:id/status — block deactivating a supplier with open PO
  registerMockRoute("PATCH", "/suppliers/:id/status", async (config) => {
    const { suppliers, purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = JSON.parse(config.data ?? "{}");
    const idx = suppliers.findIndex((s) => s.supplierId === id);
    if (idx === -1) return { status: 404, data: { message: "Supplier not found" }, headers: {} };

    const target = body.status;
    const OPEN_PO_STATUSES = [
      "Draft",
      "Pending Approval",
      "Approved",
      "Confirmed",
      "Partially Received",
      "Received",
    ];
    const openPos = purchaseOrders.filter(
      (po) => po.supplierId === id && OPEN_PO_STATUSES.includes(po.status),
    );

    if (target === "Inactive" && openPos.length > 0) {
      // SCRUM-118: BE chọn chặn (block) thay vì cảnh báo.
      return {
        status: 409,
        data: {
          code: "SUPPLIER_HAS_OPEN_PO",
          message: `Nhà cung cấp còn ${openPos.length} đơn đặt hàng chưa đóng — không thể vô hiệu hoá.`,
        },
        headers: {},
      };
    }

    suppliers[idx] = { ...suppliers[idx]!, active: target === "Active" };
    return { status: 200, data: toSupplierDto(suppliers[idx]!, purchaseOrders), headers: {} };
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
