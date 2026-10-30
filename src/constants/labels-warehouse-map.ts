/**
 * Nhãn, thông báo và lỗi của module 06 — danh mục kho, khai báo kho mới, bản đồ kho 2D/3D
 * (docs 06-warehouse-map-slotting, BE `WarehouseController` / `LayoutController` / `ShelfController`).
 * `UI_LABELS.warehouseMap` / `TOAST_MESSAGES.warehouseMap` trỏ về đây.
 */

import {
  WAREHOUSE_MAP_EDIT_LABELS,
  WAREHOUSE_MAP_EDIT_TOASTS,
  WAREHOUSE_WORKSPACE_LABELS,
} from "./labels-warehouse-map-edit";
import { WAREHOUSE_MAP_LIMITS as LIMITS } from "./numbers";

import type {
  AREA_TYPES,
  BIN_NAMING_SCHEMES,
  BIN_TYPES,
  BOUNDARY_TYPES,
  DOOR_STATUSES,
  STORAGE_CLASSES,
  WAREHOUSE_STATUSES,
} from "./statuses";

/** BE `WarehouseStatus` — kho ngưng thì mọi vị trí trong kho không dùng được (BR-16). */
export const WAREHOUSE_STATUS_LABELS: Record<(typeof WAREHOUSE_STATUSES)[number], string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngưng hoạt động",
};

/** Nhãn loại khu vực (docs 06 §5 "Giá trị phân loại"). */
export const AREA_TYPE_LABELS: Record<(typeof AREA_TYPES)[number], string> = {
  RECEIVING: "Khu nhận hàng",
  QUALITY_CONTROL: "Khu kiểm QC",
  QUARANTINE: "Khu cách ly",
  PACKING: "Khu đóng gói",
  DISPATCH: "Khu chờ giao",
  OVERFLOW: "Khu tràn",
  PRODUCTION: "Xưởng in",
  NON_STORAGE: "Không chứa hàng",
};

export const STORAGE_CLASS_LABELS: Record<(typeof STORAGE_CLASSES)[number], string> = {
  NORMAL: "Thường",
  COLD: "Lạnh",
  HAZMAT: "Nguy hiểm",
  FRAGILE: "Dễ vỡ",
  OVERSIZE: "Quá khổ",
};

export const BIN_TYPE_LABELS: Record<(typeof BIN_TYPES)[number], string> = {
  STANDARD: "Tiêu chuẩn",
  PALLET: "Pallet",
  SMALL_PARTS: "Linh kiện nhỏ",
};

export const BOUNDARY_TYPE_LABELS: Record<(typeof BOUNDARY_TYPES)[number], string> = {
  WALL: "Tường",
  DOOR: "Cửa",
};

export const DOOR_STATUS_LABELS: Record<(typeof DOOR_STATUSES)[number], string> = {
  OPEN: "Mở",
  CLOSED: "Đóng",
};

export const BIN_NAMING_SCHEME_LABELS: Record<(typeof BIN_NAMING_SCHEMES)[number], string> = {
  SEQUENTIAL: "Số liên tục (01, 02…)",
  ROW_LETTER_COLUMN: "Chữ hàng + số cột (A01, B01…)",
};

/** Mã lỗi BE → câu tiếng Việt (map về field ở form; mã lạ dùng message của BE). */
export const WAREHOUSE_MAP_ERROR_MESSAGES: Record<string, string> = {
  WAREHOUSE_PREFIX_ALREADY_EXISTS: "Prefix này đã được kho khác dùng — chọn prefix khác.",
  LAYOUT_OUT_OF_BOUNDS: "Vượt ra ngoài khung bản đồ kho (BR-06).",
  LAYOUT_OVERLAP: "Chồng lấn kệ hoặc khu vực đang dùng (BR-07).",
  PICK_FACE_REQUIRED: "Kệ có bin cho lấy hàng phải có ít nhất một mặt lấy hàng (BR-08).",
  SHELF_CODE_ALREADY_EXISTS: "Mã kệ đã có trong kho này.",
  AREA_CODE_ALREADY_EXISTS: "Mã khu vực đã có trong kho này.",
  ZONE_NAME_ALREADY_EXISTS: "Tên zone đã có trong kho này.",
  SHELF_LEVEL_HAS_BINS: "Tầng đã có bin — chỉ tự sinh cho tầng chưa có bin (BR-14).",
  SHELF_CAPACITY_EXCEEDED: `Vượt giới hạn ${LIMITS.levelsPerShelfMax} tầng mỗi kệ hoặc ${LIMITS.binsPerLevelMax} bin mỗi tầng (BR-15).`,
  OPTIMISTIC_LOCK:
    "Người khác vừa sửa bản đồ — thoát chế độ sửa để tải bản mới rồi làm lại phần chưa lưu.",
  AREA_TYPE_CHANGE_NOT_ALLOWED: "Khu chứa hàng không đổi được thành khu không chứa hàng (BR-11).",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho.",
};

