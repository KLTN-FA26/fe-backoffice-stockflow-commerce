/**
 * Mock routes — register all mock API handlers.
 *
 * Each handler reads from mock-data.ts and returns paginated/filtered results.
 * Called once by activateMockAdapter() → registerAllMockRoutes().
 *
 * **Only this file + mock-adapter.ts may import mock-data.ts.**
 */

import { registerMockRoute, paginate } from "./mock-adapter";

import { PO_STATUSES, SUPPLIER_STATUS } from "@/constants/statuses";

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
const createdSuppliers: Supplier[] = [];

function parseJsonBody(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    try {
      const v: unknown = JSON.parse(data);
      return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function allSuppliersView(suppliers: Supplier[]): Supplier[] {
  return [...suppliers, ...createdSuppliers];
}

function findSupplierIndex(
  suppliers: Supplier[],
  created: Supplier[],
  id: string,
): { idx: number; isCreated: boolean } {
  const idx = suppliers.findIndex((s) => s.supplierId === id);
  if (idx !== -1) return { idx, isCreated: false };
  return { idx: created.findIndex((s) => s.supplierId === id), isCreated: true };
}

function isDuplicateCode(suppliers: Supplier[], id: string | null, code: string): boolean {
  if (!code) return false;
  return suppliers.some((s) => s.supplierId !== id && (s.supplierId ?? "").trim() === code);
}

function isDuplicateTaxCode(suppliers: Supplier[], id: string | null, taxCode: string): boolean {
  if (!taxCode) return false;
  return suppliers.some((s) => s.supplierId !== id && s.taxCode.trim() === taxCode);
}

// Mở = mọi PO chưa Closed/Cancelled — suy từ PO_STATUSES để không lệch enum BE (SCRUM-118)
const OPEN_PO_STATUSES: readonly string[] = PO_STATUSES.filter(
  (s) => s !== "Closed" && s !== "Cancelled",
);

function toSupplierDto(s: Supplier, purchaseOrders?: PurchaseOrder[]) {
  const openPoCount = purchaseOrders
    ? purchaseOrders.filter(
        (po) =>
          po.supplierId === s.supplierId &&
          (OPEN_PO_STATUSES as readonly string[]).includes(po.status),
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
    status: (s.active ? SUPPLIER_STATUS.ACTIVE : SUPPLIER_STATUS.INACTIVE) as "Active" | "Inactive",
    openPoCount,
  };
}

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
    const { suppliers: seedSuppliers, purchaseOrders } = await import("@/lib/mock-data");
    const suppliers = allSuppliersView(seedSuppliers);
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
      filtered = filtered.filter((s) =>
        status.includes(s.active ? SUPPLIER_STATUS.ACTIVE : SUPPLIER_STATUS.INACTIVE),
      );

    const dtoList = filtered.map((s) => toSupplierDto(s, purchaseOrders));
    return { status: 200, data: paginate(dtoList, page, pageSize), headers: {} };
  });

  // GET /suppliers/:id
  registerMockRoute("GET", "/suppliers/:id", async (config) => {
    const { suppliers: seedSuppliers, purchaseOrders } = await import("@/lib/mock-data");
    const suppliers = allSuppliersView(seedSuppliers);
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const supplier = suppliers.find((s) => s.supplierId === id);
    if (!supplier) return { status: 404, data: { message: "Supplier not found" }, headers: {} };
    return { status: 200, data: toSupplierDto(supplier, purchaseOrders), headers: {} };
  });

  // POST /suppliers — create; duplicate taxCode/code → inline field error
  registerMockRoute("POST", "/suppliers", async (config) => {
    const { suppliers: seedSuppliers, purchaseOrders } = await import("@/lib/mock-data");
    const suppliers = allSuppliersView(seedSuppliers);
    const body = parseJsonBody(config.data);
    const taxCode = String(body.taxCode ?? "").trim();
    const inputCode = String(body.code ?? "").trim();

    if (isDuplicateCode(suppliers, null, inputCode)) {
      return {
        status: 409,
        data: {
          code: "SUPPLIER_CODE_ALREADY_EXISTS",
          message: "Mã nhà cung cấp đã tồn tại",
          fieldErrors: { code: "Mã nhà cung cấp đã tồn tại — không thể lưu trùng." },
        },
        headers: {},
      };
    }
    if (isDuplicateTaxCode(suppliers, null, taxCode)) {
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
    createdSuppliers.push(created as Supplier);
    return { status: 201, data: toSupplierDto(created as Supplier, purchaseOrders), headers: {} };
  });

  // PUT /suppliers/:id — edit; duplicate taxCode/code on another supplier → inline error
  registerMockRoute("PUT", "/suppliers/:id", async (config) => {
    const { suppliers: seedSuppliers, purchaseOrders } = await import("@/lib/mock-data");
    const suppliers = allSuppliersView(seedSuppliers);
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = parseJsonBody(config.data);
    const { idx, isCreated } = findSupplierIndex(seedSuppliers, createdSuppliers, id);
    if (idx === -1) return { status: 404, data: { message: "Supplier not found" }, headers: {} };

    const taxCode = String(body.taxCode ?? "").trim();
    const inputCodeOnPut = String(body.code ?? "").trim();
    if (isDuplicateCode(suppliers, id, inputCodeOnPut)) {
      return {
        status: 409,
        data: {
          code: "SUPPLIER_CODE_ALREADY_EXISTS",
          message: "Mã nhà cung cấp đã thuộc bản ghi khác",
          fieldErrors: { code: "Mã nhà cung cấp đã thuộc bản ghi khác." },
        },
        headers: {},
      };
    }
    if (isDuplicateTaxCode(suppliers, id, taxCode)) {
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

    // whitelist — never allow id/status overwrite via PUT
    const patch: Partial<Supplier> = {};
    for (const k of [
      "name",
      "taxCode",
      "contactName",
      "contactEmail",
      "contactPhone",
      "address",
      "paymentTerms",
      "currency",
      "leadTimeDays",
      "rating",
    ] as const) {
      if (k in body) (patch as Record<string, unknown>)[k] = body[k];
    }
    if (isCreated) createdSuppliers[idx] = { ...createdSuppliers[idx]!, ...patch } as Supplier;
    else seedSuppliers[idx] = { ...seedSuppliers[idx]!, ...patch } as Supplier;
    const updated = isCreated ? createdSuppliers[idx]! : seedSuppliers[idx]!;
    return { status: 200, data: toSupplierDto(updated, purchaseOrders), headers: {} };
  });

  // PATCH /suppliers/:id/status — block deactivating a supplier with open PO
  registerMockRoute("PATCH", "/suppliers/:id/status", async (config) => {
    const { suppliers: seedSuppliers, purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = parseJsonBody(config.data);
    const { idx, isCreated } = findSupplierIndex(seedSuppliers, createdSuppliers, id);
    if (idx === -1) return { status: 404, data: { message: "Supplier not found" }, headers: {} };

    const target = String(body.status ?? "");
    if (target !== SUPPLIER_STATUS.ACTIVE && target !== SUPPLIER_STATUS.INACTIVE) {
      return {
        status: 422,
        data: {
          code: "VALIDATION_FAILED",
          message: "Trang thai khong hop le",
          fieldErrors: { status: "Trang thai phai la Active hoac Inactive" },
        },
        headers: {},
      };
    }
    const openPos = purchaseOrders.filter(
      (po) => po.supplierId === id && (OPEN_PO_STATUSES as readonly string[]).includes(po.status),
    );

    if (target === SUPPLIER_STATUS.INACTIVE && openPos.length > 0) {
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

    if (isCreated)
      createdSuppliers[idx] = {
        ...createdSuppliers[idx]!,
        active: target === SUPPLIER_STATUS.ACTIVE,
      } as Supplier;
    else
      seedSuppliers[idx] = {
        ...seedSuppliers[idx]!,
        active: target === SUPPLIER_STATUS.ACTIVE,
      } as Supplier;
    const patched = isCreated ? createdSuppliers[idx]! : seedSuppliers[idx]!;
    return { status: 200, data: toSupplierDto(patched, purchaseOrders), headers: {} };
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
   * Permission management (read-only phase)
   * ==================================================================*/

  registerMockRoute("GET", "/v1/identity/roles", async () => {
    return { status: 200, data: mockRoles, headers: {} };
  });

  registerMockRoute("GET", "/v1/identity/roles/:roleCode/permissions", async (config) => {
    const { roleCode } = (config as Record<string, unknown>)._mockParams as Record<string, string>;

    if (roleCode === "FORBIDDEN") {
      return {
        status: 403,
        data: { errorCode: "FORBIDDEN", message: "Bạn không có quyền đọc ma trận quyền." },
        headers: {},
      };
    }

    const fixture = mockRoleMatrices[roleCode];
    if (!fixture) {
      return {
        status: 404,
        data: { errorCode: "ROLE_NOT_FOUND", message: "Không tìm thấy role." },
        headers: {},
      };
    }

    return { status: 200, data: fixture, headers: {} };
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

const mockRoles = [
  {
    code: "ECOMMERCE_ADMIN",
    name: "E-commerce Admin",
    description: "Catalog and platform administration",
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: "flyway",
    lastModifiedAt: null,
    lastModifiedBy: null,
  },
  {
    code: "WAREHOUSE_MANAGER",
    name: "Warehouse Manager",
    description: null,
    createdAt: "2026-09-03T00:00:00Z",
    createdBy: null,
    lastModifiedAt: "2026-09-04T00:00:00Z",
    lastModifiedBy: "admin@example.com",
  },
];

const normalRoleMatrix = {
  roleCode: "ECOMMERCE_ADMIN",
  roleLabel: "E-commerce Admin",
  systemRole: true,
  dataScope: "ALL",
  grantedCount: 2,
  totalCount: 3,
  groups: [
    {
      name: "Platform",
      grantedCount: 2,
      totalCount: 3,
      resources: [
        {
          code: "identity-rbac",
          label: "Permission matrix",
          route: "/admin/permissions",
          apiPath: "/api/v1/identity/rbac",
          grantedCount: 2,
          totalCount: 3,
          actions: [
            { action: "VIEW_PAGE", label: "Open page", granted: true, sensitive: false },
            { action: "READ", label: "Read data", granted: true, sensitive: false },
            { action: "APPROVE", label: "Approve", granted: false, sensitive: true },
          ],
        },
      ],
    },
  ],
};

const mockRoleMatrices: Record<string, typeof normalRoleMatrix> = {
  ECOMMERCE_ADMIN: normalRoleMatrix,
  EMPTY_GROUPS: {
    roleCode: "EMPTY_GROUPS",
    roleLabel: "Empty Groups Fixture",
    systemRole: true,
    dataScope: "ALL",
    grantedCount: 0,
    totalCount: 0,
    groups: [],
  },
  EMPTY_RESOURCES: {
    roleCode: "EMPTY_RESOURCES",
    roleLabel: "Empty Resources Fixture",
    systemRole: true,
    dataScope: "OWN",
    grantedCount: 0,
    totalCount: 0,
    groups: [{ name: "Empty Group", grantedCount: 0, totalCount: 0, resources: [] }],
  },
  EMPTY_ACTIONS: {
    roleCode: "EMPTY_ACTIONS",
    roleLabel: "Empty Actions Fixture",
    systemRole: true,
    dataScope: "WAREHOUSE",
    grantedCount: 0,
    totalCount: 0,
    groups: [
      {
        name: "Empty Actions Group",
        grantedCount: 0,
        totalCount: 0,
        resources: [
          {
            code: "empty-resource",
            label: "Empty Resource",
            route: "/admin/empty",
            apiPath: "/api/v1/empty",
            grantedCount: 0,
            totalCount: 0,
            actions: [],
          },
        ],
      },
    ],
  },
} as const;

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
