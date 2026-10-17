/**
 * Mock routes — điều chỉnh tồn + sổ kho (SCRUM-424/439), chỉ dùng khi USE_MOCK=true.
 *
 * Hợp đồng chép từ BE develop 0f18f24: StockOperationsController (đường dẫn, @Valid),
 * StockOperationsServiceImpl (thứ tự kiểm tra, sổ kho khi duyệt), StockAdjustment (bốn mắt,
 * vòng đời, SCRAP/SAMPLE chỉ giảm, OTHER phải có giải thích), ErrorCode (mã + HTTP status).
 *
 * State nằm trong bộ nhớ module và bắt đầu RỖNG — không thêm bản ghi vào mock-data.ts. Phiếu
 * và dòng sổ kho chỉ sinh ra từ chính các thao tác tạo / duyệt trong phiên mock.
 *
 * Không mô phỏng (mock không có dữ liệu tồn kho thật để quyết định): STOCK_ITEM_NOT_FOUND,
 * INSUFFICIENT_STOCK, INVENTORY_POLICY_STOCK_CONFLICT, OUT_OF_DATA_SCOPE và `status`/`toStatus`
 * của dòng sổ kho (BE lấy từ trạng thái thật của stock item).
 */

import {
  INVENTORY_API,
  INVENTORY_LIMITS,
  STOCK_ADJUSTMENT_REASON,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS, STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";

import { SKU_INPUT_PATTERN } from "@/lib/validation/sku";

import { registerMockRoute } from "./mock-adapter";
import {
  beError,
  parseJsonBody,
  readParams,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

interface MockAdjustment {
  adjustmentId: string;
  number: string;
  locationCode: string;
  sku: string;
  lotNumber: string | null;
  quantityDelta: number;
  reason: string;
  note: string | null;
  status: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  postedAt: string | null;
  withdrawnAt: string | null;
  version: number;
  seq: number;
}

interface MockMovement {
  movementId: string;
  type: string;
  sku: string;
  lotNumber: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason: string;
  actorId: string;
  occurredAt: string;
  seq: number;
}

const adjustments = new Map<string, MockAdjustment>();
const movements: MockMovement[] = [];
const numberByDay = new Map<string, number>();
let seq = 0;

export function resetInventoryMockState(): void {
  adjustments.clear();
  movements.length = 0;
  numberByDay.clear();
  seq = 0;
}

/* ── Wire helpers ────────────────────────────────────────────────────── */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE_DEFAULT = 20; // BE Pages.DEFAULT_PAGE_SIZE
const PAGE_SIZE_MAX = 200; // BE Pages.MAX_PAGE_SIZE
const CLOSED_STATUSES: readonly string[] = [
  STOCK_ADJUSTMENT_STATUS.POSTED,
  STOCK_ADJUSTMENT_STATUS.REJECTED,
  STOCK_ADJUSTMENT_STATUS.WITHDRAWN,
];

function ok(data: unknown, status = 200) {
  return { status, data: { success: true, data }, headers: {} };
}

/** Jackson NON_NULL: trường null không có mặt trong JSON. */
function nonNull<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([key, field]) => field !== null && key !== "seq"),
  ) as Partial<T>;
}

/**
 * Người dùng của phiên mock (cùng nguồn với `/identity/me/permissions`). Id mock-data không
 * phải UUID còn BE luôn trả UUID → đổi ổn định sang UUID; cùng người luôn ra cùng id.
 */
export function mockActorId(userId: string): string {
  if (UUID_PATTERN.test(userId)) return userId.toLowerCase();
  const hex = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < userId.length; index += 1) {
        hash = Math.imul(hash ^ userId.charCodeAt(index), 16777619) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    })
    .join("");
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function currentActor(): Promise<string | null> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId;
  return userId ? mockActorId(userId) : null;
}

function unauthenticated() {
  return beError(401, "UNAUTHORIZED", "Authentication required");
}

function validationFailed(message: string, fieldErrors?: MockFieldError[]) {
  return beError(400, "VALIDATION_FAILED", message, fieldErrors);
}

function unsupported(field: string, message: string) {
  return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter value", [
    { field, message, code: "TypeMismatch" },
  ]);
}

