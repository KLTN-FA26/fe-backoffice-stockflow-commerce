/**
 * In nhãn vị trí (docs 06 §4.3, BR-17 — BE `POST /warehouses/{id}/location-labels`, SCRUM-97) và câu từ chối
 * ngưng vị trí còn thùng (BR-04 — BE `LOCATION_HOLDS_CARTONS`, SCRUM-666). FE SCRUM-667.
 * `UI_LABELS.warehouseMap.print` / `.holdsCartons` trỏ về đây.
 */

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "./numbers";

/** Phạm vi in (docs 06 §4.3 bước 1) — chọn đúng một; BE nhận nhiều nhất một trong shelfId / zoneId / locationCodes. */
export const LOCATION_LABEL_SCOPES = ["WAREHOUSE", "SHELF", "ZONE", "CODES"] as const;
export type LocationLabelScope = (typeof LOCATION_LABEL_SCOPES)[number];

export const LOCATION_LABEL_PRINT_LABELS = {
  open: "In nhãn",
  title: "In nhãn vị trí",
  description:
    "Nhãn mang mã vị trí (chữ, QR, Code 128), in theo thứ tự đi: bin theo kệ → tầng → bin, rồi các khu chứa hàng. Vị trí ngừng dùng được bỏ qua.",
  scope: "In cho",
  scopes: {
    WAREHOUSE: "Cả kho",
    SHELF: "Một kệ",
    ZONE: "Một zone",
    CODES: "Danh sách mã",
  } satisfies Record<LocationLabelScope, string>,
  shelf: "Kệ",
  shelfPlaceholder: "Chọn kệ",
  levels: "Tầng",
  levelsHint: "Không chọn tầng nào = in mọi tầng của kệ.",
  level: (index: number) => `Tầng ${index}`,
  zone: "Zone",
  zonePlaceholder: "Chọn zone",
  zoneHint: "Chỉ bin của các kệ trong zone — khu vực không thuộc zone nào.",
  codes: "Mã vị trí",
  codesPlaceholder: "Mỗi dòng một mã, hoặc cách nhau bằng dấu phẩy — vd HCM-A01-1-A",
  codesHint: `1–${LIMITS.labelsPerPrintMax} mã, không phân biệt hoa thường. Mã trùng chỉ in một nhãn.`,
  count: (count: number) =>
    `Sẽ in ${count.toLocaleString("vi-VN")} nhãn (tối đa ${LIMITS.labelsPerPrintMax.toLocaleString("vi-VN")}).`,
  format: "Khổ nhãn",
  generate: "Tạo file in",
  regenerate: "Tạo lại",
  printNow: "In",
  download: "Tải xuống",
  preview: "Xem trước nhãn vị trí",
  cancel: "Đóng",
  validation: {
    shelfRequired: "Chọn kệ cần in nhãn.",
    zoneRequired: "Chọn zone cần in nhãn.",
    codesRequired: "Nhập ít nhất một mã vị trí.",
    // BR-17 (docs 06 §4.3): ≤ 2.000 nhãn mỗi lần
    tooMany: `Vượt ${LIMITS.labelsPerPrintMax.toLocaleString("vi-VN")} nhãn mỗi lần in (BR-17) — chia nhỏ theo kệ hoặc zone.`,
    empty: "Lựa chọn này không có vị trí đang dùng nào để in nhãn.",
    codesInvalid: (codes: string) => `Mã không hợp lệ (chỉ A–Z, 0–9, "-"): ${codes}`,
    codesUnknown: (codes: string) => `Kho này không có mã: ${codes}`,
    // BR-17 / §4.3 bước 3: nêu đích danh mã ngừng dùng → báo lỗi, không lặng lẽ bỏ qua
    codesInactive: (codes: string) => `Vị trí đã ngừng dùng, không in nhãn: ${codes}`,
  },
} as const;

/** Mã lỗi BE của `POST /warehouses/{id}/location-labels` → câu tiếng Việt (gộp vào `WAREHOUSE_MAP_ERROR_MESSAGES`). */
export const LOCATION_LABEL_ERROR_MESSAGES = {
  LOCATION_LABELS_EMPTY: LOCATION_LABEL_PRINT_LABELS.validation.empty,
  LOCATION_LABELS_TOO_MANY: LOCATION_LABEL_PRINT_LABELS.validation.tooMany,
  LOCATION_INACTIVE: "Có mã vị trí đã ngừng dùng — bỏ mã đó khỏi danh sách (BR-17).",
  LOCATION_NOT_FOUND: "Không tìm thấy vị trí trong kho này — mã nhập sai hoặc bản đồ vừa đổi.",
  SHELF_NOT_FOUND: "Không tìm thấy kệ — bản đồ có thể vừa đổi, tải lại rồi thử lại.",
  SHELF_LEVEL_NOT_FOUND: "Kệ không có tầng đã chọn — bản đồ có thể vừa đổi.",
  ZONE_NOT_FOUND: "Không tìm thấy zone — bản đồ có thể vừa đổi.",
} as const satisfies Record<string, string>;

/** BR-04 (docs 06 §4.1 bước 9) — ngưng (`Inactive`) kệ / bin / khu vực / kho còn thùng bị chặn, kèm thùng còn lại. */
export const WAREHOUSE_HOLDS_CARTONS_LABELS = {
  fallback: "Vị trí vẫn còn thùng — dời hết thùng đi rồi mới ngưng dùng (BR-04).",
  carton: (lpn: string, locationCode: string) => `${lpn} (${locationCode})`,
  message: (total: number, listed: readonly string[]) =>
    `Vị trí còn ${total} thùng nên không ngưng dùng được (BR-04): ${listed.join(", ")}${
      total > listed.length ? ` và ${total - listed.length} thùng khác` : ""
    }. Dời thùng đi (chuyển vị trí nội bộ) rồi ngưng lại.`,
} as const;
