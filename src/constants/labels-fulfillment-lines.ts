/**
 * Nhãn + câu lỗi của màn lấy hàng theo dòng (SCRUM-267, báo thiếu / phân bổ lại BE PR #147) — tách khỏi
 * `labels.ts` cho gọn. Câu lỗi viết lại từ `messages_vi.properties` của BE, kèm giá trị đúng của dòng để
 * người lấy hàng biết sửa thế nào.
 */

export const PICK_LINE_LABELS = {
  sectionTitle: "Danh sách lấy hàng",
  sectionDescription:
    "Các dòng theo lộ trình đi lấy hàng, sắp theo mã vị trí rồi SKU. Mỗi dòng là một thùng (LPN) lấy nguyên.",
  progress: (picked: number, total: number) => `Đã lấy ${picked}/${total} dòng`,
  // Số thứ tự của dòng (cột "#"), không kèm mẫu số: dòng thiếu đã phân bổ lại vẫn giữ số, tiến độ bỏ dòng đó
  confirmTitle: (sequenceNo: number) => `Xác nhận dòng #${sequenceNo}`,
  /** Người lấy hàng cần biết: đi đâu, lấy thùng nào (docs 07 §4.2 bước 5: quét vị trí → quét LPN của thùng). */
  target: (location: string, lpn: string | null | undefined, sku: string, quantity: number) =>
    lpn
      ? `Đến ${location}, lấy thùng ${lpn} — ${quantity} × ${sku}`
      : `Đến ${location}, lấy ${quantity} × ${sku}`,
  targetLocation: "Vị trí cần đến",
  targetLpn: "Thùng cần lấy (LPN)",
  /** Dòng cũ từ trước khi có thùng: BE không xác nhận được (PICK_LINE_NOT_OPEN) — báo quản lý kho phân bổ lại. */
  noLpn: "Dòng này chưa có mã thùng (LPN) — báo quản lý kho phân bổ lại.",
  lot: (lot: string) => `Lô ${lot}`,
  location: "Vị trí",
  lpn: "Mã thùng (LPN)",
  locationPlaceholder: "Chọn vị trí đang đứng",
  codeSearch: "Gõ để tìm mã...",
  noCodeMatch: "Không có mã phù hợp.",
  lpnPlaceholder: "Quét hoặc nhập mã LPN của thùng",
  lpnHint: "Chỉ đúng LPN của dòng này mới xác nhận được — SKU hay mã vạch không được.",
  submit: "Xác nhận dòng",
  select: "Chọn",
  selectLine: (sequenceNo: number) => `Chọn dòng ${sequenceNo}`,
  done: (sequenceNo: number) => `Đã lấy dòng #${sequenceNo}`,
  allPicked: "Đã lấy đủ mọi dòng — bấm Hoàn tất lấy hàng.",
  notPlanned: "Danh sách dòng sẽ được tạo khi bắt đầu lấy hàng.",
  noLines: "Task chưa có dòng lấy hàng nào.",
  // Task bắt đầu lấy hàng trước khi BE có dòng lấy hàng (SCRUM-267): BE lập dòng khi gọi lại picking-start
  linesNotPlanned:
    "Task chưa có danh sách dòng lấy hàng (bắt đầu trước khi có lấy hàng theo dòng).",
  planLines: "Tạo danh sách dòng",
  planLinesFirst: "Tạo danh sách dòng lấy hàng trước khi hoàn tất.",
  onlyAssignee: "Chỉ người được gán mới xác nhận dòng lấy hàng.",
  awaitingPutBack: (count: number) => `Còn ${count} dòng đã lấy chờ trả về kệ.`,
  locationsUnavailable: "Không tải được sơ đồ vị trí của kho — chỉ hiện vị trí của các dòng.",
  loadError: "Không tải được danh sách dòng lấy hàng.",
  linesUnavailable: "Chưa tải được dòng lấy hàng — bấm Thử lại ở danh sách dòng để hoàn tất.",
  // Báo thiếu thùng (BE `POST …/pick-lines/{lineId}/short`, docs 07 §4.4 bước 9) và phân bổ lại (`…/reallocation`)
  shortAction: "Báo thiếu thùng",
  shortTitle: "Báo thiếu thùng",
  shortReason: "Lý do",
  shortReasonPlaceholder: "Chọn lý do",
  shortReasons: {
    NOT_FOUND: "Không thấy thùng ở vị trí",
    DAMAGED: "Thùng hư hỏng, không giao được",
  },
  shortHint: "Cả thùng được báo thiếu; đơn sẽ tạm giữ cho tới khi quản lý kho phân bổ lại.",
  shortColumn: "SL thiếu",
  onHoldForShort: (count: number) =>
    `Đơn đang tạm giữ vì ${count} dòng thiếu thùng — chờ quản lý kho phân bổ lại.`,
  reallocate: "Phân bổ lại",
  reallocateLine: (sequenceNo: number) => `Phân bổ lại dòng ${sequenceNo}`,
  reallocateConfirm: (sku: string, lpn: string | null | undefined) =>
    `Phân bổ lại ${sku}${lpn ? ` (thùng ${lpn})` : ""} sang thùng khác còn hàng ở kho?`,
  openLeft: (count: number) => `Còn ${count} dòng chưa lấy`,
  shortLeft: (count: number) => `Còn ${count} dòng thiếu thùng chờ phân bổ lại`,
  /** Dòng STAGED: thùng đã nằm ở khu chờ xuất của task, chưa trừ tồn (docs 07 §4.2 bước 5). */
  stagedAt: (locationCode: string) => `Tại khu chờ xuất ${locationCode}`,
  column: {
    sequence: "#",
    location: "Vị trí",
    lpn: "LPN",
    sku: "SKU",
    lot: "Lô",
    allocated: "SL/thùng",
    picked: "SL đã lấy",
    status: "Trạng thái",
  },
} as const;

