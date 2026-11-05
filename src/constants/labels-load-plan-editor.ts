/**
 * Nhãn của trình soạn xếp tay kế hoạch xếp xe (SCRUM-287 PR F5) — port từ `messages/vi/nesting.json` (`manualEdit.*`) của
 * `nesting-standalone`, bỏ phần thêm SKU / chạy thử / giải lại bằng solver (design v2 §4). `UI_LABELS.loadPlan.editor` trỏ về đây.
 */

import { LOAD_PLANNING_LIMITS } from "./numbers";

/** Lý do một thao tác soạn bị từ chối ngay tại chỗ (không có bước hoàn tác). */
export const LOAD_PLAN_EDITOR_REJECT_MESSAGES = {
  notFound: "Không tìm thấy kiện hoặc xe này nữa.",
  placeInvalid:
    "Vị trí này không hợp lệ (ra ngoài thùng, chồng kiện khác, thiếu đỡ hoặc không lọt cửa xe).",
  overweight: "Đặt kiện này sẽ vượt tải trọng của xe.",
  nudgeBlocked: "Kiện đã sát vật cản, không nhích thêm được.",
  rotateForbidden: "Kiện này không được xoay (BR-10).",
  rotateNoFit: "Hướng này không vừa chỗ hiện tại của kiện.",
  unchanged: "Kiện đã đang ở hướng này.",
  nothingToSettle: "Không có kiện nào đang lơ lửng.",
} as const;

/** Mã lỗi BE khi danh sách kiện / xe gửi lên không khớp kế hoạch (`VALIDATION_FAILED` + mã trường). */
export const LOAD_PLAN_EDITOR_STALE_MESSAGES = {
  LOAD_PLAN_PACKAGE_MISSING: "Kế hoạch có kiện mới mà bản bạn đang sửa chưa có.",
  LOAD_PLAN_PACKAGE_UNKNOWN: "Bản bạn đang sửa có kiện không còn thuộc kế hoạch.",
  LOAD_PLAN_PACKAGE_DUPLICATE: "Một kiện xuất hiện hai lần trong bản bạn đang sửa.",
  LOAD_PLAN_VEHICLE_MISSING: "Kế hoạch có xe mà bản bạn đang sửa chưa có.",
  LOAD_PLAN_VEHICLE_UNKNOWN: "Bản bạn đang sửa có xe không còn thuộc kế hoạch.",
  LOAD_PLAN_VEHICLE_DUPLICATE: "Một xe xuất hiện hai lần trong bản bạn đang sửa.",
} as const;

