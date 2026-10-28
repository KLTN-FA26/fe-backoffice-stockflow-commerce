/** Shared in-app inbox (BE SCRUM-147, PR #102). */
export const NOTIFICATION_API = {
  inbox: "/notifications/me",
  unreadCount: "/notifications/me/unread-count",
  markRead: (id: string) => `/notifications/me/${encodeURIComponent(id)}/read`,
  markAllRead: "/notifications/me/read-all",
} as const;

export const NOTIFICATION_SEVERITIES = ["INFO", "WARN", "CRITICAL"] as const;

export const NOTIFICATION_CONFIG = {
  pageSize: 10,
  pollingMs: 30_000,
} as const;

export const NOTIFICATION_LABELS = {
  trigger: "Thông báo",
  title: "Thông báo",
  markAllRead: "Đánh dấu tất cả đã đọc",
  unreadOnly: "Chưa đọc",
  all: "Tất cả",
  empty: "Bạn chưa có thông báo nào.",
  emptyUnread: "Bạn đã đọc hết thông báo.",
  loading: "Đang tải thông báo…",
  retry: "Thử lại",
  error: "Không tải được thông báo.",
  updateError: "Không cập nhật được thông báo.",
  previous: "Mới hơn",
  next: "Cũ hơn",
  page: (page: number, total: number) => `Trang ${page}/${total}`,
  unreadBadge: (count: number) => `${count} thông báo chưa đọc`,
  severity: { INFO: "Thông tin", WARN: "Cảnh báo", CRITICAL: "Khẩn cấp" },
} as const;