/** Lỗi xác nhận / báo thiếu / phân bổ lại dòng lấy hàng (BE ErrorCode, 409 trừ khi ghi khác). */
export const PICK_LINE_ERROR_MESSAGES = {
  locationMismatch: (expected: string) => `Sai vị trí lấy hàng — dòng này lấy ở ${expected}`,
  itemMismatch: (lpn: string | null | undefined) =>
    lpn ? `Sai thùng — dòng này lấy thùng ${lpn}` : "Sai thùng — chỉ quét đúng mã LPN của dòng này",
  lineNotOpen: "Dòng này đã được lấy, báo thiếu hoặc huỷ ở nơi khác. Danh sách đã được tải lại.",
  taskState:
    "Task không còn ở bước lấy hàng (đơn đã huỷ hoặc task đã hoàn tất). Dữ liệu đã được tải lại.",
  notAssignee: "Task không còn được gán cho bạn. Dữ liệu đã được tải lại.",
  // 404 ở thao tác không xét người được gán (phân bổ lại — BE reallocateShort): task / đơn / dòng không còn
  lineMissing: "Task hoặc dòng lấy hàng không còn tồn tại. Dữ liệu đã được tải lại.",
  reservationNotActive: "Phần giữ hàng của dòng này không còn hiệu lực — báo quản lý kho.",
  productionHold: "Hàng của dòng này đang giữ cho sản xuất, không lấy được.",
  policyConflict: "Tồn hiện tại cần đối soát trước khi lấy — báo quản lý kho.",
  // BE PICK_HOLD_NOT_IN_CARTON: khoản giữ cũ không nằm trong thùng nào → phân bổ lại thành thùng nguyên
  holdNotInCarton: "Hàng giữ của dòng này không nằm trong thùng nào — báo quản lý kho phân bổ lại.",
  inProgress: "Lần gửi trước đang được xử lý, đợi giây lát rồi thử lại.",
  network: "Không gửi được — kiểm tra mạng rồi bấm Xác nhận lại.",
  // BE INSUFFICIENT_STOCK (409) khi phân bổ lại: không có thùng khác đủ hàng, không đổi gì
  insufficientStock: "Không đủ thùng khác ở kho để phân bổ lại",
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
  /** Thùng bị loại ở trạm kiểm vì hư hỏng (`quarantine`): vào khu cách ly của kho, không về bin (docs 08 §4.2 bước 4). */
  quarantineLocation: "Khu cách ly",
  quarantineLocationPlaceholder: "Chọn khu cách ly đang hoạt động",
  quarantineBadge: "Cách ly",
  quarantineHint: "Thùng hư hỏng được loại ở trạm kiểm — cất nguyên thùng vào khu cách ly của kho.",
  lpn: "Mã thùng (LPN)",
  lpnPlaceholder: "Quét hoặc nhập mã LPN của thùng",
  lpnHint: "Quét đúng LPN của thùng này để xác nhận trả.",
  summary: (
    qty: number,
    sku: string,
    lot: string | null | undefined,
    orderNumber: string,
    lpn?: string | null,
  ) =>
    `Trả ${lpn ? `thùng ${lpn} — ` : ""}${qty} × ${sku}${lot ? ` (lô ${lot})` : ""} của đơn ${orderNumber} về kệ.`,
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
    lpn: "LPN",
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
  quarantineLocationInvalid: "Thùng hư hỏng phải vào khu cách ly đang hoạt động của kho này",
  // BE PICK_ITEM_MISMATCH khi cất lại: chỉ đúng LPN của dòng mới xác nhận được
  itemMismatch: (lpn: string | null | undefined) =>
    lpn ? `Sai thùng — dòng này trả thùng ${lpn}` : "Sai thùng — quét đúng mã LPN của dòng này",
  // BE CARTON_DOES_NOT_FIT_BIN (422, BR-12): thùng phải vừa bin theo từng chiều
  doesNotFit: "Thùng không vừa bin này theo kích thước — chọn bin khác",
  // BE STOCK_PACKAGE_TAKEN_WHOLE: một phần thùng đã đi cách ly lúc kiểm, không cất cả thùng về bin được
  takenWhole:
    "Một phần thùng đã được lấy ra lúc kiểm nên không cất nguyên thùng về bin được — báo quản lý kho.",
  notRequired: "Dòng này đã được trả về kệ hoặc không cần trả. Danh sách đã được tải lại.",
  notFound: "Không tìm thấy dòng này nữa. Danh sách đã được tải lại.",
  outOfScope: "Kho này nằm ngoài phạm vi kho bạn phụ trách.",
  network: "Không gửi được — kiểm tra mạng rồi thử lại.",
} as const;
