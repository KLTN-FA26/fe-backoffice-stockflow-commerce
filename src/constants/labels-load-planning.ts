/**
 * Nhãn tiếng Việt của khung 3D và các bảng xếp hàng lên xe (SCRUM-287/391/392).
 *
 * Thay cho `messages/vi/nesting.json` (next-intl) của dự án gốc: repo này không dùng next-intl,
 * nhãn đi qua `constants/`. `constants/` là tầng thấp nhất — không import gì ngoài chính nó.
 */

import { LOAD_PLANNING_LIMITS } from "./numbers";

import type { PlacementRule } from "./load-planning";

/** Lý do vi phạm luật xếp (BR-10) theo mã luật của solver BE — hiện khi vị trí bị từ chối. */
export const PLACEMENT_RULE_LABELS: Record<PlacementRule, string> = {
  OUT_OF_BOUNDS: "Kiện chìa ra ngoài lòng thùng",
  OVERLAP: "Kiện chồng lên kiện khác",
  UNSUPPORTED: `Đáy kiện được đỡ chưa đủ ${LOAD_PLANNING_LIMITS.minSupportRatio * 100}%`,
  OVERWEIGHT: "Xe vượt tải trọng cho phép",
  ROTATION_NOT_ALLOWED: "Kiện này không được xoay khỏi hướng đặt ban đầu",
  GUSSET: "Kiện vướng khối gia cố ở góc trần thùng",
  DOOR: "Kiện không lọt qua cửa xe",
  KIT_SPLIT: "Các kiện của một bộ phải đi cùng một xe",
  ORIENTATION_MISMATCH: "Kích thước đã xếp không khớp hướng đặt của kiện",
};

export const LOAD_PLANNING_LABELS = {
  unnamed: "(chưa đặt tên)",
  orientationMismatch: "Kích thước đã xếp không khớp kích thước danh định theo hướng đặt",
  viewer: {
    loading: "Đang tải khung 3D…",
    ariaLabel: (vehicleCode: string) => `Mô hình 3D xe ${vehicleCode}`,
    viewGroup: "Góc nhìn",
    views: { iso: "Chéo", top: "Trên", side: "Bên", end: "Cửa" },
    truncated: (shown: number, total: number) => `Khung 3D chỉ dựng ${shown}/${total} kiện.`,
  },
  metrics: {
    vehicles: "Số xe",
    pieces: "Số kiện",
    volume: "Thể tích dùng",
    utilization: "Hiệu suất",
    weight: "Khối lượng",
    unplaced: "Chưa xếp",
  },
  itemTable: {
    title: "Số kiện đã xếp theo xe",
    item: "Kiện",
    loaded: "Đã xếp",
    total: "Tổng",
    vehicleTitle: (seq: number, code: string) => `Xe #${seq} · ${code}`,
    vehicleHeader: (seq: number) => `#${seq}`,
  },
  kitBalance: {
    balanced: "Cân bằng bộ",
    unbalanced: "Bộ bị lệch",
    unbalancedDetail: (vehicleSeq: number, group: string) =>
      `Xe #${vehicleSeq}: bộ ${group} không đủ tỉ lệ`,
    unknownGroupDetail: (vehicleSeq: number, group: string) =>
      `Xe #${vehicleSeq}: bộ ${group} chưa được khai báo`,
  },
} as const;