/** Business day `YYYYMMDD` theo Asia/Ho_Chi_Minh (BE BUSINESS_ZONE + BASIC_ISO_DATE). */
function businessDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })
    .format(now)
    .replaceAll("-", "");
}

function nextNumber(now: Date): string {
  const day = businessDay(now);
  const value = (numberByDay.get(day) ?? 0) + 1;
  numberByDay.set(day, value);
  return `ADJ-${day}-${String(value).padStart(4, "0")}`;
}

/** BE `Pages.of`: page ≥ 0, 1 ≤ size ≤ 200, mặc định 20. */
function readPage(config: AxiosRequestConfig) {
  const params = readParams(config);
  const page = params.page === undefined ? 0 : Number(params.page);
  const size = params.size === undefined ? PAGE_SIZE_DEFAULT : Number(params.size);
  if (!Number.isInteger(page) || page < 0) return { error: unsupported("page", "must be ≥ 0") };
  if (!Number.isInteger(size) || size < 1 || size > PAGE_SIZE_MAX) {
    return { error: unsupported("size", `must be 1..${PAGE_SIZE_MAX}`) };
  }
  return { page, size, params };
}

function pageOf<T extends object>(all: readonly T[], page: number, size: number) {
  const totalPages = Math.ceil(all.length / size);
  return {
    items: all.slice(page * size, page * size + size).map(nonNull),
    page,
    size,
    totalElements: all.length,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  };
}

/** BE Sku/LocationId: trim + upper case; bộ lọc so khớp chính xác. */
function code(value: unknown): string {
  return readString(value).toUpperCase();
}

/* ── Adjustments ─────────────────────────────────────────────────────── */

/** BE ADJUSTMENT_SORT: createdAt | status | sku, mặc định createdAt desc; trường khác → 400. */
function adjustmentComparator(raw: string) {
  const keys = { createdAt: "seq", status: "status", sku: "sku" } as const;
  const clauses = raw.trim()
    ? raw.split(";").filter((clause) => clause.trim())
    : ["createdAt,desc"];
  const orders: Array<{ key: (typeof keys)[keyof typeof keys]; desc: boolean }> = [];
  for (const clause of clauses) {
    const [property = "", direction = ""] = clause.split(",").map((part) => part.trim());
    if (!(property in keys)) return null;
    orders.push({
      key: keys[property as keyof typeof keys],
      desc: direction.toLowerCase() === "desc",
    });
  }
  return (a: MockAdjustment, b: MockAdjustment) => {
    for (const { key, desc } of orders) {
      const diff = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
      if (diff) return desc ? -diff : diff;
    }
    return 0;
  };
}

function listAdjustments(config: AxiosRequestConfig) {
  const paging = readPage(config);
  if (paging.error) return paging.error;
  const { params, page, size } = paging;
  const status = readString(params.status);
  if (status && !STOCK_ADJUSTMENT_STATUSES.some((known) => known === status)) {
    return unsupported("status", "must be StockAdjustmentStatus");
  }
  const sort = adjustmentComparator(readString(params.sort));
  if (!sort) return beError(400, "UNSUPPORTED_PARAMETER", "Cannot sort by that property");
  const sku = code(params.sku);
  const location = code(params.location);
  const rows = [...adjustments.values()]
    .filter((row) => !status || row.status === status)
    .filter((row) => !sku || row.sku === sku)
    .filter((row) => !location || row.locationCode === location)
    .sort(sort);
  return ok(pageOf(rows, page, size));
}

/** BE `load`: id phải là UUID (path variable), không có → 404. */
function load(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  if (!UUID_PATTERN.test(id)) return { error: unsupported("adjustmentId", "must be UUID") };
  const adjustment = adjustments.get(id.toLowerCase());
  if (!adjustment) {
    return {
      error: beError(404, "STOCK_ADJUSTMENT_NOT_FOUND", `No stock adjustment ${id}`),
    };
  }
  return { adjustment };
}

/** StockAdjustment.requirePending. */
function requirePending(adjustment: MockAdjustment) {
  return CLOSED_STATUSES.includes(adjustment.status)
    ? beError(
        409,
        "INVALID_ADJUSTMENT_TRANSITION",
        `Adjustment ${adjustment.number} is already ${adjustment.status}`,
      )
    : null;
}

