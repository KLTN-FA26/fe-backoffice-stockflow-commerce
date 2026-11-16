/**
 * Mock routes kiểm kê theo thùng (docs 20 §4.2, §5.2, BR-07..BR-12), chỉ dùng khi USE_MOCK=true.
 *
 * Hợp đồng chép từ BE develop df34c338: CycleCountController (đường dẫn, quyền READ / CREATE / UPDATE / APPROVE),
 * CycleCountCountingService (đếm = quét thùng có mặt / không thấy, thêm thùng ngoài kế hoạch, nộp phiếu sinh
 * COUNT_VARIANCE cho cả thùng), CycleCount (người đếm, vòng đời), CycleCountResponse (kiểm mù: người đếm không thấy
 * `booked`, `adjustments`, `note`, `varianceCount`), ErrorCode (mã + HTTP status).
 *
 * Phiếu chỉ sinh từ `POST /inventory/cycle-counts` (lập phiếu) trên các thùng IN_STOCK của phiếu nhận mock; BE tự mở
 * phiếu SHORT_PICK khi báo thiếu, mock lấy hàng chưa có báo thiếu nên chưa mô phỏng đường đó. Không mô phỏng
 * zone / kệ (chỉ mã vị trí và SKU), giữ hàng cho đơn và khoá ATP.
 */

import { CYCLE_COUNT_API, CYCLE_COUNT_LIMITS, CYCLE_COUNT_STATUS } from "@/constants/cycle-count";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { registerMockRoute } from "./mock-adapter";
import { findMockCarton, listMockCartons } from "./mock-inventory-cartons";
import { MOCK_WAREHOUSE_ID } from "./mock-routes-goods-receipts-store";
import {
  hasPendingMockAdjustment,
  mockActorId,
  mockAdjustmentView,
  openMockCountVariance,
} from "./mock-routes-inventory";
import {
  beError,
  isRecord,
  parseJsonBody,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";
import { mockGrantsOf } from "./mock-user-grants";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";
import type { MockCarton } from "./mock-inventory-cartons";

interface MockLine {
  id: string;
  locationCode: string;
  sku: string;
  lotNumber: string | null;
  stockPackageId: string;
  lpn: string;
  booked: boolean;
  found: boolean | null;
  countedBy: string | null;
  countedAt: string | null;
  recountRequired: boolean;
  adjustmentIds: string[];
}

interface MockCount {
  id: string;
  countNumber: string;
  trigger: string;
  status: string;
  blind: boolean;
  assignedUserId: string | null;
  plannedDate: string;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  createdAt: string;
  lines: MockLine[];
  seq: number;
}

const counts = new Map<string, MockCount>();
let seq = 0;
const PAGE_SIZE_DEFAULT = 20; // BE Pages.DEFAULT_PAGE_SIZE
const PAGE_SIZE_MAX = 200; // BE Pages.MAX_PAGE_SIZE
const OPEN: readonly string[] = [CYCLE_COUNT_STATUS.PLANNED, CYCLE_COUNT_STATUS.IN_PROGRESS];

export function resetCycleCountMockState(): void {
  counts.clear();
  seq = 0;
}

const ok = (data: unknown, status = 200) => ({
  status,
  data: { success: true, data },
  headers: {},
});
const forbidden = () => beError(403, "FORBIDDEN", "Access denied");
const notFound = (message: string) => beError(404, "NOT_FOUND", message);
const unauthenticated = () => beError(401, "UNAUTHORIZED", "Authentication required");
const validation = (field: string, message: string, rule: string) =>
  beError(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message, code: rule }]);
const notOpen = (count: MockCount) =>
  beError(409, "CYCLE_COUNT_NOT_OPEN", `Cycle count ${count.countNumber} is ${count.status}`);

async function caller() {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId;
  if (!userId) return null;
  const grants = mockGrantsOf(userId);
  return { actor: mockActorId(userId), can: (code: PermissionCode) => grants.has(code) };
}
type Caller = NonNullable<Awaited<ReturnType<typeof caller>>>;

function paramOf(config: AxiosRequestConfig, name: string): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return isRecord(params) ? readString(params[name]) : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

