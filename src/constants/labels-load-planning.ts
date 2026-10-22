/**
 * Nhãn tiếng Việt của khung 3D và các bảng xếp hàng lên xe (SCRUM-287/391/392).
 *
 * Thay cho `messages/vi/nesting.json` (next-intl) của dự án gốc: repo này không dùng next-intl,
 * nhãn đi qua `constants/`. `constants/` là tầng thấp nhất — không import gì ngoài chính nó.
 */

export const LOAD_PLANNING_LABELS = {
  unnamed: "(chưa đặt tên)",
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
  },
} as const;
