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
} as const;

export const PUTAWAY_QUERY_KEYS = {
  all: "putaway-tasks",
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