/** `CycleCountViewMapper`: sổ sách, điều chỉnh và ghi chú chỉ cho ai có APPROVE khi phiếu kiểm mù (BR-07). */
function view(count: MockCount, decides: boolean) {
  const hide = count.blind && !decides;
  return {
    id: count.id,
    countNumber: count.countNumber,
    warehouseId: MOCK_WAREHOUSE_ID,
    triggerType: count.trigger,
    status: count.status,
    blind: count.blind,
    ...(count.assignedUserId ? { assignedUserId: count.assignedUserId } : {}),
    plannedDate: count.plannedDate,
    ...(count.startedAt ? { startedAt: count.startedAt } : {}),
    ...(count.completedAt ? { completedAt: count.completedAt } : {}),
    ...(count.note && !hide ? { note: count.note } : {}),
    createdAt: count.createdAt,
    lines: count.lines.map((line) => ({
      id: line.id,
      locationCode: line.locationCode,
      sku: line.sku,
      ...(line.lotNumber ? { lotNumber: line.lotNumber } : {}),
      stockPackageId: line.stockPackageId,
      lpn: line.lpn,
      ...(hide ? {} : { booked: line.booked }),
      ...(line.found === null ? {} : { found: line.found }),
      ...(line.countedBy ? { countedBy: line.countedBy, countedAt: line.countedAt } : {}),
      recountRequired: line.recountRequired,
      adjustments: hide ? [] : line.adjustmentIds.flatMap((id) => mockAdjustmentView(id) ?? []),
    })),
  };
}

function summary(count: MockCount, decides: boolean) {
  const { lines: _lines, ...head } = view(count, decides);
  const counted = count.lines.filter((line) => line.found !== null);
  return {
    ...head,
    lineCount: count.lines.length,
    countedCount: counted.length,
    ...(decides
      ? { varianceCount: counted.filter((line) => line.found !== line.booked).length }
      : {}),
  };
}

function load(config: AxiosRequestConfig) {
  const count = counts.get(readRouteId(config).toLowerCase());
  return count ? { count } : { error: notFound("No cycle count") };
}

/** CycleCount.requireCounter: phiếu giao cho người khác thì chỉ ai có APPROVE đếm được. */
function counterRefusal(count: MockCount, me: Caller) {
  return !me.can(CYCLE_COUNT_PERMISSIONS.approve) &&
    count.assignedUserId !== null &&
    count.assignedUserId !== me.actor
    ? beError(403, "CYCLE_COUNT_NOT_ASSIGNEE", "This count is assigned to someone else")
    : null;
}

/** BR-10: một thùng, một phiếu — nằm trên phiếu mở khác, hoặc đang có điều chỉnh chờ duyệt. */
function busyHolder(carton: MockCarton, except?: MockCount): string | null {
  for (const other of counts.values()) {
    if (other === except || !OPEN.includes(other.status)) continue;
    if (other.lines.some((line) => line.stockPackageId === carton.pkg.id)) return other.countNumber;
  }
  return hasPendingMockAdjustment(carton.pkg.id) ? "adjustment" : null;
}

function lineOf(carton: MockCarton, booked: boolean): MockLine {
  return {
    id: crypto.randomUUID(),
    locationCode: carton.pkg.locationCode ?? "",
    sku: carton.sku,
    lotNumber: carton.lotNumber,
    stockPackageId: carton.pkg.id,
    lpn: carton.pkg.lpn,
    booked,
    found: null,
    countedBy: null,
    countedAt: null,
    recountRequired: false,
    adjustmentIds: [],
  };
}

function openCount(input: {
  trigger: string;
  blind: boolean;
  assignedUserId: string | null;
  note: string | null;
  lines: MockLine[];
}): MockCount {
  seq += 1;
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
  const created: MockCount = {
    id: crypto.randomUUID(),
    countNumber: `CC-${day.replaceAll("-", "")}-${String(seq).padStart(4, "0")}`,
    trigger: input.trigger,
    status: CYCLE_COUNT_STATUS.PLANNED,
    blind: input.blind,
    assignedUserId: input.assignedUserId,
    plannedDate: day,
    startedAt: null,
    completedAt: null,
    note: input.note,
    createdAt: now.toISOString(),
    lines: input.lines,
    seq,
  };
  counts.set(created.id, created);
  return created;
}

