/**
 * Mock routes — đọc tồn kho cho màn tổng quan (SCRUM-438), chỉ dùng khi USE_MOCK=true.
 *
 * Hợp đồng chép từ BE develop 0f18f24: InventoryController (stock-levels, warehouse stock-items,
 * ATP, reservations), StockAlertController, StockBrowsingImpl / StockBrowseSearchAdapter (lọc,
 * sắp xếp, phân trang), Pages + SortWhitelist (UNSUPPORTED_PARAMETER) và GlobalExceptionHandler
 * (thiếu / sai SKU → VALIDATION_FAILED). Cùng một đường `api.ts` → `inventoryRequest` → axios
 * dùng cho cả mock lẫn BE thật.
 *
 * Không mô phỏng: phân quyền và phạm vi kho (OUT_OF_DATA_SCOPE), hàng gửi gia công (BE chưa làm
 * BR-PRD-15), tìm theo tên sản phẩm (BE không có). Dữ liệu: `mock-routes-inventory-stock-data.ts`.
 */

import {
  INVENTORY_API,
  RESERVATION_STATUSES,
  STOCK_ALERT_KINDS,
  STOCK_ALERT_SORT_FIELDS,
  STOCK_ALERT_STATUSES,
  STOCK_ITEM_SORT_FIELDS,
  STOCK_STATUSES,
} from "@/constants/inventory";

import { SKU_CODE_PATTERN } from "@/lib/validation/sku";

import { paginatePage, registerMockRoute } from "./mock-adapter";
import {
  MOCK_RESERVATIONS,
  MOCK_STOCK_ALERTS,
  MOCK_STOCK_LEVELS,
  MOCK_STOCK_ROWS,
  MOCK_STOCK_WAREHOUSES,
} from "./mock-routes-inventory-stock-data";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_GENERIC_VALIDATION_MESSAGE,
  BE_MAX_PAGE_SIZE,
  beError,
  readParams,
  readRouteId,
} from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";

type Params = Record<string, unknown>;
type MockReply = ReturnType<typeof ok> | ReturnType<typeof beError>;
type SortClause = { field: string; descending: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNSUPPORTED = "Unsupported parameter value";

function ok(data: unknown) {
  return { status: 200, data: { success: true, data }, headers: {} };
}

/** A rejected request, thrown from a parser and turned into the backend error by `route`. */
class Rejected extends Error {
  constructor(readonly reply: ReturnType<typeof beError>) {
    super(reply.data.errorCode);
  }
}

const unsupported = (field: string) =>
  new Rejected(
    beError(400, "UNSUPPORTED_PARAMETER", UNSUPPORTED, [{ field, message: UNSUPPORTED }]),
  );
const invalid = () =>
  new Rejected(beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE));

function route(handler: (params: Params, config: AxiosRequestConfig) => MockReply) {
  return (config: AxiosRequestConfig) => {
    try {
      return handler(readParams(config), config);
    } catch (error: unknown) {
      if (error instanceof Rejected) return error.reply;
      throw error;
    }
  };
}

/** Jackson NON_NULL: trường null không có mặt trong JSON. */
function omitNulls<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== null),
  ) as Partial<T>;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** `new Sku(raw)`: bắt buộc, trim + viết hoa, sai định dạng → 400 VALIDATION_FAILED. */
function requiredSku(params: Params): string {
  const sku = text(params.sku)?.toUpperCase();
  if (!sku || !SKU_CODE_PATTERN.test(sku)) throw invalid();
  return sku;
}

/** Pages.of: trang từ 0, size 1…200, mặc định 20. */
function paging(params: Params): { page: number; size: number } {
  const page = params.page === undefined ? 0 : Number(params.page);
  const size = params.size === undefined ? BE_DEFAULT_PAGE_SIZE : Number(params.size);
  if (!Number.isInteger(page) || page < 0) throw unsupported("page");
  if (!Number.isInteger(size) || size < 1 || size > BE_MAX_PAGE_SIZE) throw unsupported("size");
  return { page, size };
}

/** List/Set<Enum> của Spring: `status=A,B` hoặc `status=A&status=B`; mã lạ → 400. */
function enumList(value: unknown, allowed: readonly string[], field: string): string[] | null {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const items = raw.flatMap((item) => String(item).split(",")).filter(Boolean);
  if (items.length === 0) return null;
  if (items.some((item) => !allowed.includes(item))) throw unsupported(field);
  return items;
}

/** SortWhitelist.parse: `field,dir;field,dir`, field ngoài whitelist → 400. */
function sortClauses(value: unknown, allowed: readonly string[], fallback: SortClause) {
  const clauses = (text(value) ?? "")
    .split(";")
    .map((clause) => clause.trim())
    .filter(Boolean)
    .map((clause) => {
      const [field = "", direction = ""] = clause.split(",").map((part) => part.trim());
      if (!allowed.includes(field)) throw unsupported("sort");
      return { field, descending: direction.toLowerCase() === "desc" };
    });
  return clauses.length ? clauses : [fallback];
}

// BE không tự chỉ định thứ tự null; mock theo mặc định PostgreSQL (ASC: null cuối, DESC: null đầu).
function sortRows<T extends object>(rows: readonly T[], clauses: readonly SortClause[]): T[] {
  return [...rows].sort((left, right) => {
    for (const { field, descending } of clauses) {
      const a: unknown = Reflect.get(left, field);
      const b: unknown = Reflect.get(right, field);
      if (a === b) continue;
      if (a === null || a === undefined) return descending ? -1 : 1;
      if (b === null || b === undefined) return descending ? 1 : -1;
      const order = String(a).localeCompare(String(b), "en", { numeric: true });
      if (order !== 0) return descending ? -order : order;
    }
    return 0;
  });
}

