/**
 * Nhãn chế độ sửa bản đồ kho (docs 06 §4.1, §5): vẽ bằng kéo-thả, chỉnh thông số, lưu một lần.
 * `UI_LABELS.warehouseMap.edit` trỏ về đây.
 */

export const WAREHOUSE_MAP_EDIT_LABELS = {
  enter: "Chỉnh sửa bản đồ",
  toolGroup: "Công cụ vẽ",
  tool: {
    select: "Chọn / di chuyển (V)",
    pan: "Bàn tay — kéo bản đồ (H)",
    shelf: "Vẽ kệ (K)",
    area: "Vẽ khu vực (A)",
    wall: "Vẽ tường (W)",
    door: "Vẽ cửa (D)",
  },
  addZone: "Thêm zone (Z)",
  inspect: "Thông số (Enter / bấm đúp)",
  rotate: "Xoay 90° (R)",
  remove: "Xoá (Delete)",
  undo: "Hoàn tác (Ctrl+Z)",
  redo: "Làm lại (Ctrl+Shift+Z)",
  duplicate: "Nhân bản (Ctrl+D)",
  copy: "Sao chép (Ctrl+C)",
  paste: "Dán (Ctrl+V)",
  toolbar: "Thanh công cụ sửa",
  editGroup: "Công cụ sửa",
  selectionGroup: "Thao tác với hình đang chọn",
  groupSelected: (count: number) => `${count} hình đã chọn`,
  clearSelection: "Bỏ chọn (Esc)",
  done: "Xong",
  cancel: "Thoát",
  save: (count: number) => (count > 0 ? `Lưu ${count} thay đổi` : "Lưu"),
  saving: (done: number, total: number) => `Đang lưu ${done}/${total}…`,
  invalid: (count: number) => `${count} hình chưa hợp lệ — sửa trước khi lưu.`,
  exitTitle: "Bỏ các thay đổi chưa lưu?",
  exitDescription: (count: number) => `${count} thay đổi trên bản đồ sẽ mất.`,
  exitConfirm: "Bỏ thay đổi",
  exitKeep: "Tiếp tục sửa",
  saveFailed: (step: string) =>
    `Dừng ở bước "${step}". Các bước trước đã lưu; phần còn lại vẫn nằm trong bản nháp.`,
  inspector: {
    empty: "Chọn hoặc vẽ một hình để chỉnh thông số.",
    newBadge: "Mới — chưa lưu",
    changedBadge: "Đã sửa — chưa lưu",
    remove: "Xoá",
    removeSaved: "Ngừng dùng",
    removeSavedHint:
      "Kệ / khu vực đã lưu không xoá hẳn: lưu sẽ chuyển sang Inactive, mã giữ lại (BR-04).",
    codeLocked: "Mã không đổi được sau khi lưu (BR-13).",
    placement: "Vị trí · kích thước",
    build: "Tầng & bin (tạo cùng kệ)",
    location: "Vị trí tồn kho",
    noUpdate: "Bạn không có quyền sửa hình đã lưu (warehouse-locations:UPDATE).",
    noDelete: "Bạn không có quyền xoá tường / cửa (warehouse-locations:DELETE).",
  },
  stock: {
    checking: "Đang kiểm tra tồn ở vị trí này…",
    stocked:
      "Vị trí đang có hàng — chỉ sửa được tên, mô tả và zone. Chuyển hết hàng đi trước khi dời, đổi kích thước, đổi lớp lưu trữ hoặc ngừng dùng (BR-04).",
    unknown:
      "Không kiểm tra được tồn — hãy chắc chắn vị trí không còn hàng trước khi dời hoặc ngừng dùng (BR-04).",
  },
  op: {
    zoneCreate: (name: string) => `Tạo zone ${name}`,
    zoneUpdate: (name: string) => `Sửa zone ${name}`,
    boundaryDelete: "Xoá tường / cửa",
    deactivate: (code: string) => `Ngừng dùng ${code}`,
    shelfUpdate: (code: string) => `Sửa kệ ${code}`,
    areaUpdate: (code: string) => `Sửa khu vực ${code}`,
    shelfCreate: (code: string) => `Tạo kệ ${code}`,
    areaCreate: (code: string) => `Tạo khu vực ${code}`,
    boundaryUpdate: "Sửa tường / cửa",
    boundaryCreate: "Tạo tường / cửa",
  },
  defaults: {
    shelfCodeBase: "K",
    areaCodeBase: "KV",
    shelfName: (code: string) => `Kệ ${code}`,
    areaName: (code: string) => `Khu vực ${code}`,
  },
  validation: {
    shrinkBelowBins: "Kệ không thu nhỏ được quá phạm vi bin đang có (BR-07).",
    zoneMissing: "Zone không còn trong bản nháp.",
    storageToNonStorage: "Khu chứa hàng không đổi được thành khu không chứa hàng (BR-11).",
  },
} as const;