/** Thùng còn có thể được đếm: trong kho, hoặc thất lạc (đếm có thể tìm thấy lại). */
const countable = (carton: MockCarton) =>
  carton.pkg.status === "IN_STOCK" || carton.pkg.status === "LOST";
/** BR-09: thùng được sổ sách ghi ở đúng vị trí của dòng. */
const bookedAt = (carton: MockCarton | null, location: string) =>
  carton?.pkg.status === "IN_STOCK" && carton.pkg.locationCode === location;

/* ── Plan / list ───────────────────────────────────────────────────── */

async function plan(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  if (!me.can(CYCLE_COUNT_PERMISSIONS.create)) return forbidden();
  const body = parseJsonBody(config.data);
  const scope = isRecord(body.scope) ? body.scope : {};
  const locations = stringList(scope.locationCodes).map((code) => code.toUpperCase());
  const skus = stringList(scope.skus).map((code) => code.toUpperCase());
  if (!locations.length && !skus.length) {
    return beError(400, "VALIDATION_FAILED", "Name at least one zone, shelf, bin or SKU");
  }
  const matches = (await listMockCartons()).filter(
    (carton) =>
      carton.pkg.status === "IN_STOCK" &&
      (!locations.length || locations.includes((carton.pkg.locationCode ?? "").toUpperCase())) &&
      (!skus.length || skus.includes(carton.sku.toUpperCase())),
  );
  const free = matches.filter((carton) => busyHolder(carton) === null);
  if (!free.length)
    return beError(422, "CYCLE_COUNT_EMPTY_SCOPE", "The count scope matches no stock");
  if (free.length > CYCLE_COUNT_LIMITS.maxLines) {
    return beError(422, "CYCLE_COUNT_TOO_LARGE", "The count scope is too large - narrow it");
  }
  const skipped = matches.flatMap((carton) => {
    const holder = busyHolder(carton);
    return holder
      ? [
          {
            locationCode: carton.pkg.locationCode,
            sku: carton.sku,
            lpn: carton.pkg.lpn,
            countNumber: holder,
          },
        ]
      : [];
  });
  const created = openCount({
    trigger: "MANUAL",
    blind: body.blind !== false,
    assignedUserId: readString(body.assignedUserId) || null,
    note: readString(body.note) || null,
    lines: free.map((carton) => lineOf(carton, true)),
  });
  return ok({ count: view(created, me.can(CYCLE_COUNT_PERMISSIONS.approve)), skipped }, 201);
}

async function listCounts(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  const params = isRecord(config.params) ? config.params : {};
  const page = params.page === undefined ? 0 : Number(params.page);
  const size = params.size === undefined ? PAGE_SIZE_DEFAULT : Number(params.size);
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > PAGE_SIZE_MAX
  ) {
    return beError(400, "UNSUPPORTED_PARAMETER", "Unsupported parameter value");
  }
  const status = readString(params.status);
  const rows = [...counts.values()]
    .filter((row) => !status || row.status === status)
    .sort((a, b) => b.seq - a.seq);
  const decides = me.can(CYCLE_COUNT_PERMISSIONS.approve);
  const totalPages = Math.ceil(rows.length / size);
  return ok({
    items: rows.slice(page * size, page * size + size).map((row) => summary(row, decides)),
    page,
    size,
    totalElements: rows.length,
    totalPages,
    hasNext: page + 1 < totalPages,
    hasPrevious: page > 0,
  });
}

/* ── Count / add line / submit ─────────────────────────────────────── */