function pageOf<T extends object>(rows: readonly T[], params: Params) {
  const { page, size } = paging(params);
  const result = paginatePage([...rows], page, size);
  return { ...result, items: result.items.map(omitNulls) };
}

const inWarehouse = (locationCode: string, code: string) => locationCode.startsWith(`${code}-`);

// GET /inventory/stock-levels?sku= — mọi kho có tồn của SKU, theo mã kho (TreeMap), không phân trang.
const stockLevels = route((params) => {
  const sku = requiredSku(params);
  const levels = MOCK_STOCK_LEVELS.filter((level) => level.sku === sku);
  return ok([...levels].sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode)));
});

// GET /inventory/warehouses/{warehouseId}/stock-items — mọi trạng thái, mặc định locationCode ASC.
const warehouseStockItems = route((params, config) => {
  const warehouse = MOCK_STOCK_WAREHOUSES.find((item) => item.warehouseId === readRouteId(config));
  if (!warehouse) throw new Rejected(beError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found"));
  const location = text(params.location);
  if (location && !inWarehouse(location.toUpperCase(), warehouse.code)) throw invalid();
  // StockBrowseSearchAdapter so khớp sku / lot nguyên văn (chỉ trim), không viết hoa.
  const sku = text(params.sku);
  const lot = text(params.lot);
  const statuses = enumList(params.status, STOCK_STATUSES, "status");
  const includeEmpty = params.includeEmpty === true || params.includeEmpty === "true";
  const sort = sortClauses(params.sort, STOCK_ITEM_SORT_FIELDS, {
    field: "locationCode",
    descending: false,
  });
  const rows = MOCK_STOCK_ROWS.filter(
    (row) =>
      inWarehouse(row.locationCode, warehouse.code) &&
      (!location || row.locationCode.startsWith(location)) &&
      (!sku || row.sku === sku) &&
      (!lot || row.lotNumber === lot) &&
      (!statuses || statuses.includes(row.status)) &&
      (includeEmpty || row.onHand > 0),
  );
  return ok(pageOf(sortRows(rows, sort), params));
});

// GET /inventory/stock-items/atp?sku=&warehouse= — số nguyên; SKU / kho không có tồn → 0.
const atp = route((params) => {
  const sku = requiredSku(params);
  const warehouse = text(params.warehouse)?.toUpperCase();
  const total = MOCK_STOCK_LEVELS.filter(
    (level) => level.sku === sku && (!warehouse || level.warehouseCode === warehouse),
  ).reduce((sum, level) => sum + level.atp, 0);
  return ok(total);
});

// GET /inventory/reservations — mới nhất trước (reservedAt DESC, id ASC), không có tham số sort.
const reservations = route((params) => {
  const orderId = text(params.orderId);
  if (orderId && !UUID_PATTERN.test(orderId)) throw unsupported("orderId");
  const sku = text(params.sku);
  const statuses = enumList(params.status, RESERVATION_STATUSES, "status");
  const warehouse = text(params.warehouse)?.toUpperCase();
  const rows = MOCK_RESERVATIONS.filter(
    (row) =>
      (!orderId || row.orderId === orderId) &&
      (!sku || row.sku === sku) &&
      (!statuses || statuses.includes(row.status)) &&
      (!warehouse || inWarehouse(row.locationCode, warehouse)),
  );
  const sorted = sortRows(rows, [
    { field: "reservedAt", descending: true },
    { field: "reservationId", descending: false },
  ]);
  return ok(pageOf(sorted, params));
});

// GET /inventory/alerts — mặc định openedAt DESC; sku được trim + viết hoa (StockAlertRepository).
const alerts = route((params) => {
  const kinds = enumList(params.kind, STOCK_ALERT_KINDS, "kind");
  const statuses = enumList(params.status, STOCK_ALERT_STATUSES, "status");
  const sku = text(params.sku)?.toUpperCase();
  const warehouseId = text(params.warehouseId);
  const sort = sortClauses(params.sort, STOCK_ALERT_SORT_FIELDS, {
    field: "openedAt",
    descending: true,
  });
  const rows = MOCK_STOCK_ALERTS.filter(
    (alert) =>
      (!kinds || kinds.includes(alert.kind)) &&
      (!statuses || statuses.includes(alert.status)) &&
      (!sku || alert.sku === sku) &&
      (!warehouseId || alert.warehouseId === warehouseId),
  );
  return ok(pageOf(sortRows(rows, sort), params));
});

// The path builder URL-encodes its argument, so build with a plain token and swap in `:id`.
const ROUTE_ID = "ROUTE_ID";

export function registerInventoryStockMockRoutes(): void {
  registerMockRoute("GET", INVENTORY_API.stockLevels, stockLevels);
  registerMockRoute(
    "GET",
    INVENTORY_API.warehouseStockItems(ROUTE_ID).replace(ROUTE_ID, ":id"),
    warehouseStockItems,
  );
  registerMockRoute("GET", INVENTORY_API.atp, atp);
  registerMockRoute("GET", INVENTORY_API.reservations, reservations);
  registerMockRoute("GET", INVENTORY_API.alerts, alerts);
}
