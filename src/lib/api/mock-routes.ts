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
  Currency,
  PrintArea,
  PrintTechnique,
  Product,
  ProductAttribute,
  ProductType,
  PoStatus,
  PurchaseOrder,
  Uom,
  WarehouseId,
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

  // Session store: created POs + PATCHED copies. PATCH pushes an updated
  // copy which shadows the seed row by ID (createdPos wins in allPos).
  const createdPos: PurchaseOrder[] = [];

  function allPos(purchaseOrders: PurchaseOrder[]): PurchaseOrder[] {
    const byId = new Map<string, PurchaseOrder>();
    for (const po of [...createdPos, ...purchaseOrders]) byId.set(po.poId, po);
    return [...byId.values()];
  }

  // GET /purchase-orders — supports both BE contract (page 0-based, size, status, sort) and legacy (q, pageSize)
  registerMockRoute("GET", "/purchase-orders", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    // Axios appends query via config.params; reconstruct URLSearchParams from both sources
    const rawUrl = config.url ?? "";
    const qsFromUrl = rawUrl.split("?")[1] ?? "";
    const params = new URLSearchParams(qsFromUrl);
    // Merge axios params object if present
    const axParams = (config as unknown as { params?: Record<string, unknown> }).params;
    const appendAx = (k: string, v: unknown) => {
      if (v == null || v === "") return;
      if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
      else params.set(k, String(v));
    };
    if (axParams) {
      // Handle both `size` (BE) and `pageSize` (legacy)
      if (axParams.size != null) appendAx("size", axParams.size);
      if (axParams.pageSize != null) appendAx("pageSize", axParams.pageSize);
      if (axParams.page != null) {
        // Overwrite page from axParams (BE 0-based intent)
        params.set("page", String(axParams.page));
      }
      if (axParams.supplierId) appendAx("supplierId", axParams.supplierId);
      if (axParams.status) appendAx("status", axParams.status);
      if (axParams.q) appendAx("q", axParams.q);
      if (axParams.sort) appendAx("sort", axParams.sort);
    }

    let filtered = allPos(purchaseOrders);
    const supplierId = params.get("supplierId");
    if (supplierId) filtered = filtered.filter((po) => po.supplierId === supplierId);
    const q = params.get("q")?.toLowerCase();
    if (q)
      filtered = filtered.filter(
        (po) => po.poNumber.toLowerCase().includes(q) || po.poId.toLowerCase().includes(q),
      );
    const statuses = params
      .getAll("status")
      .flatMap((v) => v.split(","))
      .filter(Boolean);
    if (statuses.length) filtered = filtered.filter((po) => statuses.includes(po.status));

    // Sort — BE whitelist: poNumber, expectedAt, createdAt (-> orderDate), lastModifiedAt
    const sortRaw = params.get("sort");
    if (sortRaw) {
      const clauses = sortRaw
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);
      // Apply last clause as primary (BE precedence)
      for (let i = clauses.length - 1; i >= 0; i--) {
        const [propRaw, dirRaw] = clauses[i].split(",").map((s) => s.trim());
        const dir = dirRaw?.toLowerCase() === "desc" ? -1 : 1;
        const getter: Record<string, (po: PurchaseOrder) => string> = {
          poNumber: (po) => po.poNumber,
          expectedAt: (po) => po.expectedDate ?? "",
          createdAt: (po) => po.orderDate,
          lastModifiedAt: (po) => po.expectedDate ?? po.orderDate,
          status: (po) => po.status,
        };
        const get = getter[propRaw];
        if (get) filtered = [...filtered].sort((a, b) => get(a).localeCompare(get(b)) * dir);
      }
    }

    // Pagination — detect BE (0-based page + size) vs legacy (1-based page + pageSize)
    const hasBeSize = params.has("size");
    if (hasBeSize) {
      const page0 = Math.max(0, Number(params.get("page")) || 0);
      const size = Math.max(1, Number(params.get("size")) || 15);
      const totalElements = filtered.length;
      const totalPages = Math.ceil(totalElements / size);
      const start = page0 * size;
      const items = filtered.slice(start, start + size);
      return {
        status: 200,
        data: {
          items,
          page: page0,
          size,
          totalElements,
          totalPages,
          hasNext: page0 + 1 < totalPages,
          hasPrevious: page0 > 0,
          // Compat extras for any client still reading paginate shape
          total: totalElements,
          pageSize: size,
        },
        headers: {},
      };
    }
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.max(1, Number(params.get("pageSize") || params.get("size")) || 15);
    return { status: 200, data: paginate(filtered, page, pageSize), headers: {} };
  });

  // GET /purchase-orders/:id
  registerMockRoute("GET", "/purchase-orders/:id", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const po = allPos(purchaseOrders).find((p) => p.poId === id || p.poNumber === id);
    if (!po) return { status: 404, data: { message: "PO not found" }, headers: {} };
    return { status: 200, data: po, headers: {} };
  });

  // POST /purchase-orders — create (BE: CreatePurchaseOrderRequest)
  registerMockRoute("POST", "/purchase-orders", async (config) => {
    const { purchaseOrders, suppliers } = await import("@/lib/mock-data");
    const body = parseJsonBody(config.data);

    // Accept BE shape (supplierId, currency, expectedAt, lines:[{sku, quantityOrdered, unitPrice}])
    // and legacy FE alias shape compat
    const supplierId = readString(body.supplierId);
    const currency = readCurrency(body.currency);
    const expectedAt = readString(body.expectedAt ?? body.expectedDate);
    const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];

    const fieldErrors: Record<string, string> = {};
    if (!supplierId) fieldErrors.supplierId = "Chọn nhà cung cấp";
    if (rawLines.length === 0) fieldErrors.lines = "Phải có ít nhất 1 dòng hàng";

    // Per-line validation — return 422 with fieldErrors (don't coerce)
    rawLines.forEach((raw, idx) => {
      const r = isRecord(raw) ? raw : {};
      const sku = readString(r.sku ?? r.skuId);
      const qtyRaw = r.quantityOrdered ?? r.orderedQty;
      const priceRaw = r.unitPrice;
      if (!sku) fieldErrors[`lines[${idx}].sku`] = "SKU là bắt buộc";
      const qty = Number(qtyRaw);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        fieldErrors[`lines[${idx}].quantityOrdered`] = "Số lượng phải là số nguyên > 0";
      }
      const price = Number(priceRaw);
      if (priceRaw !== undefined && (!Number.isFinite(price) || price < 0)) {
        fieldErrors[`lines[${idx}].unitPrice`] = "Đơn giá không âm";
      }
    });
    // Supplier existence / active check mirrors BE ProcurementServiceImpl
    if (supplierId && !fieldErrors.supplierId) {
      const sup = suppliers.find((s) => s.supplierId === supplierId);
      if (!sup) {
        return {
          status: 404,
          data: { code: "SUPPLIER_NOT_FOUND", message: `No supplier with id ${supplierId}` },
          headers: {},
        };
      }
      if (!sup.active) {
        return {
          status: 409,
          data: { code: "SUPPLIER_INACTIVE", message: `Supplier ${supplierId} is INACTIVE` },
          headers: {},
        };
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return {
        status: 422,
        data: { code: "VALIDATION_FAILED", message: "Dữ liệu chưa hợp lệ.", fieldErrors },
        headers: {},
      };
    }

    // BR-PO-003 (BE): same supplier + same expectedAt + any overlapping SKU among open POs → warning flag
    const inputSkus = rawLines
      .map((l) =>
        readString((l as Record<string, unknown>).sku ?? (l as Record<string, unknown>).skuId),
      )
      .filter(Boolean);
    const inputSkuSet = new Set(inputSkus);
    const openStatuses: readonly string[] = [
      "DRAFT",
      "APPROVED",
      "SENT",
      "PARTIALLY_RECEIVED",
      "Draft",
      "Approved",
      "Confirmed",
      "Partially Received",
    ];
    const possibleDuplicate =
      expectedAt !== "" &&
      allPos(purchaseOrders).some((existing) => {
        if (existing.supplierId !== supplierId) return false;
        if (existing.expectedDate !== expectedAt) return false;
        if (!openStatuses.includes(existing.status)) return false;
        return existing.lines.some((l) => inputSkuSet.has(l.skuId));
      });

    // ID: avoid collision with non-contiguous seed (use max suffix)
    const maxSuffix = allPos(purchaseOrders).reduce((m, po) => {
      const n = Number(String(po.poId).replace(/.*-/, ""));
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const poId = `PO-2026-${String(maxSuffix + 1).padStart(4, "0")}`;
    const now = new Date().toISOString().slice(0, 10);

    const poLines = (rawLines as Record<string, unknown>[]).map((l, idx) => {
      const sku = readString(l.sku ?? l.skuId) || `SKU-${idx + 1}`;
      const orderedQty = Math.trunc(Number(l.quantityOrdered ?? l.orderedQty) || 0);
      const unitPrice = Number(l.unitPrice) || 0;
      const lineTotal = orderedQty * unitPrice;
      return {
        lineId: `${poId}-${idx + 1}`,
        poId,
        skuId: sku,
        orderedQty,
        receivedQty: 0,
        unitPrice,
        currency,
        taxRate: 0,
        discountRate: 0,
        uom: "pcs" as const,
        lineTotal,
      };
    });

    const subtotal = poLines.reduce((sum, l) => sum + l.lineTotal, 0);

    const po: PurchaseOrder = {
      poId,
      poNumber: poId,
      supplierId,
      warehouseId: readWarehouseId(body.warehouseId),
      status: "DRAFT" as unknown as PoStatus,
      currency,
      orderDate: now,
      expectedDate: expectedAt,
      createdBy: "Mock User",
      subtotal,
      taxTotal: 0,
      grandTotal: subtotal,
      lines: poLines,
      notes: readString(body.notes) || undefined,
      fromProposalId: readString(body.fromProposalId) || undefined,
    };

    createdPos.push(po);

    return { status: 201, data: { ...po, possibleDuplicate }, headers: {} };
  });

  function applyPoStatusTransition(
    source: PurchaseOrder,
    targetStatus: string,
    reason?: string,
  ): { ok: true; updated: PurchaseOrder } | { ok: false; status: number; data: unknown } {
    // Mirrors BE PO_TRANSITIONS + reasons for cancel/closeShort
    const needsReason = targetStatus === "CANCELLED" || targetStatus === "CLOSED_SHORT";
    if (needsReason && !readString(reason)) {
      return {
        ok: false,
        status: 400,
        data: {
          code: "VALIDATION_FAILED",
          message: "Lý do là bắt buộc.",
          fieldErrors: { reason: "Nhập lý do" },
        },
      };
    }
    return {
      ok: true,
      updated: {
        ...source,
        status: targetStatus as PoStatus,
        rejectionReason:
          targetStatus === "CANCELLED" || targetStatus === "CLOSED_SHORT"
            ? readString(reason) || source.rejectionReason
            : source.rejectionReason,
      },
    };
  }

  // BE — per-action endpoints (PurchaseOrderController.java)
  const poAction =
    (action: "APPROVED" | "SENT" | "CANCELLED" | "CLOSED_SHORT", needsReason: boolean) =>
    async (config: unknown) => {
      const { purchaseOrders } = await import("@/lib/mock-data");
      const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
      const body = parseJsonBody((config as { data?: unknown }).data);
      const reason = readString(body.reason);
      const source = allPos(purchaseOrders).find((p) => p.poId === id || p.poNumber === id);
      if (!source) return { status: 404, data: { message: "PO not found" }, headers: {} };
      const { PO_TRANSITIONS } = await import("@/lib/domain/lifecycle");
      const valid = (PO_TRANSITIONS as Record<string, readonly string[]>)[
        source.status as string
      ] as readonly string[] | undefined;
      if (!valid?.includes(action)) {
        return {
          status: 409,
          data: {
            code: "INVALID_PURCHASE_ORDER_TRANSITION",
            message: `Không thể chuyển từ "${source.status}" sang "${action}".`,
            currentStatus: source.status,
            targetStatus: action,
            validTargets: valid ?? [],
          },
          headers: {},
        };
      }
      if (needsReason && !reason) {
        return {
          status: 400,
          data: {
            code: "VALIDATION_FAILED",
            message: "Lý do là bắt buộc.",
            fieldErrors: { reason: "Nhập lý do" },
          },
          headers: {},
        };
      }
      const result = applyPoStatusTransition(source, action, reason);
      if (!result.ok) return { status: result.status, data: result.data, headers: {} };
      const idx = createdPos.findIndex((p) => p.poId === id || p.poNumber === id);
      if (idx === -1) createdPos.push(result.updated);
      else createdPos[idx] = result.updated;
      return { status: 200, data: result.updated, headers: {} };
    };

  registerMockRoute("POST", "/purchase-orders/:id/approval", poAction("APPROVED", false));
  registerMockRoute("POST", "/purchase-orders/:id/sending", poAction("SENT", false));
  registerMockRoute("POST", "/purchase-orders/:id/cancellation", poAction("CANCELLED", true));
  registerMockRoute("POST", "/purchase-orders/:id/closure-short", poAction("CLOSED_SHORT", true));
  registerMockRoute("POST", "/purchase-orders/:id/receipts", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = parseJsonBody((config as { data?: unknown }).data);
    const lines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
    const source = allPos(purchaseOrders).find((p) => p.poId === id || p.poNumber === id);
    if (!source) return { status: 404, data: { message: "PO not found" }, headers: {} };
    if (
      (source.status as string) !== "SENT" &&
      (source.status as string) !== "PARTIALLY_RECEIVED"
    ) {
      return {
        status: 409,
        data: {
          code: "INVALID_PURCHASE_ORDER_TRANSITION",
          message: `cannot receive goods while ${source.status} (must be SENT or PARTIALLY_RECEIVED)`,
        },
        headers: {},
      };
    }
    const byId = new Map(source.lines.map((l) => [l.lineId, l]));
    for (const raw of lines as Record<string, unknown>[]) {
      const lineId = readString(raw.lineId);
      const qty = Number(raw.quantity);
      if (!byId.has(lineId)) {
        return {
          status: 400,
          data: { code: "VALIDATION_FAILED", message: `Line ${lineId} is not on PO ${id}` },
          headers: {},
        };
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          status: 422,
          data: {
            code: "VALIDATION_FAILED",
            message: "quantity must be > 0",
            fieldErrors: { quantity: "quantity must be > 0" },
          },
          headers: {},
        };
      }
    }
    const updatedLines = source.lines.map((l) => {
      const match = (lines as Record<string, unknown>[]).find(
        (r) => readString(r.lineId) === l.lineId,
      );
      if (!match) return l;
      return { ...l, receivedQty: l.receivedQty + Number(match.quantity) };
    });
    const fullyReceived = updatedLines.every((l) => l.receivedQty >= l.orderedQty);
    const updated: PurchaseOrder = {
      ...source,
      status: (fullyReceived ? "CLOSED" : "PARTIALLY_RECEIVED") as unknown as PoStatus,
      lines: updatedLines,
    };
    const idx = createdPos.findIndex((p) => p.poId === id || p.poNumber === id);
    if (idx === -1) createdPos.push(updated);
    else createdPos[idx] = updated;
    return { status: 200, data: updated, headers: {} };
  });

  // Compat — old generic endpoint (keep for any stray FE code)
  registerMockRoute("PATCH", "/purchase-orders/:id/status", async (config) => {
    const { purchaseOrders } = await import("@/lib/mock-data");
    const { id } = (config as Record<string, unknown>)._mockParams as Record<string, string>;
    const body = parseJsonBody(config.data);
    const targetStatus = readString(body.targetStatus);
    const reason = readString(body.reason);

    const source = allPos(purchaseOrders).find((p) => p.poId === id || p.poNumber === id);
    if (!source) return { status: 404, data: { message: "PO not found" }, headers: {} };

    // Lifecycle gate — mirrors canTransition(PO_TRANSITIONS, ...) (docs §5)
    const { PO_TRANSITIONS } = await import("@/lib/domain/lifecycle");
    const validTargets = (PO_TRANSITIONS as Record<string, readonly string[]>)[
      source.status as string
    ];
    if (!validTargets || !validTargets.includes(targetStatus as PoStatus)) {
      return {
        status: 409,
        data: {
          code: "INVALID_PURCHASE_ORDER_TRANSITION",
          message: `Không thể chuyển từ "${source.status}" sang "${targetStatus}" (trạng thái hợp lệ: ${(validTargets ?? []).join(", ") || "không — trạng thái kết thúc"}).`,
          currentStatus: source.status,
          targetStatus,
          validTargets: validTargets ?? [],
        },
        headers: {},
      };
    }

    const updated: PurchaseOrder = {
      ...source,
      status: targetStatus as PoStatus,
      approvalNote: targetStatus === "Approved" ? reason || undefined : source.approvalNote,
      approvedBy: targetStatus === "Approved" ? "Mock Approver" : source.approvedBy,
      rejectionReason:
        targetStatus === "Draft" || targetStatus === "Cancelled"
          ? reason || source.rejectionReason
          : source.rejectionReason,
    };

    const createdIndex = createdPos.findIndex((p) => p.poId === id || p.poNumber === id);
    if (createdIndex === -1) createdPos.push(updated);
    else createdPos[createdIndex] = updated;

    return { status: 200, data: updated, headers: {} };
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

const WAREHOUSE_ID_SET: readonly WarehouseId[] = ["WH-HN-01", "WH-HCM-01", "WH-DN-01"];

function readCurrency(value: unknown, fallback: Currency = "VND"): Currency {
  return value === "VND" || value === "USD" || value === "CNY" ? value : fallback;
}

function readWarehouseId(value: unknown, fallback: WarehouseId = "WH-HN-01"): WarehouseId {
  return WAREHOUSE_ID_SET.find((w) => w === value) ?? fallback;
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