async function countLine(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  const found = parseJsonBody(config.data).found;
  if (typeof found !== "boolean") return validation("found", "found is required", "NotNull");
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { count } = loaded;
  const refused = counterRefusal(count, me);
  if (refused) return refused;
  if (!OPEN.includes(count.status)) return notOpen(count);
  const line = count.lines.find((row) => row.id === paramOf(config, "lineId"));
  if (!line) return notFound("No such line on this count");
  if (
    count.assignedUserId &&
    count.assignedUserId !== me.actor &&
    line.countedBy &&
    line.countedBy !== me.actor
  ) {
    return beError(403, "CYCLE_COUNT_LINE_COUNTED_BY_OTHER", "Counted by someone else");
  }
  const carton = await findMockCarton(line.lpn);
  if (found && carton && !countable(carton)) {
    return beError(409, "CONFLICT", "The carton cannot be found on the shelf");
  }
  line.booked = bookedAt(carton, line.locationCode);
  line.found = found;
  line.countedBy = me.actor;
  line.countedAt = new Date().toISOString();
  count.status = CYCLE_COUNT_STATUS.IN_PROGRESS;
  count.startedAt ??= line.countedAt;
  return ok(view(count, me.can(CYCLE_COUNT_PERMISSIONS.approve)));
}

async function addLine(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  const body = parseJsonBody(config.data);
  const locationCode = readString(body.locationCode).toUpperCase();
  const lpn = readString(body.lpn).toUpperCase();
  if (!locationCode) return validation("locationCode", "locationCode is required", "NotBlank");
  if (!lpn) return validation("lpn", "lpn is required", "NotBlank");
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { count } = loaded;
  const refused = counterRefusal(count, me);
  if (refused) return refused;
  if (!OPEN.includes(count.status)) return notOpen(count);
  const carton = await findMockCarton(lpn);
  if (!carton) return beError(404, "STOCK_PACKAGE_NOT_FOUND", `No carton with LPN ${lpn}`);
  const holder = busyHolder(carton, count);
  if (holder) return beError(409, "CYCLE_COUNT_SLOT_BUSY", `${lpn} is on count ${holder}`);
  if (!countable(carton)) return beError(409, "CONFLICT", "The carton cannot be counted");
  if ((carton.pkg.locationCode ?? "").toUpperCase() !== locationCode) {
    return beError(422, "STOCK_PACKAGE_WRONG_LOCATION", "The carton is not at this location");
  }
  const decides = me.can(CYCLE_COUNT_PERMISSIONS.approve);
  if (count.lines.some((row) => row.stockPackageId === carton.pkg.id)) {
    return ok(view(count, decides));
  }
  if (count.lines.length >= CYCLE_COUNT_LIMITS.maxLines) {
    return beError(422, "CYCLE_COUNT_TOO_LARGE", "The count scope is too large - narrow it");
  }
  const line = lineOf(carton, carton.pkg.status === "IN_STOCK");
  line.found = true;
  line.countedBy = me.actor;
  line.countedAt = new Date().toISOString();
  count.lines.push(line);
  count.status = CYCLE_COUNT_STATUS.IN_PROGRESS;
  count.startedAt ??= line.countedAt;
  return ok(view(count, decides));
}

async function submit(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { count } = loaded;
  const decides = me.can(CYCLE_COUNT_PERMISSIONS.approve);
  const refused = counterRefusal(count, me);
  if (refused) return refused;
  if (count.status === CYCLE_COUNT_STATUS.COMPLETED) return ok(view(count, decides));
  if (!OPEN.includes(count.status)) return notOpen(count);
  if (count.lines.some((line) => line.found === null)) {
    return beError(409, "CYCLE_COUNT_LINE_NOT_COUNTED", "Some lines are not counted yet");
  }
  const cartons = new Map<string, MockCarton | null>();
  for (const line of count.lines) cartons.set(line.id, await findMockCarton(line.lpn));
  // BR-09: thùng đã đổi chỗ / trạng thái sau khi đếm → đếm lại dòng đó.
  if (
    count.lines.some(
      (line) => bookedAt(cartons.get(line.id) ?? null, line.locationCode) !== line.booked,
    )
  ) {
    return beError(
      409,
      "CYCLE_COUNT_STALE",
      "Stock changed since it was counted - recount the line",
    );
  }
  // BR-08: nộp phiếu không tự ghi tồn — mỗi thùng chênh lệch thành một điều chỉnh COUNT_VARIANCE chờ duyệt.
  for (const line of count.lines) {
    const carton = cartons.get(line.id);
    if (!carton || line.found === line.booked) continue;
    const delta = line.found ? carton.pkg.nominalQty : -carton.pkg.nominalQty;
    line.adjustmentIds.push(
      openMockCountVariance({
        stockPackageId: line.stockPackageId,
        lpn: line.lpn,
        locationCode: line.locationCode,
        sku: line.sku,
        lotNumber: line.lotNumber,
        quantityDelta: delta,
        lineId: line.id,
        requestedBy: me.actor,
        countedBy: line.countedBy,
        note: `Count ${count.countNumber}`,
      }),
    );
  }
  count.status = CYCLE_COUNT_STATUS.COMPLETED;
  count.completedAt = new Date().toISOString();
  return ok(view(count, decides));
}

