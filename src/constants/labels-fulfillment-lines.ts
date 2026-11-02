/**
 * Nhãn + câu lỗi của màn lấy hàng theo dòng (SCRUM-267, báo thiếu / phân bổ lại BE PR #147) — tách khỏi
 * `labels.ts` cho gọn. Câu lỗi viết lại từ `messages_vi.properties` của BE, kèm giá trị đúng của dòng để
 * người lấy hàng biết sửa thế nào.
 */

export const PICK_LINE_LABELS = {
  sectionTitle: "Danh sách lấy hàng",
  sectionDescription: "Các dòng theo lộ trình đi lấy hàng. Dòng in theo thiết kế không lấy từ kệ.",
  progress: (picked: number, total: number) => `Đã lấy ${picked}/${total} dòng`,
  // Số thứ tự của dòng (cột "#"), không kèm mẫu số: dòng thiếu đã phân bổ lại vẫn giữ số, tiến độ bỏ dòng đó
  confirmTitle: (sequenceNo: number) => `Xác nhận dòng #${sequenceNo}`,
  target: (location: string, quantity: number, sku: string) =>
    `Đến ${location}, lấy ${quantity} × ${sku}`,
  lot: (lot: string) => `Lô ${lot}`,
  location: "Vị trí",
  item: "Mã hàng",
  quantity: "Số lượng",
  locationPlaceholder: "Chọn vị trí đang đứng",
  codeSearch: "Gõ để tìm mã...",
  noCodeMatch: "Không có mã phù hợp.",
  itemPlaceholder: "Chọn SKU hoặc barcode",
  allocatedHint: (quantity: number) => `Phân bổ: ${quantity} — đếm rồi nhập số đã lấy`,
  submit: "Xác nhận dòng",
  select: "Chọn",
  selectLine: (sequenceNo: number) => `Chọn dòng ${sequenceNo}`,
  done: (sequenceNo: number) => `Đã lấy dòng #${sequenceNo}`,
  allPicked: "Đã lấy đủ mọi dòng — bấm Hoàn tất lấy hàng.",
  notPlanned: "Danh sách dòng sẽ được tạo khi bắt đầu lấy hàng.",
  printOnly: "Đơn chỉ có dòng in theo thiết kế — không có hàng lấy từ kệ.",
  // Task bắt đầu lấy hàng trước khi BE có dòng lấy hàng (SCRUM-267): BE lập dòng khi gọi lại picking-start
  linesNotPlanned:
    "Task chưa có danh sách dòng lấy hàng (bắt đầu trước khi có lấy hàng theo dòng).",
  planLines: "Tạo danh sách dòng",
  planLinesFirst: "Tạo danh sách dòng lấy hàng trước khi hoàn tất.",
  printLines: (count: number) => `${count} dòng in theo thiết kế không lấy từ kệ.`,
  onlyAssignee: "Chỉ người được gán mới xác nhận dòng lấy hàng.",
  awaitingPutBack: (count: number) => `Còn ${count} dòng đã lấy chờ trả về kệ.`,
  locationsUnavailable: "Không tải được sơ đồ vị trí của kho — chỉ hiện vị trí của các dòng.",
  loadError: "Không tải được danh sách dòng lấy hàng.",
  linesUnavailable: "Chưa tải được dòng lấy hàng — bấm Thử lại ở danh sách dòng để hoàn tất.",
  // Báo thiếu hàng (BE `POST …/pick-lines/{lineId}/short`) và phân bổ lại (`…/reallocation`)
  shortAction: "Báo thiếu hàng",
  shortTitle: "Báo thiếu hàng",
  foundQuantity: "Số tìm thấy",
  foundHint: (allocated: number) =>
    `Phân bổ ${allocated} — nhập số thực có ở vị trí (0 đến ${allocated - 1})`,
  shortColumn: "SL thiếu",
  onHoldForShort: (count: number) =>
    `Đơn đang tạm giữ vì ${count} dòng thiếu hàng — chờ điều phối hoặc quản lý kho phân bổ lại.`,
  reallocate: "Phân bổ lại",
  reallocateLine: (sequenceNo: number) => `Phân bổ lại dòng ${sequenceNo}`,
  reallocateConfirm: (sku: string, quantity: number) =>
    `Phân bổ lại ${quantity} × ${sku} sang vị trí khác còn hàng?`,
  openLeft: (count: number) => `Còn ${count} dòng chưa lấy`,
  shortLeft: (count: number) => `Còn ${count} dòng thiếu hàng chờ phân bổ lại`,
  column: {
    sequence: "#",
    location: "Vị trí",
    sku: "SKU",
    barcode: "Barcode",
    lot: "Lô",
    allocated: "SL phân bổ",
    picked: "SL đã lấy",
    status: "Trạng thái",
  },
} as const;

