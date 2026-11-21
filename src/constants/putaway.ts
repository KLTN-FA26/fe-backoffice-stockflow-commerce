import { SHARED_QUERY_ROOTS } from "./query-roots";

/**
 * Cất hàng (docs 05). Hợp đồng chép từ BE develop `PutawayController` (`/api/v1/putaway-tasks`) và
 * `PutawayTripController` (`/api/v1/putaway-trips`). Một nhiệm vụ = một thùng LPN, cất nguyên thùng vào một bin
 * (BR-08) — không bao giờ nhập số lượng.
 */
export const PUTAWAY_API = {
  tasks: "/putaway-tasks",
  task: (id: string) => `/putaway-tasks/${encodeURIComponent(id)}`,
  confirmation: (id: string) => `/putaway-tasks/${encodeURIComponent(id)}/confirmations`,
  trips: "/putaway-trips",
  currentTrip: "/putaway-trips/current",
  trip: (id: string) => `/putaway-trips/${encodeURIComponent(id)}`,
  tripCartons: (id: string) => `/putaway-trips/${encodeURIComponent(id)}/cartons`,
  tripCarton: (id: string, lpn: string) =>
    `/putaway-trips/${encodeURIComponent(id)}/cartons/${encodeURIComponent(lpn)}`,
  departure: (id: string) => `/putaway-trips/${encodeURIComponent(id)}/departure`,
  placements: (id: string) => `/putaway-trips/${encodeURIComponent(id)}/placements`,
  reassignment: (id: string, lpn: string) =>
    `/putaway-trips/${encodeURIComponent(id)}/cartons/${encodeURIComponent(lpn)}/reassignment`,
  closure: (id: string) => `/putaway-trips/${encodeURIComponent(id)}/closure`,
  forcedClosure: (id: string) => `/putaway-trips/${encodeURIComponent(id)}/forced-closure`,
} as const;

export const PUTAWAY_QUERY_KEYS = {
  all: "putaway-tasks",
  trips: "putaway-trips",
  // Cất xong ghi tồn khả dụng (docs 05 BR-12) và có thể đóng phiếu nhập (§4.4 bước 9)
  stock: SHARED_QUERY_ROOTS.inventoryStock,
  receipts: "goods-receipts",
} as const;

// BE PutawayStatus; docs 05 §5 (Pending → Done; Cancelled dành sẵn). IN_PROGRESS chỉ còn trên task lẻ cũ.
export const PUTAWAY_TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const PUTAWAY_TASK_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const satisfies Record<string, (typeof PUTAWAY_TASK_STATUSES)[number]>;

// BE PutawayTripStatus; docs 05 §5 (Loading → In Progress → Completed; Loading / In Progress → Closed).
export const PUTAWAY_TRIP_STATUSES = ["LOADING", "IN_PROGRESS", "COMPLETED", "CLOSED"] as const;
export const PUTAWAY_TRIP_STATUS = {
  LOADING: "LOADING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
} as const satisfies Record<string, (typeof PUTAWAY_TRIP_STATUSES)[number]>;

// BE PutawayTripItemStatus — thùng trên xe: còn trên xe / đã cất / trả về hàng chờ (chuyến đóng sớm).
export const PUTAWAY_TRIP_ITEM_STATUSES = ["ON_CART", "PLACED", "RETURNED"] as const;
export const PUTAWAY_TRIP_ITEM_STATUS = {
  ON_CART: "ON_CART",
  PLACED: "PLACED",
  RETURNED: "RETURNED",
} as const satisfies Record<string, (typeof PUTAWAY_TRIP_ITEM_STATUSES)[number]>;

// BE PutawayTask.source; docs 05 BR-01 — chỉ hai nguồn.
export const PUTAWAY_SOURCES = ["RECEIPT", "QUARANTINE_RELEASE"] as const;
export const PUTAWAY_SOURCE = {
  RECEIPT: "RECEIPT",
  QUARANTINE_RELEASE: "QUARANTINE_RELEASE",
} as const satisfies Record<string, (typeof PUTAWAY_SOURCES)[number]>;

// BE PutawaySuggestionResponse.reason; docs 05 §4.3 / BR-05 — nhóm xếp hạng, nhóm đầu tốt nhất.
export const PUTAWAY_SUGGESTION_REASONS = ["SAME_LOT", "EMPTY", "SAME_SKU", "OTHER_SKU"] as const;

export const PUTAWAY_LIMITS = {
  // BE Pages.MAX_PAGE_SIZE — BE không có tìm kiếm / sắp xếp, màn lọc trên trang này
  pageSize: 200,
  // BE PutawayConfirmRequest: lpn @Size(max = 30), locationCode @Size(max = 64)
  lpnMax: 30,
  codeMax: 64,
  // Docs 05 §4.3: tối đa 10 bin gợi ý
  maxSuggestions: 10,
  searchDebounceMs: 300,
} as const;