/* ── Cancel / recount ──────────────────────────────────────────────── */

async function cancel(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  if (!me.can(CYCLE_COUNT_PERMISSIONS.approve)) return forbidden();
  if (!readString(parseJsonBody(config.data).reason)) {
    return validation("reason", "reason is required", "NotBlank");
  }
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  if (!OPEN.includes(loaded.count.status)) return notOpen(loaded.count);
  loaded.count.status = CYCLE_COUNT_STATUS.CANCELLED;
  return ok(view(loaded.count, true));
}

async function recount(config: AxiosRequestConfig) {
  const me = await caller();
  if (!me) return unauthenticated();
  if (!me.can(CYCLE_COUNT_PERMISSIONS.approve)) return forbidden();
  const body = parseJsonBody(config.data);
  const wanted = stringList(body.lineIds);
  if (!wanted.length) return validation("lineIds", "lineIds is required", "NotEmpty");
  const loaded = load(config);
  if (loaded.error) return loaded.error;
  const { count } = loaded;
  const lines = count.lines.filter((line) => wanted.includes(line.id));
  if (lines.length !== wanted.length) return notFound("Not lines of this count");
  if (count.status !== CYCLE_COUNT_STATUS.COMPLETED) return notOpen(count);
  const statusesOf = (line: MockLine) =>
    line.adjustmentIds.map((id) => mockAdjustmentView(id)?.status);
  if (
    lines.some(
      (line) =>
        line.recountRequired || !statusesOf(line).includes(STOCK_ADJUSTMENT_STATUS.REJECTED),
    )
  ) {
    return beError(409, "CONFLICT", "Only a line whose variance was rejected is recounted");
  }
  if (lines.some((line) => statusesOf(line).includes(STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL))) {
    return beError(409, "CONFLICT", "Part of the variance still waits for approval");
  }
  const fresh: MockLine[] = [];
  for (const line of lines) {
    const carton = await findMockCarton(line.lpn);
    if (!carton || !countable(carton)) {
      return beError(
        409,
        "CYCLE_COUNT_STALE",
        "Stock changed since it was counted - recount the line",
      );
    }
    fresh.push(lineOf(carton, carton.pkg.status === "IN_STOCK"));
  }
  lines.forEach((line) => {
    line.recountRequired = true;
  });
  const note = readString(body.note);
  const opened = openCount({
    trigger: count.trigger === "SHORT_PICK" ? "SHORT_PICK" : "MANUAL",
    blind: true, // blind whatever the first count was
    assignedUserId: null,
    note: `Recount of ${count.countNumber}${note ? `: ${note}` : ""}`,
    lines: fresh,
  });
  return ok(view(opened, true), 201);
}

export function registerCycleCountMockRoutes(): void {
  const base = CYCLE_COUNT_API.list;
  registerMockRoute("GET", base, listCounts);
  registerMockRoute("POST", base, plan);
  registerMockRoute("GET", `${base}/:id`, async (config) => {
    const me = await caller();
    if (!me) return unauthenticated();
    const loaded = load(config);
    return loaded.error ?? ok(view(loaded.count, me.can(CYCLE_COUNT_PERMISSIONS.approve)));
  });
  registerMockRoute("PUT", `${base}/:id/lines/:lineId/count`, countLine);
  registerMockRoute("POST", `${base}/:id/lines`, addLine);
  registerMockRoute("POST", `${base}/:id/submission`, submit);
  registerMockRoute("POST", `${base}/:id/cancellation`, cancel);
  registerMockRoute("POST", `${base}/:id/recounts`, recount);
}