/** Lỗi xác nhận / báo thiếu / phân bổ lại dòng lấy hàng (BE ErrorCode, 409 trừ khi ghi khác). */
export const PICK_LINE_ERROR_MESSAGES = {
  locationMismatch: (expected: string) => `Sai vị trí lấy hàng — dòng này lấy ở ${expected}`,
  itemMismatch: (sku: string) => `Sai mã hàng — dòng này lấy ${sku}`,
  quantityExceeds: (allocated: number) => `Vượt số lượng phân bổ (${allocated})`,
  // BE PICK_QUANTITY_SHORT: lấy ít hơn phân bổ thì phải báo thiếu, không xác nhận dòng
  quantityShort: (allocated: number) =>
    `Phải lấy đủ ${allocated} — không đủ hàng thì bấm "Báo thiếu hàng".`,
  lineNotOpen: "Dòng này đã được lấy, báo thiếu hoặc huỷ ở nơi khác. Danh sách đã được tải lại.",
  taskState:
    "Task không còn ở bước lấy hàng (đơn đã huỷ hoặc task đã hoàn tất). Dữ liệu đã được tải lại.",
  notAssignee: "Task không còn được gán cho bạn. Dữ liệu đã được tải lại.",
  // 404 ở thao tác không xét người được gán (phân bổ lại — BE reallocateShort): task / đơn / dòng không còn
  lineMissing: "Task hoặc dòng lấy hàng không còn tồn tại. Dữ liệu đã được tải lại.",
  reservationNotActive: "Phần giữ hàng của dòng này không còn hiệu lực — báo quản lý kho.",
  productionHold: "Hàng của dòng này đang giữ cho sản xuất, không lấy được.",
  policyConflict: "Tồn hiện tại cần đối soát trước khi lấy — báo quản lý kho.",
  inProgress: "Lần gửi trước đang được xử lý, đợi giây lát rồi thử lại.",
  network: "Không gửi được — kiểm tra mạng rồi bấm Xác nhận lại.",
  // BE INSUFFICIENT_STOCK (409) khi phân bổ lại: không có bin khác đủ hàng, không đổi gì
  insufficientStock: "Không đủ hàng ở vị trí khác để phân bổ lại",
  // BE PickList.reportShort: 0 ≤ số tìm thấy < SL phân bổ (ngoài khoảng → 400 VALIDATION_FAILED)
  shortFoundRange: (max: number) => `Số tìm thấy từ 0 đến ${max}`,
} as const;

/** Màn "Trả hàng về kệ" (BE `GET /fulfillment/put-backs`, SCRUM-275). */
export const PUT_BACK_LABELS = {
  title: "Trả hàng về kệ",
  searchPlaceholder: "Tìm số đơn, SKU hoặc vị trí lấy",
  // Badge thanh "Cấu hình" — tách "Search chính" khỏi bộ lọc (data-table-mode-a §3)
  searchSummary: "Search chính",
  searchUnused: "Chưa dùng",
  action: "Trả về kệ",
  actionFor: (sku: string, orderNumber: string) => `Trả ${sku} của đơn ${orderNumber} về kệ`,
  location: "Vị trí trả",
  locationPlaceholder: "Chọn bin đang hoạt động",
  summary: (qty: number, sku: string, lot: string | null | undefined, orderNumber: string) =>
    `Trả ${qty} × ${sku}${lot ? ` (lô ${lot})` : ""} của đơn ${orderNumber} về kệ.`,
  empty: "Không có hàng chờ trả về kệ",
  emptyDescription: "Hàng đã lấy của các đơn bị huỷ sẽ xuất hiện ở đây.",
  emptyInWarehouse: "Kho này không có hàng chờ trả",
  noMatch: "Không tìm thấy dòng khớp",
  noMatchDescription: "Thử từ khoá khác hoặc bỏ bộ lọc.",
  truncated: (shown: number, total: number) =>
    `Đang hiện ${shown}/${total} dòng cũ nhất — trả bớt rồi tải lại để thấy phần còn lại.`,
  // Không tải được sơ đồ kho (thiếu warehouse-locations:READ / mạng) → vẫn trả về bin đã lấy ra; BE tự kiểm bin
  locationsFallback: "Không tải được sơ đồ kho — chỉ chọn được bin đã lấy ra.",
  openQueue: "Mở hàng đợi trả về kệ",
  // Dòng Put Back trong bảng dòng lấy hàng: BE `putBackQty` / `putBackLocationCode` (có thể khác bin lấy ra)
  returnedTo: (qty: number, locationCode: string) => `Đã trả ${qty} về ${locationCode}`,
  column: {
    order: "Đơn hàng",
    sku: "SKU",
    lot: "Lô",
    pickedQty: "SL đã lấy",
    fromLocation: "Vị trí lấy",
    pickedAt: "Lấy lúc",
    actions: "Thao tác",
  },
} as const;

/** Lỗi `POST …/pick-lines/{lineId}/put-back` và `GET /fulfillment/put-backs`. */
export const PUT_BACK_ERROR_MESSAGES = {
  locationInvalid: "Vị trí trả phải là bin đang hoạt động của kho này",
  notRequired: "Dòng này đã được trả về kệ hoặc không cần trả. Danh sách đã được tải lại.",
  notFound: "Không tìm thấy dòng này nữa. Danh sách đã được tải lại.",
  outOfScope: "Kho này nằm ngoài phạm vi kho bạn phụ trách.",
  network: "Không gửi được — kiểm tra mạng rồi thử lại.",
} as const;
