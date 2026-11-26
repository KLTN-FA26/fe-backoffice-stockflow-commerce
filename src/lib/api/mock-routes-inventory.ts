/**
 * Mock routes — điều chỉnh tồn theo thùng + sổ kho (docs 20 §4.3, BR-04, BR-05, BR-06, BR-14), chỉ dùng khi
 * USE_MOCK=true.
 *
 * Hợp đồng chép từ BE develop df34c338: StockOperationsController (đường dẫn, @Valid),
 * RequestAdjustmentRequest (LPN + chiều WRITE_OFF / RESTOCK + lý do, không có số lượng), StockAdjustment (bốn mắt,
 * vòng đời, OTHER phải có giải thích, COUNT_VARIANCE chỉ do kiểm kê tạo và không rút được), ErrorCode (mã + HTTP
 * status). Thùng lấy từ sổ thùng mock (`mock-inventory-cartons.ts`, thùng của phiếu nhận).
 *
 * State nằm trong bộ nhớ module và bắt đầu RỖNG — không thêm bản ghi vào mock-data.ts. Phiếu
 * và dòng sổ kho chỉ sinh ra từ chính các thao tác tạo / duyệt trong phiên mock.
 *
 * Chuyển vị trí (`POST /inventory/movements`, StockOperationsServiceImpl.relocatePackages, BE 0a0226a8): chuyển NGUYÊN
 * THÙNG theo LPN (MoveStockPackagesRequest), cả danh sách hoặc không thùng nào, idempotent theo requestId
 * (IDEMPOTENCY_KEY_REUSED khi cùng id khác thùng / đích). Kiểm thùng tồn tại, In Stock, khác đích, cùng kho, không
 * phải khu tập kết, không trong phiếu kiểm kê mở, luật cách ly; mỗi thùng ghi một dòng sổ MOVE.
 *
 * Không mô phỏng: STOCK_PACKAGE_HELD (mock thùng không có khoản giữ), CARTON_DOES_NOT_FIT_BIN (mock không có kích
 * thước bin / thùng), LOCATION_NOT_FOUND / LOCATION_NOT_USABLE của đích, OUT_OF_DATA_SCOPE và `status`/`toStatus`
 * của dòng sổ kho (BE lấy từ trạng thái thật của stock item).
 */

