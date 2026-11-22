/**
 * Kho xuất của đơn — Sale chọn kho và giữ hàng (BE `ShippingWarehouseController`, docs 17 §4.2 bước 2-3, BR-21, BR-22,
 * BR-25): mỗi đơn có đúng một kho xuất; chọn xong hệ thống giữ ở kho đó nguyên thùng, phần có sẵn, không hạn; phần thiếu
 * được giữ tiếp khi hàng nhập kho. Chọn kho thiếu chỗ cho phần phải sản xuất chỉ bị cảnh báo, không bị chặn.
 */

/** Kết quả giữ hàng sau khi chọn kho: đủ / một phần / chưa giữ được thùng nào. */
export const ORDER_SHIPPING_WAREHOUSE_OUTCOMES = ["full", "partial", "none"] as const;

export const ORDER_SHIPPING_WAREHOUSE_LABELS = {
  card: {
    title: "Kho xuất",
    none: "Chưa chọn kho xuất",
    noneHint:
      "Chọn kho xuất để giữ hàng cho đơn. Quản lý kho chỉ release được khi đơn đã giữ đủ thùng ở kho xuất.",
    chosen: (warehouse: string) => `Kho xuất: ${warehouse}`,
    chosenUnknown: "đã chọn",
    loading: "Đang tải tình trạng giữ hàng…",
    failed: "Không tải được tình trạng giữ hàng của đơn.",
    /** Đã có hàng giữ ở kho xuất → không đổi sang kho khác (docs 17 §4.2 bước 2, BR-22). */
    locked: "Đã giữ hàng ở kho này nên không đổi sang kho khác được.",
    choose: "Chọn kho xuất",
    change: "Đổi kho xuất",
  },
  coverage: {
    full: "Đã giữ đủ hàng — quản lý kho có thể release đơn.",
    partial: (held: number, total: number) =>
      `Đã giữ ${held}/${total} thùng. Phần còn thiếu sẽ được giữ tiếp khi hàng nhập kho.`,
    nothing: "Chưa giữ được thùng nào. Hàng sẽ được giữ khi nhập kho; phần thiếu cần Đơn sản xuất.",
    lines: "Theo dòng hàng",
    batches: "Theo đợt giao",
    lineHeld: (held: number, total: number) => `${held}/${total} thùng`,
    batchTitle: (seq: number) => `Đợt ${seq}`,
    batchFull: "đủ hàng",
    batchShort: (missing: number) => `thiếu ${missing} thùng`,
  },
  dialog: {
    title: "Chọn kho xuất",
    description: (orderNumber: string) =>
      `Chọn kho xuất hàng của đơn ${orderNumber}. Hệ thống giữ ở kho này nguyên thùng, phần đang có sẵn; phần thiếu được giữ tiếp khi hàng nhập kho. Kho đầu danh sách là kho hệ thống gợi ý.`,
    loading: "Đang tải danh sách kho…",
    failed: "Không tải được danh sách kho.",
    empty: "Chưa có kho nào đang hoạt động.",
    groupLabel: "Kho xuất hàng",
    submit: "Chọn kho và giữ hàng",
    failedTitle: "Không chọn được kho xuất",
    recommended: "Gợi ý",
    current: "Đang chọn",
    holdsEveryLine: "Đủ hàng",
    available: (cartons: number, total: number) => `Có sẵn ${cartons}/${total} thùng`,
    lineAvailable: (sku: string, available: number, cartons: number) =>
      `${sku}: ${available}/${cartons} thùng`,
    projectedFree: "Còn trống dự kiến",
    pending: "Chờ duyệt",
    freeIfAllApproved: "Còn trống nếu duyệt hết",
    needed: "Cần cho phần phải sản xuất",
    volume: (m3: string) => `${m3} m³`,
    exceedsProjected:
      "Không đủ chỗ cho phần phải sản xuất tại kho này. Đây chỉ là cảnh báo, vẫn chọn được.",
    exceedsIfAllApproved:
      "Nếu các Đơn sản xuất đang chờ duyệt đều được duyệt thì kho này sẽ không đủ chỗ. Đây chỉ là cảnh báo.",
    singleHint: "Kho này được giữ hàng cho đơn ngay khi chọn.",
  },
  /** Câu báo thành công theo kết quả giữ hàng (toast). */
  success: {
    full: "Đã chọn kho xuất và giữ đủ hàng cho đơn",
    partial: (held: number, total: number) =>
      `Đã chọn kho xuất và giữ ${held}/${total} thùng — phần thiếu sẽ được giữ tiếp khi hàng nhập kho`,
    none: "Đã chọn kho xuất — chưa có thùng nào để giữ, hàng sẽ được giữ khi nhập kho",
  },
} as const;