/** Tab "Kho & bản đồ" — chọn kho ở Danh mục kho, rồi mới vào các trang của kho đó. */
export const WAREHOUSE_WORKSPACE_LABELS = {
  navGroup: "Kho & bản đồ",
  choose: "Đang tải danh sách kho",
  change: "Đổi kho",
  pickHint: "Chọn một kho ở Danh mục kho để mở bản đồ và gợi ý vị trí của kho đó.",
  notFoundTitle: (prefix: string) => `Không có kho ${prefix}`,
  notFoundDescription:
    "Kho không còn trong danh mục hoặc bạn chưa được cấp quyền xem — chọn kho khác.",
  backToChooser: "Chọn kho khác",
  loadFailed: "Không tải được danh sách kho.",
  retry: "Thử lại",
  pages: { map: "Bản đồ kho", slotting: "Gợi ý vị trí" },
} as const;

/** Một dòng trong bảng phím tắt — `keys` là các phím bấm cùng lúc (hoặc lựa chọn, nối bằng "/"). */
export interface MapShortcut {
  keys: readonly string[];
  label: string;
}

/**
 * Phím tắt bản đồ kho (Mode A ưu tiên không cần chuột) — một nguồn cho modal "?" và tooltip. Đang gõ
 * trong ô nhập / dialog thì phím đơn thuộc về ô đó; Ctrl+S vẫn lưu được.
 */
export const WAREHOUSE_MAP_SHORTCUTS: {
  view: readonly MapShortcut[];
  edit: readonly MapShortcut[];
} = {
  view: [
    { keys: ["E"], label: "Vào chế độ sửa" },
    { keys: ["H"], label: "Bàn tay — bấm giữ kéo bản đồ" },
    { keys: ["2"], label: "Xem 2D" },
    { keys: ["3"], label: "Xem 3D" },
    { keys: ["Ctrl + lăn chuột"], label: "Zoom quanh con trỏ (macOS: ⌘)" },
    { keys: ["Ctrl + kéo", "Chuột giữa"], label: "Dời bản đồ" },
    { keys: ["+", "−", "0"], label: "Phóng to / thu nhỏ / vừa khung" },
    { keys: ["F"], label: "Bật / tắt toàn màn hình" },
    { keys: ["?"], label: "Chú giải & phím tắt" },
  ],
  edit: [
    { keys: ["V"], label: "Công cụ chọn / di chuyển" },
    { keys: ["H"], label: "Bàn tay — bấm giữ kéo bản đồ" },
    { keys: ["K", "A"], label: "Vẽ kệ / vẽ khu vực" },
    { keys: ["W", "D"], label: "Vẽ tường / vẽ cửa (giữ Shift khi kéo: thẳng ngang / dọc)" },
    { keys: ["Z"], label: "Thêm zone" },
    { keys: ["Tab", "Shift+Tab"], label: "Chọn hình kế tiếp / trước đó" },
    { keys: ["Kéo trên nền"], label: "Chọn vùng (công cụ chọn) — giữ Shift để chọn thêm" },
    { keys: ["Shift + bấm"], label: "Thêm / bớt một hình khỏi vùng chọn" },
    { keys: ["Ctrl+A"], label: "Chọn tất cả" },
    { keys: ["Enter"], label: "Mở thông số hình đang chọn" },
    { keys: ["←", "→", "↑", "↓"], label: "Dời 0,1 m (Shift: 1 m)" },
    { keys: ["R"], label: "Xoay 90°" },
    { keys: ["Ctrl+D"], label: "Nhân bản các hình đang chọn" },
    {
      keys: ["Ctrl+C", "Ctrl+V"],
      label:
        "Sao chép / dán (cả vùng chọn giữ nguyên bố cục; bản dán nằm ngay dưới, dán tiếp ra một dãy)",
    },
    { keys: ["Delete"], label: "Xoá / ngừng dùng các hình đang chọn (bỏ qua hình còn hàng)" },
    { keys: ["Ctrl+Z"], label: "Hoàn tác" },
    { keys: ["Ctrl+Shift+Z", "Ctrl+Y"], label: "Làm lại" },
    { keys: ["Ctrl+S"], label: "Lưu toàn bộ bản nháp" },
    { keys: ["Ctrl + lăn chuột"], label: "Zoom quanh con trỏ (macOS: ⌘)" },
    { keys: ["Ctrl + kéo", "Chuột giữa"], label: "Dời bản đồ" },
    { keys: ["+", "−", "0"], label: "Phóng to / thu nhỏ / vừa khung" },
    { keys: ["F"], label: "Bật / tắt toàn màn hình" },
    { keys: ["Esc"], label: "Về công cụ chọn / bỏ chọn" },
  ],
};

export const WAREHOUSE_MAP_EDIT_TOASTS = {
  saved: "Đã lưu bản đồ",
  groupRemoveSkipped: (count: number) =>
    `Bỏ qua ${count} hình còn hàng, chưa kiểm xong tồn hoặc không đủ quyền xoá — đang giữ chọn các hình đó.`,
} as const;