export const WAREHOUSE_MAP_UI_LABELS = {
  listTitle: "Danh mục kho",
  mapTitle: "Bản đồ kho",
  createTitle: "Khai báo kho mới",
  create: "Tạo kho",
  openMap: "Mở bản đồ",
  searchPlaceholder: "Tìm theo prefix hoặc tên kho",
  summarySearch: "Search chính",
  statusFilter: "Trạng thái",
  all: "Tất cả",
  listCaption: "kho",
  refetching: "Đang tải lại danh mục kho",
  refetchFailed: "Không tải lại được dữ liệu mới nhất — đang hiện bản đã tải trước đó.",
  loadFailedTitle: "Không tải được danh mục kho",
  noReadTitle: "Chưa được cấp quyền xem dữ liệu",
  noReadDescription: "Bạn chưa được cấp quyền xem danh mục kho. Liên hệ quản trị để được cấp.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem danh mục kho.",
  empty: {
    noDataTitle: "Chưa có kho",
    noDataDescription: "Khai báo kho đầu tiên để bắt đầu vẽ bản đồ và tạo vị trí lưu trữ.",
    noResultsDescription: "Không có kho nào khớp từ khoá hoặc bộ lọc hiện tại.",
  },
  column: {
    prefix: "Prefix",
    name: "Tên kho",
    address: "Địa chỉ",
    mapSize: "Khung bản đồ",
    status: "Trạng thái",
    actions: "Thao tác",
  },
  field: {
    prefix: "Prefix mã vị trí",
    name: "Tên kho",
    address: "Địa chỉ kho",
    street: "Số nhà, tên đường",
    province: "Tỉnh / thành phố",
    ward: "Phường / xã",
    returnAddress: "Địa chỉ hoàn hàng",
    mapUnit: "Đơn vị bản đồ",
    mapWidth: "Chiều rộng (m)",
    mapHeight: "Chiều dài (m)",
  },
  form: {
    description: "Khai báo kho với bản đồ trống. Tạo xong sẽ mở bản đồ để vẽ tường, khu vực và kệ.",
    sectionGeneral: "Thông tin chung",
    sectionMap: "Khung bản đồ",
    // BR-10 / BR-13: prefix mở đầu mọi mã vị trí, không đổi sau khi tạo — câu ngắn để không chiếm chỗ
    prefixHint: `A–Z, 0–9, ≤ ${LIMITS.prefixMax} ký tự. Không đổi được.`,
    returnAddressHint: "Để trống nếu hàng hoàn về đúng địa chỉ kho.",
    sectionAddress: "Địa chỉ kho",
    provincePlaceholder: "Chọn tỉnh / thành phố",
    wardPlaceholder: "Chọn phường / xã",
    wardNeedsProvince: "Chọn tỉnh / thành phố trước",
    divisionSearch: "Gõ để tìm (có thể không dấu)",
    divisionLoading: "Đang tải danh sách…",
    divisionEmpty: "Không tìm thấy",
    divisionFailed:
      "Không tải được danh sách tỉnh / xã — nhập tay tên tỉnh / thành và phường / xã.",
    streetPlaceholder: "12 Đường Demo",
    addressPreview: "Địa chỉ lưu",
    mapUnitHint: "Chỉ hỗ trợ mét; không đổi được sau khi tạo (BR-13).",
    mapHint:
      "Gốc toạ độ ở góc trên-trái. Khung chỉ thu nhỏ được tới phạm vi bố cục hiện có (BR-06).",
    previewTitle: "Xem trước khung",
    previewEmpty: "Nhập chiều rộng và chiều dài để xem khung.",
    locationExample: "Ví dụ mã bin",
    submit: "Tạo kho",
    cancel: "Huỷ",
  },
  map: {
    view2d: "2D",
    view3d: "3D",
    viewToggle: "Chế độ xem",
    zoomIn: "Phóng to (+)",
    zoomOut: "Thu nhỏ (−)",
    zoomReset: "Vừa khung (0)",
    zoomGroup: "Điều khiển bản đồ",
    hand: "Bàn tay — kéo bản đồ (H)",
    showInactive: (count: number) => `Hiện vị trí ngừng dùng (${count})`,
    help: "Chú giải & phím tắt (?)",
    helpTitle: "Chú giải, số liệu & phím tắt",
    shortcutsView: "Phím tắt — xem bản đồ",
    shortcutsEdit: "Phím tắt — chế độ sửa",
    clickHint: "Bấm vào kệ hoặc khu vực trên bản đồ để xem chi tiết.",
    fullscreen: "Xem toàn màn hình (F)",
    exitFullscreen: "Thoát toàn màn hình (Esc)",
    disclaimer:
      "Bản đồ chỉ mang tính trực quan — nguồn sự thật của tồn kho là tồn theo vị trí (BR-05).",
    webglFallback: "Trình duyệt không hỗ trợ 3D (WebGL) — đang hiện bản đồ 2D.",
    loading3d: "Đang dựng cảnh 3D…",
    scene: {
      focusLabel: (code: string) => `Đang xem ${code}`,
      stockTitle: "Hàng trên kệ",
      stockLoading: "Đang tải hàng trên kệ…",
      stockFailed: "Không tải được tồn của kệ.",
      stockEmpty: "Kệ chưa có hàng.",
      stockHidden: "đang kiểm kê",
      stockMore: (count: number) => `… và ${count} dòng khác`,
      stockNote: "Thùng carton vẽ theo tồn hiện tại — chỉ mang tính trực quan (BR-05).",
      openDetail: "Xem chi tiết",
      overview: "Toàn cảnh (0)",
      showStock: "Xem hàng trên kệ",
      hideStock: "Ẩn hàng trên kệ",
    },
    emptyLayout: "Kho chưa có gì trên bản đồ. Bắt đầu bằng tường bao, khu vực rồi tới kệ.",
    loadFailedTitle: "Không tải được bản đồ kho",
    noReadDescription: "Bạn chưa được cấp quyền xem bản đồ kho (warehouse-locations:READ).",
    legend: "Chú giải",
    stats: {
      shelves: "Kệ",
      bins: "Bin",
      usableBins: "Bin dùng được",
      areas: "Khu vực",
    },
    canvasLabel: (name: string) => `Bản đồ 2D kho ${name}`,
    inactiveWarehouse: "Kho đang ngưng — mọi vị trí đọc là Inactive (BR-16).",
  },
  panel: {
    title: "Chi tiết",
    shelf: "Kệ",
    area: "Khu vực",
    code: "Mã",
    name: "Tên",
    zone: "Zone",
    noZone: "Không thuộc zone",
    storageClass: "Lớp lưu trữ",
    status: "Trạng thái",
    effectiveStatus: "Trạng thái hiệu lực",
    footprint: "Vị trí · kích thước",
    rotation: "Góc xoay",
    pickFaces: "Mặt lấy hàng",
    noPickFace: "Không có",
    obstacle: "Vật cản",
    levels: "Tầng",
    level: (index: number) => `Tầng ${index}`,
    noLevels: "Kệ chưa có tầng.",
    noBins: "Chưa có bin",
    locationCode: "Mã vị trí",
    usable: "Dùng được",
    notUsable: "Không dùng được",
    nonStorage: "Không phải vị trí tồn kho",
    changeStatus: "Đổi trạng thái",
    close: "Đóng",
  },
  faces: { north: "Bắc", east: "Đông", south: "Nam", west: "Tây" },
  actions: {
    addZone: "Thêm zone",
    addShelf: "Thêm kệ",
    addArea: "Thêm khu vực",
    addBoundary: "Thêm tường / cửa",
    deleteBoundary: "Xoá",
  },
  editor: {
    zoneTitle: "Thêm zone",
    zoneName: "Tên zone",
    zoneColor: "Màu hiển thị",
    shelfTitle: "Thêm kệ",
    shelfDescription:
      "Tạo kệ, các tầng rồi tự sinh bin theo lưới hàng × cột. Mã kệ không đổi được sau khi tạo (BR-13).",
    areaTitle: "Thêm khu vực",
    boundaryTitle: "Thêm tường / cửa",
    code: "Mã",
    name: "Tên",
    type: "Loại",
    description: "Mô tả",
    x: "X (m)",
    y: "Y (m)",
    width: "Rộng (m)",
    length: "Dài (m)",
    rotation: "Góc xoay",
    obstacle: "Là vật cản khi tìm đường",
    pickFaces: "Mặt lấy hàng",
    defaultStorageClass: "Lớp lưu trữ mặc định",
    levelCount: "Số tầng",
    levelHeight: "Chiều cao mỗi tầng (m)",
    generateBins: "Tự sinh bin (BR-14)",
    rowCount: "Số hàng",
    columnCount: "Số cột",
    namingScheme: "Kiểu đặt mã",
    binType: "Loại ô",
    capacityUnits: "Sức chứa (đơn vị)",
    maxWeight: "Tải trọng tối đa (kg)",
    pickable: "Cho phép lấy hàng",
    putawayTarget: "Cho phép cất hàng",
    binPreview: (rows: number, columns: number, w: string, l: string) =>
      `${rows * columns} bin mỗi tầng · mỗi bin ${w} × ${l} m`,
    startX: "Đầu X",
    startY: "Đầu Y",
    endX: "Cuối X",
    endY: "Cuối Y",
    passable: "Đi qua được",
    doorStatus: "Trạng thái cửa",
    none: "Không chọn",
    submit: "Lưu",
    cancel: "Huỷ",
    progressShelf: "Đang tạo kệ…",
    progressLevels: (done: number, total: number) => `Đang tạo tầng ${done}/${total}…`,
    progressBins: "Đang sinh bin…",
    partialShelf:
      "Kệ đã được tạo nhưng chưa xong tầng / bin — kệ vẫn có trên bản đồ, thêm phần còn lại sau.",
  },
  edit: WAREHOUSE_MAP_EDIT_LABELS,
  workspace: WAREHOUSE_WORKSPACE_LABELS,
  validation: {
    codeFormat: `Chỉ gồm A–Z, 0–9, tối đa ${LIMITS.codeMax} ký tự, không có "-" (BR-10).`,
    prefixFormat: `Chỉ gồm A–Z, 0–9, tối đa ${LIMITS.prefixMax} ký tự, không có "-" (BR-10).`,
    required: "Bắt buộc nhập.",
    positive: "Phải lớn hơn 0.",
    nonNegative: "Không được âm.",
    fraction: `Tối đa ${LIMITS.measureFractionDigits} chữ số thập phân — hệ thống không làm tròn.`,
    tooLong: (max: number) => `Tối đa ${max} ký tự.`,
    outOfBounds: "Nằm ngoài khung bản đồ kho (BR-06).",
    overlap: (code: string) => `Chồng lấn với ${code} đang dùng (BR-07).`,
    pickFaceRequired: "Bin cho lấy hàng cần ít nhất một mặt lấy hàng (BR-08).",
    levelsMax: `Tối đa ${LIMITS.levelsPerShelfMax} tầng mỗi kệ (BR-15).`,
    binsMax: `Hàng × cột tối đa ${LIMITS.binsPerLevelMax} bin mỗi tầng (BR-14).`,
    letterRowsMax: `Kiểu chữ hàng tối đa ${LIMITS.letterRowsMax} hàng (A–Z).`,
    colorFormat: "Màu dạng #RRGGBB.",
    boundaryZero: "Điểm đầu và điểm cuối phải khác nhau.",
    zoneNameTaken: "Tên zone đã có trong kho này.",
    codeTaken: "Mã đã có trong kho này.",
    provinceRequired: "Chọn tỉnh / thành phố.",
    wardRequired: "Chọn phường / xã.",
  },
} as const;

export const WAREHOUSE_MAP_TOAST_MESSAGES = {
  warehouseCreated: "Đã tạo kho — bắt đầu vẽ bản đồ",
  zoneCreated: "Đã thêm zone",
  shelfCreated: "Đã thêm kệ",
  areaCreated: "Đã thêm khu vực",
  boundaryCreated: "Đã thêm tường / cửa",
  boundaryDeleted: "Đã xoá tường / cửa",
  statusChanged: "Đã đổi trạng thái",
  ...WAREHOUSE_MAP_EDIT_TOASTS,
} as const;