export const LOAD_PLAN_EDITOR_LABELS = {
  open: "Chỉnh xếp tay",
  title: "Chỉnh xếp tay",
  description:
    "Chọn kiện để nhích, xoay hoặc đưa ra khay; chọn kiện ở khay rồi bấm ô xanh để đặt. Mọi thay đổi chỉ được gửi khi bấm Lưu; máy chủ kiểm tra lại toàn bộ.",
  exit: "Thoát chỉnh sửa",
  discard: {
    title: "Bỏ các thay đổi chưa lưu?",
    description: "Các chỉnh sửa trên màn này chưa được gửi lên máy chủ và sẽ mất.",
    confirm: "Bỏ thay đổi",
    keep: "Tiếp tục chỉnh sửa",
  },
  toolbar: {
    group: "Công cụ chỉnh xếp tay",
    undo: "Hoàn tác",
    redo: "Làm lại",
    multiOff: "Chọn nhiều",
    multiOn: (n: number) => `Đang chọn nhiều (${n})`,
    emptyOff: "Xem chỗ trống",
    emptyOn: "Đang xem chỗ trống",
    settle: "Hạ kiện lơ lửng",
    computing: "Đang tính chỗ trống…",
    stats: {
      boxes: "Kiện trên xe",
      tray: "Ở khay",
      weight: "Khối lượng",
      volume: "Thể tích",
    },
  },
  vehicle: {
    boxes: (n: number) => `${n} kiện`,
  },
  selection: {
    title: "Kiện đang chọn",
    none: "Bấm một kiện trong khung 3D để chọn (giữ Shift hoặc bật “Chọn nhiều” để chọn thêm).",
    count: (n: number) => `${n} kiện đã chọn`,
    position: (x: number, y: number, z: number) => `(${x}, ${y}, ${z}) mm`,
    stepNote: `Mỗi lần nhích tối đa ${LOAD_PLANNING_LIMITS.nudgeStepMm} mm, dừng sát vật cản`,
    toTray: "Đưa ra khay",
    toTrayN: (n: number) => `Đưa ${n} kiện ra khay`,
    toVehicle: (seq: number) => `Chuyển sang xe #${seq}`,
    toVehicleHint:
      "Đưa ra khay chung rồi mở xe kia để bấm ô xanh đặt vào; kiện của một bộ phải đi cùng một xe.",
    selectPeers: (n: number) => `Chọn thêm kiện cùng loại (${n})`,
    selectKit: (n: number) => `Chọn cả bộ (${n})`,
    deselect: "Bỏ chọn",
    nudge: {
      left: "Sang trái",
      right: "Sang phải",
      toDoor: "Ra phía cửa xe",
      inward: "Vào phía đầu xe",
      up: "Nâng lên",
      down: "Hạ xuống",
    },
    rotate: {
      title: "Xoay (dài×rộng×cao theo trục xe)",
      current: "Hướng hiện tại",
      noFit: "Không vừa chỗ này",
      fixed: "Kiện này không được xoay (BR-10).",
      single: "Kiện này chỉ có một hướng đặt.",
      mixed: "Chọn các kiện cùng loại để xoay cùng lúc.",
    },
  },
  tray: {
    title: "Khay chung (kiện chưa xếp)",
    empty: "Khay trống — mọi kiện đã có chỗ trên xe.",
    hint: "Chọn một dòng ở khay, rồi bấm ô xanh trong khung 3D để đặt vào xe đang xem.",
    line: (name: string, n: number) => `${name} ×${n}`,
    pick: (name: string) => `Chọn ${name} để đặt vào xe`,
    selected: (name: string, n: number) => `Đang đặt: ${name} (còn ${n})`,
    allOrientations: "Mọi hướng",
    spotList: {
      title: "Chọn vị trí đặt bằng bàn phím",
      aria: "Vị trí đặt được cho kiện đang chọn",
      hint: "Mũi tên lên / xuống chọn vị trí (ô xanh tương ứng sáng lên trong khung 3D), Enter hoặc Space để đặt.",
      option: (seq: number, x: number, y: number, z: number, size: string, supportPct: number) =>
        `Xe #${seq} · vị trí (${x}, ${y}, ${z}) mm · ${size} · đỡ ${supportPct}%`,
    },
    spots: (n: number) => `${n} vị trí đặt được`,
    noSpots: "Không còn chỗ nào cho kiện này trên xe đang xem.",
    computing: "Đang tính chỗ đặt…",
    flagged: "Có kiện vi phạm luật",
  },
  lines: {
    title: "Mặt hàng trên xe này",
    product: "Mặt hàng",
    onVehicle: "Trên xe",
    onTray: "Khay",
    moveOut: "→ Khay",
    qty: "Số lượng chuyển ra khay",
    empty: "Xe này chưa có kiện.",
  },
  issues: {
    title: "Kiểm tra trước khi lưu",
    ok: "Chưa thấy vi phạm nào.",
    some: (n: number) => `${n} vi phạm — máy chủ sẽ từ chối nếu còn khi lưu.`,
    server: "Máy chủ báo",
    vehicle: (seq: number) => `Xe #${seq}`,
    tray: "Khay",
    select: "Chọn kiện",
  },
  save: {
    save: "Lưu bố cục",
    saving: "Đang lưu…",
    clean: "Chưa có thay đổi.",
    dirty: "Có thay đổi chưa lưu.",
    emptiedVehicles: (seqs: string) =>
      `Xe ${seqs} không còn kiện nào — lưu sẽ bỏ xe đó khỏi kế hoạch.`,
    tooMany: "Quá nhiều kiện hoặc xe trong một lần lưu; chia nhỏ kế hoạch.",
    confirmTitle: "Còn vi phạm chưa xử lý",
    confirmDescription: (n: number) =>
      `Trình kiểm tra thấy ${n} vi phạm. Máy chủ kiểm tra lại toàn bộ và sẽ từ chối nếu đúng — vẫn gửi?`,
    confirmSend: "Vẫn gửi",
    violation: (n: number) =>
      `Máy chủ từ chối: ${n} vị trí vi phạm quy tắc xếp. Chưa có gì được lưu; các kiện vi phạm đã được tô đỏ.`,
    error: "Chưa lưu được. Bản chỉnh của bạn vẫn còn ở đây, bấm Lưu để thử lại.",
  },
  conflict: {
    title: "Người khác vừa thay đổi kế hoạch",
    description:
      "Bản chỉnh của bạn vẫn được giữ. Tải lại sẽ bỏ chỉnh sửa và lấy bản mới; hoặc xem người khác đã đổi gì rồi quyết định ghi đè.",
    loading: "Đang tải bản mới…",
    refreshFailed: "Không tải được bản mới của kế hoạch. Thử lại rồi chọn tiếp.",
    reload: "Tải lại",
    review: "Ghi đè sau khi xem",
    reviewTitle: "Xem trước khi ghi đè",
    changes: (moved: number) => `${moved} kiện đã đổi chỗ so với bản bạn mở.`,
    noChanges: "Bản mới chỉ khác phiên bản, không có kiện nào đổi chỗ.",
    added: (n: number) => `Kế hoạch có thêm ${n} kiện mà bản của bạn chưa có.`,
    removed: (n: number) => `Kế hoạch đã bỏ ${n} kiện mà bản của bạn còn.`,
    vehiclesChanged: "Danh sách xe của kế hoạch đã đổi.",
    cannotOverwrite: "Không ghi đè được vì tập xe hoặc tập kiện đã khác — hãy tải lại.",
    moved: (label: string, from: string, to: string) => `${label}: ${from} → ${to}`,
    place: (seq: number | null) => (seq === null ? "khay" : `xe #${seq}`),
    more: (n: number) => `…và ${n} kiện khác.`,
    overwrite: "Ghi đè bằng bản của tôi",
    back: "Quay lại chỉnh",
  },
  viewport: {
    aria: (code: string) => `Khung 3D chỉnh xếp xe ${code}`,
    hoverLabel: (name: string, label: string) => `${name} · ${label}`,
    landingAria: (n: number) => `${n} ô gợi ý chỗ đặt`,
  },
  notReady: "Dữ liệu kế hoạch đang được tải lại. Thử lại sau giây lát.",
  loadFailed: "Không tải được bố cục các xe nên chưa mở được trình soạn.",
  closedByStatus:
    "Kế hoạch đã đổi trạng thái nên không chỉnh xếp tay được nữa; trình soạn đã đóng và các chỉnh sửa chưa lưu không còn áp dụng.",
  loadingEditor: "Đang chuẩn bị trình soạn…",
} as const;