function save(adjustment: MockAdjustment, patch: Partial<MockAdjustment>) {
  const next = { ...adjustment, ...patch, version: adjustment.version + 1 };
  adjustments.set(next.adjustmentId, next);
  return ok(nonNull(next));
}

/** RequestAdjustmentRequest (@Valid) → 400 VALIDATION_FAILED kèm fieldErrors. */
function requestFieldErrors(body: Record<string, unknown>): MockFieldError[] {
  const errors: MockFieldError[] = [];
  const add = (field: string, message: string, rule: string) =>
    errors.push({ field, message, code: rule });
  const location = readString(body.locationCode);
  if (!location) add("locationCode", "locationCode is required", "NotBlank");
  else if (location.length > INVENTORY_LIMITS.locationLength)
    add("locationCode", "locationCode is at most 64 characters", "Size");
  const sku = readString(body.sku);
  if (!sku) add("sku", "sku is required", "NotBlank");
  else if (!SKU_INPUT_PATTERN.test(sku)) add("sku", "malformed SKU", "Pattern");
  if (typeof body.lotNumber === "string" && body.lotNumber.length > INVENTORY_LIMITS.lotLength)
    add("lotNumber", "lotNumber is at most 64 characters", "Size");
  const delta = body.quantityDelta;
  if (typeof delta === "number" && delta < -INVENTORY_LIMITS.delta)
    add("quantityDelta", "quantityDelta is at least -1,000,000", "Min");
  if (typeof delta === "number" && delta > INVENTORY_LIMITS.delta)
    add("quantityDelta", "quantityDelta is at most 1,000,000", "Max");
  if (body.reason === undefined || body.reason === null)
    add("reason", "reason is required", "NotNull");
  if (typeof body.note === "string" && body.note.length > INVENTORY_LIMITS.noteLength)
    add("note", "note is at most 1000 characters", "Size");
  return errors;
}

async function createAdjustment(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const body = parseJsonBody(config.data);
  const reason = body.reason;
  // Jackson: giá trị enum lạ / kiểu sai → body không đọc được.
  if (
    (reason !== undefined &&
      reason !== null &&
      !STOCK_ADJUSTMENT_REASONS.some((r) => r === reason)) ||
    (body.quantityDelta !== undefined && !Number.isInteger(body.quantityDelta))
  ) {
    return beError(400, "MALFORMED_REQUEST", "The request body could not be read");
  }
  const fieldErrors = requestFieldErrors(body);
  if (fieldErrors.length) return validationFailed("Invalid request data", fieldErrors);

  const quantityDelta = typeof body.quantityDelta === "number" ? body.quantityDelta : 0;
  const note = readString(body.note) || null;
  // StockAdjustment constructor: thứ tự kiểm tra như BE.
  if (quantityDelta === 0) return validationFailed("Invalid request data");
  if (reason === STOCK_ADJUSTMENT_REASON.OTHER && !note) {
    return validationFailed("An adjustment with reason OTHER must say why in the note");
  }
  if (
    (reason === STOCK_ADJUSTMENT_REASON.SCRAP || reason === STOCK_ADJUSTMENT_REASON.SAMPLE) &&
    quantityDelta > 0
  ) {
    return validationFailed(`An adjustment with reason ${String(reason)} can only reduce stock`);
  }

  const now = new Date();
  seq += 1;
  const adjustment: MockAdjustment = {
    adjustmentId: crypto.randomUUID(),
    number: nextNumber(now),
    locationCode: code(body.locationCode),
    sku: code(body.sku),
    lotNumber: readString(body.lotNumber) || null,
    quantityDelta,
    reason: String(reason),
    note,
    status: STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
    requestedBy: actor,
    requestedAt: now.toISOString(),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    postedAt: null,
    withdrawnAt: null,
    version: 0,
    seq,
  };
  adjustments.set(adjustment.adjustmentId, adjustment);
  return ok(nonNull(adjustment), 201);
}

function selfDecision(adjustment: MockAdjustment, actor: string) {
  return adjustment.requestedBy === actor
    ? beError(
        409,
        "ADJUSTMENT_SELF_APPROVAL",
        `Adjustment ${adjustment.number} cannot be decided by the person who requested it`,
      )
    : null;
}