import {
  INVENTORY_API,
  INVENTORY_LIMITS,
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_REASON,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_ADJUSTMENT_REQUEST_REASONS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS, STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";

import { MOVE_API, MOVE_LIMITS } from "@/constants/move";

import { registerMockRoute } from "./mock-adapter";
import {
  isMockCartonUnderCount,
  registerCycleCountMockRoutes,
  resetCycleCountMockState,
} from "./mock-routes-cycle-counts";
import {
  findMockCarton,
  isMockQuarantined,
  mockWarehouseCodeOf,
  resetMockCartonLedger,
  setMockCartonStatus,
  setMockQuarantined,
} from "./mock-inventory-cartons";
import { registerMoveSuggestionMockRoutes } from "./mock-routes-move-suggestions";
import { registerQuarantineMockRoutes } from "./mock-routes-quarantine";
import { registerInventoryStockMockRoutes } from "./mock-routes-inventory-stock";
import { MOCK_AREAS } from "./mock-routes-goods-receipts-store";
import { isMockStagingArea } from "./mock-routes-warehouse-layout";
import {
  beError,
  parseJsonBody,
  readParams,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { MockCarton } from "./mock-inventory-cartons";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

interface MockAdjustment {
  adjustmentId: string;
  number: string;
  locationCode: string;
  sku: string;
  lotNumber: string | null;
  /** ADR-0011 (BE, issue #305): cả thùng — WRITE_OFF / RESTOCK; số đơn vị là `nominalQty` của thùng. */
  direction: "WRITE_OFF" | "RESTOCK";
  nominalQty: number;
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
  /** Id của thùng (`StockPackage.id`) và LPN của nó — phiếu nào cũng đúng một thùng (docs 20 BR-14). */
  stockPackageId: string;
  cartonLpn: string;
  /** Có khi phiếu do kiểm kê sinh ra; `countedBy` là người đã đếm dòng đó — cũng không được tự duyệt. */
  cycleCountLineId: string | null;
  countedBy: string | null;
  seq: number;
}

interface MockMovement {
  movementId: string;
  type: string;
  sku: string;
  lotNumber: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  /** ADR-0011 (BE, issue #305): một `lpn` thay cho `fromLpn` / `toLpn`. */
  lpn: string | null;
  quantity: number;
  referenceType: string;
  referenceId: string;
  reason: string | null;
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
  servedMoves.clear();
  numberByDay.clear();
  seq = 0;
  resetMockCartonLedger();
  resetCycleCountMockState();
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
    Object.entries(value).filter(
      ([key, field]) =>
        field !== null && key !== "seq" && key !== "cartonLpn" && key !== "countedBy",
    ),
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
  const lpn = readString(body.lpn);
  if (!lpn) add("lpn", "lpn is required", "NotBlank");
  else if (lpn.length > INVENTORY_LIMITS.lpnLength)
    add("lpn", "lpn is at most 30 characters", "Size");
  if (body.direction === undefined || body.direction === null)
    add("direction", "direction is required", "NotNull");
  if (body.reason === undefined || body.reason === null)
    add("reason", "reason is required", "NotNull");
  if (typeof body.note === "string" && body.note.length > INVENTORY_LIMITS.noteLength)
    add("note", "note is at most 1000 characters", "Size");
  return errors;
}

const STOCK_ADJUSTMENT_ALL_REASONS: readonly string[] = STOCK_ADJUSTMENT_REASONS;
const REQUESTABLE_REASONS: readonly string[] = STOCK_ADJUSTMENT_REQUEST_REASONS;
const DIRECTIONS: readonly string[] = STOCK_ADJUSTMENT_DIRECTIONS;

/** Phiếu nào đang giữ thùng: chờ duyệt (BR-10, BR-11). Dùng cho điều chỉnh tay và cho kiểm kê. */
export function hasPendingMockAdjustment(stockPackageId: string): boolean {
  return [...adjustments.values()].some(
    (row) =>
      row.stockPackageId === stockPackageId &&
      row.status === STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
  );
}

/**
 * Phiếu COUNT_VARIANCE do nộp phiếu kiểm kê sinh ra (docs 20 §4.2 c8): cả thùng, chờ duyệt. Người đề nghị là
 * người nộp; `countedBy` là người đếm dòng — BE cấm cả hai tự duyệt (`ADJUSTMENT_SELF_APPROVAL`).
 */
export function openMockCountVariance(input: {
  stockPackageId: string;
  lpn: string;
  locationCode: string;
  sku: string;
  lotNumber: string | null;
  direction: MockAdjustment["direction"];
  nominalQty: number;
  lineId: string;
  requestedBy: string;
  countedBy: string | null;
  note: string;
}) {
  const now = new Date();
  seq += 1;
  const adjustment: MockAdjustment = {
    adjustmentId: crypto.randomUUID(),
    number: nextNumber(now),
    locationCode: input.locationCode,
    sku: input.sku,
    lotNumber: input.lotNumber,
    direction: input.direction,
    nominalQty: input.nominalQty,
    reason: STOCK_ADJUSTMENT_REASON.COUNT_VARIANCE,
    note: input.note,
    status: STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL,
    requestedBy: input.requestedBy,
    requestedAt: now.toISOString(),
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    postedAt: null,
    withdrawnAt: null,
    version: 0,
    stockPackageId: input.stockPackageId,
    cartonLpn: input.lpn,
    cycleCountLineId: input.lineId,
    countedBy: input.countedBy,
    seq,
  };
  adjustments.set(adjustment.adjustmentId, adjustment);
  return adjustment.adjustmentId;
}

/** `CycleCountResponse.Adjustment` của một phiếu — kiểm kê đọc số, chênh lệch và trạng thái hiện tại. */
export function mockAdjustmentView(adjustmentId: string) {
  const row = adjustments.get(adjustmentId);
  return row
    ? {
        id: row.adjustmentId,
        number: row.number,
        direction: row.direction,
        status: row.status,
      }
    : null;
}

async function createAdjustment(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const body = parseJsonBody(config.data);
  // Jackson: enum lạ / kiểu sai → body không đọc được.
  if (
    (body.reason !== undefined &&
      body.reason !== null &&
      !STOCK_ADJUSTMENT_ALL_REASONS.some((reason) => reason === body.reason)) ||
    (body.direction !== undefined &&
      body.direction !== null &&
      !DIRECTIONS.some((direction) => direction === body.direction))
  ) {
    return beError(400, "MALFORMED_REQUEST", "The request body could not be read");
  }
  const fieldErrors = requestFieldErrors(body);
  if (fieldErrors.length) return validationFailed("Invalid request data", fieldErrors);

  const reason = String(body.reason);
  const note = readString(body.note) || null;
  // COUNT_VARIANCE chỉ do kiểm kê tạo; EXPIRED / SCRAP / SAMPLE / SUBCONTRACT_LOSS là lý do cũ → 400.
  if (!REQUESTABLE_REASONS.includes(reason)) {
    return validationFailed(`Reason ${reason} cannot be requested for a carton`);
  }
  if (reason === STOCK_ADJUSTMENT_REASON.OTHER && !note) {
    return validationFailed("An adjustment with reason OTHER must say why in the note");
  }
  const carton = await findMockCarton(readString(body.lpn));
  if (!carton) {
    return beError(404, "STOCK_PACKAGE_NOT_FOUND", `No carton with LPN ${readString(body.lpn)}`);
  }
  const writeOff = body.direction === "WRITE_OFF";
  // Thùng ghi giảm phải đang trong kho; nạp lại chỉ thùng đã thất lạc.
  if (carton.pkg.status !== (writeOff ? "IN_STOCK" : "LOST")) {
    return beError(
      409,
      "INVALID_STOCK_PACKAGE_TRANSITION",
      "This stock package cannot do that in its current status",
    );
  }
  if (hasPendingMockAdjustment(carton.pkg.id)) {
    return beError(
      409,
      "STOCK_PACKAGE_ADJUSTMENT_PENDING",
      "Another adjustment of this carton is waiting for approval",
    );
  }
  const now = new Date();
  seq += 1;
  const adjustment: MockAdjustment = {
    adjustmentId: crypto.randomUUID(),
    number: nextNumber(now),
    locationCode: carton.pkg.locationCode ?? "",
    sku: carton.sku,
    lotNumber: carton.lotNumber,
    direction: writeOff ? "WRITE_OFF" : "RESTOCK",
    nominalQty: carton.pkg.nominalQty,
    reason,
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
    stockPackageId: carton.pkg.id,
    cartonLpn: carton.pkg.lpn,
    cycleCountLineId: null,
    countedBy: null,
    seq,
  };
  adjustments.set(adjustment.adjustmentId, adjustment);
  return ok(nonNull(adjustment), 201);
}

/** Bốn mắt (docs 20 BR-05): người đề nghị không duyệt; với COUNT_VARIANCE, người đã đếm dòng cũng không. */
function selfDecision(adjustment: MockAdjustment, actor: string) {
  return adjustment.requestedBy === actor || adjustment.countedBy === actor
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
  const restock = adjustment.direction === "RESTOCK";
  // Duyệt là ghi tồn ngay (BR-05): thùng ghi giảm → Consumed (kiểm kê không thấy → Lost); nạp lại → In Stock.
  const carton = await findMockCarton(adjustment.cartonLpn);
  if (carton) {
    setMockCartonStatus(
      carton,
      restock
        ? "IN_STOCK"
        : adjustment.reason === STOCK_ADJUSTMENT_REASON.COUNT_VARIANCE
          ? "LOST"
          : "CONSUMED",
    );
    setMockQuarantined(adjustment.cartonLpn, false);
  }
  seq += 1;
  movements.push({
    movementId: crypto.randomUUID(),
    type: "ADJUSTMENT",
    sku: adjustment.sku,
    lotNumber: adjustment.lotNumber,
    fromLocation: restock ? null : adjustment.locationCode,
    toLocation: restock ? adjustment.locationCode : null,
    lpn: adjustment.cartonLpn,
    quantity: adjustment.nominalQty,
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
  // BR-06 (docs 20): chênh lệch kiểm kê chỉ được duyệt hoặc từ chối.
  if (adjustment.reason === STOCK_ADJUSTMENT_REASON.COUNT_VARIANCE) {
    return beError(
      409,
      "COUNT_VARIANCE_NOT_WITHDRAWABLE",
      "A count variance is approved or rejected, not withdrawn",
    );
  }
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

/* ── Move (POST /inventory/movements) ────────────────────────────────── */

const MOVE_REFERENCE_TYPE = "MOVE_TASK"; // StockOperationsController: MoveReference.MOVE_TASK

/** Lệnh đã phục vụ theo requestId: tập LPN + đích (BE so khi gửi lại, IDEMPOTENCY_KEY_REUSED nếu khác). */
const servedMoves = new Map<string, { lpns: string[]; to: string }>();

/** MoveStockPackagesRequest (@Valid) → 400 VALIDATION_FAILED kèm fieldErrors. */
function moveFieldErrors(body: Record<string, unknown>): MockFieldError[] {
  const errors: MockFieldError[] = [];
  const add = (field: string, message: string, rule: string) =>
    errors.push({ field, message, code: rule });
  if (body.requestId === undefined || body.requestId === null)
    add("requestId", "requestId is required", "NotNull");
  const lpns = Array.isArray(body.lpns) ? body.lpns : [];
  if (lpns.length === 0) add("lpns", "lpns needs at least one carton", "NotEmpty");
  if (lpns.length > MOVE_LIMITS.lpnsMax) add("lpns", "lpns holds at most 500 cartons", "Size");
  lpns.forEach((lpn, index) => {
    const value = readString(lpn);
    if (!value) add(`lpns[${index}]`, "an LPN is not blank", "NotBlank");
    else if (value.length > MOVE_LIMITS.lpnLength)
      add(`lpns[${index}]`, "an LPN is at most 30 characters", "Size");
  });
  const to = readString(body.toLocation);
  if (!to) add("toLocation", "toLocation is required", "NotBlank");
  else if (to.length > MOVE_LIMITS.locationLength)
    add("toLocation", "toLocation is at most 64 characters", "Size");
  return errors;
}

/** BE `MovedStockPackageResponse`. */
function movedOf(carton: MockCarton) {
  return {
    lpn: carton.pkg.lpn,
    sku: carton.sku,
    unitOfMeasure: "CARTON",
    quantity: carton.pkg.quantity,
    locationCode: carton.pkg.locationCode ?? "",
    status: carton.pkg.status,
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * StockOperationsServiceImpl.relocatePackages (MOVE_TASK): thứ tự kiểm như BE — tồn tại → gửi lại → trạng thái + hai
 * vị trí → kiểm kê → giữ cho đơn → cách ly; mọi thùng qua hết rồi mới chuyển (cả danh sách hoặc không thùng nào).
 */
async function moveCartons(cartons: MockCarton[], to: string) {
  for (const { pkg } of cartons) {
    // Docs 11 BR-04: chỉ thùng In Stock.
    if (pkg.status !== "IN_STOCK")
      return beError(409, "INVALID_STOCK_PACKAGE_TRANSITION", `${pkg.lpn} is ${pkg.status}`);
    const from = (pkg.locationCode ?? "").toUpperCase();
    if (from === to) return validationFailed("A move needs two different locations");
    // Docs 11 BR-01.
    if (mockWarehouseCodeOf(from) !== mockWarehouseCodeOf(to))
      return beError(
        409,
        "MOVE_ACROSS_WAREHOUSES",
        `${from} and ${to} are in different warehouses`,
      );
    // Docs 11 BR-09: khu tập kết chỉ vào bằng lấy hàng, ra bằng xuất / trả lại.
    for (const end of [from, to]) {
      if (await isMockStagingArea(end))
        return beError(409, "STAGING_MOVE_NOT_ALLOWED", `${end} is a staging area`, [], {
          locationCode: end,
        });
    }
  }
  // Docs 11 BR-06.
  if (cartons.some(({ pkg }) => isMockCartonUnderCount(pkg.id)))
    return beError(409, "STOCK_SLOT_UNDER_COUNT", "This stock slot is under a cycle count");
  // Docs 20 BR-21: hàng cách ly rời khu bằng gỡ cách ly; hàng đang bán vào khu cách ly bằng cách ly.
  const intoQuarantine = MOCK_AREAS[to] === "QUARANTINE";
  for (const { pkg } of cartons) {
    if (intoQuarantine && !isMockQuarantined(pkg.lpn))
      return beError(409, "LOCATION_AREA_MISMATCH", `${pkg.lpn} is on sale`, [], { lpn: pkg.lpn });
    if (!intoQuarantine && isMockQuarantined(pkg.lpn))
      return beError(409, "STOCK_PACKAGE_QUARANTINED", `${pkg.lpn} is in quarantine`, [], {
        lpn: pkg.lpn,
      });
  }
  return null;
}

async function createMove(config: AxiosRequestConfig) {
  const actor = await currentActor();
  if (!actor) return unauthenticated();
  const body = parseJsonBody(config.data);
  // Jackson: requestId không phải UUID / lpns không phải mảng chuỗi → body không đọc được.
  if (
    (typeof body.requestId === "string" && !UUID_PATTERN.test(body.requestId)) ||
    (body.requestId !== undefined &&
      body.requestId !== null &&
      typeof body.requestId !== "string") ||
    (body.lpns !== undefined &&
      (!Array.isArray(body.lpns) || body.lpns.some((lpn) => typeof lpn !== "string")))
  ) {
    return beError(400, "MALFORMED_REQUEST", "The request body could not be read");
  }
  const fieldErrors = moveFieldErrors(body);
  if (fieldErrors.length) return validationFailed("Invalid request data", fieldErrors);

  const requestId = String(body.requestId).toLowerCase();
  const to = code(body.toLocation);
  const asked = Array.isArray(body.lpns)
    ? body.lpns.map((lpn) => readString(lpn).toUpperCase())
    : [];
  const cartons: MockCarton[] = [];
  for (const lpn of new Set(asked)) {
    const carton = await findMockCarton(lpn);
    if (!carton) return beError(404, "STOCK_PACKAGE_NOT_FOUND", `No stock package ${lpn}`);
    cartons.push(carton);
  }
  const lpns = cartons.map(({ pkg }) => pkg.lpn.toUpperCase());
  // Gửi lại trước: lệnh đã chuyển không chuyển lần nữa; cùng id mà khác thùng / khác đích → 422.
  const served = servedMoves.get(requestId);
  if (served) {
    if (!sameSet(served.lpns, lpns) || served.to !== to)
      return beError(
        422,
        "IDEMPOTENCY_KEY_REUSED",
        "This idempotency key was already used for a different request",
      );
    return ok(cartons.map(movedOf), 201);
  }
  const refused = await moveCartons(cartons, to);
  if (refused) return refused;
  const now = new Date().toISOString();
  for (const carton of cartons) {
    seq += 1;
    movements.push({
      movementId: crypto.randomUUID(),
      type: "MOVE",
      sku: carton.sku,
      lotNumber: carton.lotNumber,
      fromLocation: carton.pkg.locationCode,
      toLocation: to,
      lpn: carton.pkg.lpn,
      quantity: carton.pkg.quantity,
      referenceType: MOVE_REFERENCE_TYPE,
      referenceId: requestId,
      reason: null,
      actorId: actor,
      occurredAt: now,
      seq,
    });
    carton.pkg.locationCode = to;
  }
  servedMoves.set(requestId, { lpns, to });
  return ok(cartons.map(movedOf), 201);
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
  registerInventoryStockMockRoutes();
  registerCycleCountMockRoutes();
  // Trước `GET /inventory/stock-packages/:lpn` của cách ly — adapter lấy route khớp đầu tiên.
  registerMoveSuggestionMockRoutes();
  registerQuarantineMockRoutes();
  registerMockRoute("POST", MOVE_API.move, createMove);
  // `GET /inventory/stock-items?sku=` (mọi kho): mock không có tồn theo vị trí → danh sách rỗng. Màn Di chuyển giờ tra
  // thùng theo LPN (`/inventory/stock-packages`, registerQuarantineMockRoutes).
  registerMockRoute("GET", "/inventory/stock-items", () => ok([]));
}
