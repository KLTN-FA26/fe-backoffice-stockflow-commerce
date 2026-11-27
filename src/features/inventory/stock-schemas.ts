import { z } from "zod";

import {
  INVENTORY_LIMITS,
  INVENTORY_MESSAGES,
  INVENTORY_SORT_DIRECTIONS,
  RESERVATION_STATUSES,
  STOCK_ITEM_SORT_FIELDS,
  STOCK_STATUSES,
} from "@/constants/inventory";

import { beUuid } from "@/lib/validation/primitives";
import { skuSchema } from "@/lib/validation/sku";

import { inventoryPageDto } from "./schemas";

// Read side of Inventory Overview (SCRUM-438). Source: backend develop 0f18f24 InventoryController
// and its response records. Jackson NON_NULL omits null fields, so every
// nullable field is `.nullish()`. Enum-valued fields are Strings on the wire and are read open, as
// in schemas.ts: one newer code must not invalidate a whole page. Request filters stay strict.

const quantity = z.number().int();
// ADR-0011 (BE refactor/inventory-carton-only-stock, step 3e): tồn đếm theo thùng — số thùng là số BE đếm, không còn
// null (trước đây là đơn vị ÷ số chuẩn của SKU). Đơn vị cơ sở là thông tin phụ.
const cartons = z.number().int();
// Warehouse ids come from the shared warehouse directory (lib/references), which reads them as
// open strings; the mock directory's ids are not UUIDs. The backend validates the UUID itself.
const warehouseId = z.string().min(1);

/** StockLevelResponse: one SKU in one warehouse. Every quantity is computed by the backend. */
export const stockLevelDto = z.object({
  sku: z.string(),
  warehouseCode: z.string(),
  onHand: quantity,
  available: quantity,
  reserved: quantity,
  allocated: quantity,
  atp: quantity,
  onHandCartons: cartons,
  availableCartons: cartons,
  reservedCartons: cartons,
  allocatedCartons: cartons,
  // BE tính ATP thùng theo từng số chuẩn của thùng — không suy ra từ `atp`.
  atpCartons: cartons,
});
export const stockLevelsDto = z.array(stockLevelDto);

/** WarehouseStockItemResponse (SCRUM-462): one stock row of a warehouse, in any status. */
export const warehouseStockItemDto = z.object({
  stockItemId: beUuid,
  sku: z.string(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  expiryDate: z.iso.date().nullish(),
  // SCRUM-146 (BE #202): absent while the slot is under an open count and the caller lacks
  // inventory-cycle-counts:APPROVE; `hiddenDuringCount` is then true.
  onHand: quantity.optional(),
  reserved: quantity.optional(),
  available: quantity.optional(),
  // ADR-0011 step 3e: mỗi dòng là một thùng → 1 hoặc 0; vắng / null chỉ khi `hiddenDuringCount`.
  onHandCartons: cartons.nullish(),
  reservedCartons: cartons.nullish(),
  availableCartons: cartons.nullish(),
  hiddenDuringCount: z.boolean().default(false),
  status: z.string(),
  receivedAt: z.iso.datetime().nullish(),
});
export const warehouseStockItemPageDto = inventoryPageDto(warehouseStockItemDto);

/** GET /stock-items/atp answers a bare integer: zero is an answer, not "not found". */
export const atpDto = quantity;

/** ReservationRowResponse (SCRUM-462). The backend exposes the order's id, not its number. */
export const reservationRowDto = z.object({
  reservationId: beUuid,
  orderId: beUuid,
  stockItemId: beUuid,
  sku: z.string(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  quantity,
  // ADR-0011 step 3e: số thùng giữ chỗ, bên cạnh `quantity` (đơn vị cơ sở). `expiresAt` đã bỏ (step 3c) — luôn null.
  cartons,
  status: z.string(),
  reservedAt: z.iso.datetime(),
  releaseReason: z.string().nullish(),
  closedAt: z.iso.datetime().nullish(),
});
export const reservationPageDto = inventoryPageDto(reservationRowDto);

// ── Request inputs ─────────────────────────────────────────────────────────────────────────────

// Exact SKU only (no partial or product-name search on the backend): trimmed, upper-cased like
// the backend `Sku` record. The warehouse-stock and reservation filters compare it verbatim.
// common.domain.Sku (backend develop 103aa04): validate the shared alphabet, then normalise.
const sku = skuSchema({
  required: INVENTORY_MESSAGES.required,
  format: INVENTORY_MESSAGES.invalidSku,
}).transform((value) => value.toUpperCase());
// Absent or blank → omitted from the request, never sent as an empty string.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
const optionalSku = optionalText.pipe(sku.optional());
// Comma-joined on the wire (`status=A,B`): Spring binds that to a List/Set, not `status[]=`.
// An empty list would match nothing on the backend, so callers omit the filter instead.
function commaList<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .array(z.enum(values))
    .min(1)
    .optional()
    .transform((list) => list?.join(","));
}
function sortClause<T extends readonly [string, ...string[]]>(fields: T) {
  return z
    .object({ field: z.enum(fields), direction: z.enum(INVENTORY_SORT_DIRECTIONS) })
    .optional()
    .transform((sort) => sort && `${sort.field},${sort.direction}`);
}
const paging = {
  page: z.number().int().nonnegative(),
  size: z.number().int().positive().max(INVENTORY_LIMITS.maxPageSize),
};

export const stockLevelsInput = z.object({ sku });

/** Overview SKU form: the same exact code the backend `Sku` record accepts, normalised on submit. */
export const skuLookupInput = z.object({ sku });

export const warehouseStockItemsInput = z.object({
  warehouseId,
  sku: optionalSku,
  location: optionalText,
  lot: optionalText,
  status: commaList(STOCK_STATUSES),
  includeEmpty: z.boolean().optional(),
  ...paging,
  sort: sortClause(STOCK_ITEM_SORT_FIELDS),
});

// `warehouse` is the backend's optional prefix code. Without it the backend answers system-wide
// ATP without applying the caller's warehouse scope (InventoryServiceImpl.availableToPromise).
export const atpInput = z.object({ sku, warehouse: optionalText });

export const reservationListInput = z.object({
  orderId: beUuid.optional(),
  sku: optionalSku,
  status: commaList(RESERVATION_STATUSES),
  warehouse: optionalText,
  ...paging,
});