/** BE approve: load → approveAndPost (pending → bốn mắt) → ghi một dòng sổ kho ADJUSTMENT. */
async function approve(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { adjustment } = loaded;
  const refused = requirePending(adjustment) ?? selfDecision(adjustment, actor);
  if (refused) return refused;
  const now = new Date().toISOString();
  const delta = adjustment.quantityDelta;
  seq += 1;
  movements.push({
    movementId: crypto.randomUUID(),
    type: "ADJUSTMENT",
    sku: adjustment.sku,
    lotNumber: adjustment.lotNumber,
    fromLocation: delta < 0 ? adjustment.locationCode : null,
    toLocation: delta > 0 ? adjustment.locationCode : null,
    quantity: Math.abs(delta),
    referenceType: "STOCK_ADJUSTMENT",
    referenceId: adjustment.adjustmentId,
    reason: adjustment.reason + (adjustment.note === null ? "" : `: ${adjustment.note}`),
    actorId: actor,
    occurredAt: now,
    seq,
  });
  return save(adjustment, {
    status: STOCK_ADJUSTMENT_STATUS.POSTED,
    decidedBy: actor,
    decidedAt: now,
    postedAt: now,
  });
}

/** RejectAdjustmentRequest (@Valid) trước, rồi load → pending → bốn mắt. */
async function reject(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const reason = readString(parseJsonBody(config.data).reason);
  if (!reason) {
    return validationFailed("Invalid request data", [
      { field: "reason", message: "reason is required", code: "NotBlank" },
    ]);
  }
  if (reason.length > INVENTORY_LIMITS.rejectionLength) {
    return validationFailed("Invalid request data", [
      { field: "reason", message: "reason is at most 500 characters", code: "Size" },
    ]);
  }
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { adjustment } = loaded;
  const refused = requirePending(adjustment) ?? selfDecision(adjustment, actor);
  if (refused) return refused;
  return save(adjustment, {
    status: STOCK_ADJUSTMENT_STATUS.REJECTED,
    decidedBy: actor,
    decidedAt: new Date().toISOString(),
    rejectionReason: reason,
  });
}

/** StockAdjustment.withdraw: còn chờ duyệt, và chỉ người tạo. Không đụng tồn, không sinh sổ kho. */
async function withdraw(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { adjustment } = loaded;
  const refused = requirePending(adjustment);
  if (refused) return refused;
  if (adjustment.requestedBy !== actor) {
    return beError(
      403,
      "ADJUSTMENT_NOT_REQUESTER",
      `Only the person who requested adjustment ${adjustment.number} can withdraw it`,
    );
  }
  return save(adjustment, {
    status: STOCK_ADJUSTMENT_STATUS.WITHDRAWN,
    withdrawnAt: new Date().toISOString(),
  });
}

/* ── Ledger ──────────────────────────────────────────────────────────── */

/** BE ledger: mới nhất trước; location khớp cả hai phía của dòng. Không có lọc theo ngày. */
function listMovements(config: AxiosRequestConfig) {
  const paging = readPage(config);
  if (paging.error) return paging.error;
  const { params, page, size } = paging;
  const type = readString(params.type);
  if (type && !STOCK_MOVEMENT_TYPES.some((known) => known === type)) {
    return unsupported("type", "must be MovementType");
  }
  const sku = code(params.sku);
  const location = code(params.location);
  const rows = movements
    .filter((row) => !type || row.type === type)
    .filter((row) => !sku || row.sku === sku)
    .filter((row) => !location || row.fromLocation === location || row.toLocation === location)
    .sort((a, b) => b.seq - a.seq);
  return ok(pageOf(rows, page, size));
}

export function registerInventoryMockRoutes(): void {
  const one = `${INVENTORY_API.adjustments}/:id`;
  registerMockRoute("GET", INVENTORY_API.adjustments, listAdjustments);
  registerMockRoute("POST", INVENTORY_API.adjustments, createAdjustment);
  registerMockRoute("GET", one, (config) => {
    const loaded = load(config);
    return loaded.error ?? ok(nonNull(loaded.adjustment));
  });
  registerMockRoute("POST", `${one}/approval`, approve);
  registerMockRoute("POST", `${one}/rejection`, reject);
  registerMockRoute("POST", `${one}/withdrawal`, withdraw);
  registerMockRoute("GET", INVENTORY_API.movements, listMovements);
}
