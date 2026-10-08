export const INVENTORY_COPY = {
  title: "Tổng quan tồn kho",
  subtitle: "Dữ liệu minh họa · Chưa kết nối hệ thống tồn kho",
  empty: "Chưa có dữ liệu mẫu",
  error: "Không tải được dữ liệu minh họa",
  retry: "Thử lại",
  sections: [
    { id: "stock-levels", title: "Stock Levels" },
    { id: "stock-items", title: "Stock Items" },
    { id: "atp", title: "ATP Lookup" },
    { id: "reservations", title: "Reservations" },
  ],
  noLot: "Chưa có số lô",
  noExpiry: "Chưa có hạn dùng",
} as const;
