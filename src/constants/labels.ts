/**
 * Nhãn UI + nội dung toast dùng lại ≥2 lần (§15 — không hardcode string).
 */

import { IDENTITY_TOAST_MESSAGES } from "./labels-identity";
import { INVENTORY_ITEM_TOAST_MESSAGES, INVENTORY_ITEM_UI_LABELS } from "./labels-inventory-item";
import { LOAD_PLAN_TOAST_MESSAGES, LOAD_PLAN_UI_LABELS } from "./labels-load-plan";
import { CARTON_CHECK_TOAST_MESSAGES, CARTON_CHECK_UI_LABELS } from "./labels-carton-check";
import { CARTON_SPEC_UI_LABELS } from "./labels-carton-spec";
import { PRODUCT_UI_LABELS } from "./labels-product";
import { RECEIPT_CARTON_ERROR_MESSAGES } from "./labels-receipt-carton";
import { SHIPPING_TOAST_MESSAGES, SHIPPING_UI_LABELS } from "./labels-shipping";
import { TAXONOMY_TOAST_MESSAGES, TAXONOMY_UI_LABELS } from "./labels-taxonomy";
import { VEHICLE_TYPE_TOAST_MESSAGES, VEHICLE_TYPE_UI_LABELS } from "./labels-vehicle-type";
import {
  WAREHOUSE_CAPACITY_TOAST_MESSAGES,
  WAREHOUSE_CAPACITY_UI_LABELS,
} from "./labels-warehouse-capacity";
import { WAREHOUSE_MAP_TOAST_MESSAGES, WAREHOUSE_MAP_UI_LABELS } from "./labels-warehouse-map";

/**
 * Nhãn khách khi không biết tên lẫn mã khách — thay cho mảnh UUID `KH 0c0000…` (BO-UX-6). Một nguồn cho mọi chỗ hiện
 * khách: `CustomerName`, ô khách của danh sách đơn / đơn treo tín dụng, thẻ thông tin đơn.
 */
export const CUSTOMER_FALLBACK_LABEL = "Khách hàng";

export const UI_LABELS = {
  common: {
    retry: "Thử lại",
    back: "Quay lại",
    backToList: "Về danh sách",
    backToHome: "Về trang tổng quan",
    traceId: "TraceId",
    /** Caption bảng danh sách: "Hiển thị x / tổng …". */
    showing: "Hiển thị",
    /** Badge thanh Cấu hình khi ô search chưa có nội dung. */
    notEntered: "Chưa nhập",
  },
  // Ô chọn có tìm dùng chung (components/shared/InputCombobox) — luật R1 của WF4 UX audit
  combobox: {
    /** Nút ✕ xoá giá trị đang chọn trong ô. */
    clear: (label: string) => `Bỏ chọn ${label}`,
    /** Nút mũi tên mở danh sách (bấm vào thân ô chỉ đặt con trỏ). */
    open: (label: string) => `Mở danh sách ${label}`,
    /** Dòng cuối danh sách khi còn kết quả không hiện hết (biết số). */
    more: (remaining: number) => `Còn ${remaining} kết quả — gõ thêm để thu hẹp`,
    /** Như trên khi BE chỉ báo còn trang sau, không báo số. */
    moreUnknown: "Còn kết quả khác — gõ thêm để thu hẹp",
  },
  // Ô chọn khách back-office (components/backoffice/CustomerPicker, WF4 UX audit TU-2 / S02-6)
  customerPicker: {
    label: "Khách hàng",
    placeholder: "Chọn khách hàng…",
    searchPlaceholder: "Gõ tên khách hoặc mã số thuế…",
    requiredHint: "Chỉ khách đã kích hoạt portal (Hoạt động) mới nhận báo giá / làm mẫu.",
    searching: "Đang tìm…",
    loadFailed: "Không tải được danh sách khách.",
    /** Chọn khách cho việc mới — chỉ khách ACTIVE. */
    emptyActive: "Không có khách hoạt động khớp.",
    /** Bộ lọc danh sách — mọi trạng thái khách. */
    emptyAny: "Không có khách khớp.",
    openProfileHint: "Khách chưa kích hoạt?",
    openProfile: "Mở hồ sơ khách",
    more: (remaining: number) => `Còn ${remaining} khách — gõ thêm để thu hẹp`,
    taxCode: (taxCode: string) => `MST ${taxCode}`,
  },
  // Ô chọn tệp dùng chung (components/shared/FilePickerField)
  filePicker: {
    choose: "Chọn tệp",
    change: "Đổi tệp",
    none: "Chưa chọn tệp",
  },
  // Ô chọn ngày dùng chung (components/shared/DatePicker)
  datePicker: {
    placeholder: "Chọn ngày",
    today: "Hôm nay",
    clear: "Xoá ngày",
  },
  // Ô nhập tiền dùng chung (components/shared/MoneyInput)
  moneyInput: {
    /** Dán "1,500,000.50" / "1.500.000,50": phần lẻ khác 0 bị từ chối, không bị đọc thành 150.000.050. */
    fractionRefused: "Số tiền VND không có phần lẻ",
  },
  // Ô chọn dạng cây dùng chung (components/shared/TreeSelect)
  treeSelect: {
    expand: (label: string) => `Mở ${label}`,
    collapse: (label: string) => `Thu gọn ${label}`,
  },
  // Nút rời form khi còn thay đổi chưa lưu (components/shared/DiscardChangesButton, BO-UX-5)
  discardChanges: {
    button: "Bỏ thay đổi",
    title: "Bỏ các thay đổi chưa lưu?",
    description: "Những gì bạn vừa sửa trên form này sẽ mất. Thao tác này không huỷ chứng từ.",
    confirm: "Bỏ thay đổi",
    keepEditing: "Tiếp tục sửa",
  },
  // Khung back-office (sidebar / topbar)
  shell: {
    appName: "StockFlowCommerce",
    navBack: "Quay lại",
    globalSearch: "Tìm toàn cục",
    quickSearch: "Tìm nhanh",
    quickSearchHint: "Tìm nhanh (⌘K)",
    /** Gốc breadcrumb (trước là chữ "Back-office"). */
    breadcrumbRoot: "Trang quản trị",
    /* Tên nhóm (tab) sidebar: `NAV_GROUP_LABELS` trong labels-nav.ts */
  },
  // Trạng thái lỗi khi tải dữ liệu (§8 PRODUCTION-FRONTEND-RULES)
  emptyList: {
    noResultsTitle: "Không tìm thấy kết quả",
    invalidPageTitle: "Trang không còn dữ liệu",
    invalidPageDescription: "Trang hiện tại vượt quá số trang có dữ liệu.",
    clearFilters: "Bỏ bộ lọc",
    firstPage: "Về trang đầu",
  },
  loadError: {
    networkTitle: "Không kết nối được máy chủ",
    networkDescription: "Kiểm tra kết nối mạng rồi thử lại.",
    invalidDataTitle: "Dữ liệu trả về không đúng định dạng",
    invalidDataDescription: "Máy chủ trả dữ liệu sai hợp đồng. Vui lòng báo lại cho kỹ thuật.",
    serverTitle: "Không tải được dữ liệu",
    serverDescription: "Đã xảy ra lỗi khi tải dữ liệu.",
    forbiddenTitle: "Bạn không có quyền",
    noReadTitle: "Bạn không có quyền xem dữ liệu",
    permissionsTitle: "Không tải được quyền truy cập",
    permissionsDescription:
      "Máy chủ chưa trả được danh sách quyền của tài khoản. Thử lại sau hoặc liên hệ quản trị.",
  },
  order: {
    pageTitle: "Đơn hàng",
    cancelFailedTitle: "Không huỷ được đơn",
    releaseRefusedTitle: "Không ra lệnh xuất kho được",
    creditFailedTitle: "Không xử lý được đơn chờ duyệt công nợ",
    creditHoldsTitle: "Đơn chờ duyệt công nợ",
    // Nhãn nút thao tác — dùng chung lifecycle (ORDER_ACTIONS) và component
    actions: {
      release: "Xuất kho",
      creditApprove: "Duyệt công nợ",
      creditReject: "Từ chối",
      cancel: "Huỷ đơn",
    },
    notFoundTitle: "Không tìm thấy đơn hàng",
    notFoundDescription: "Đơn hàng không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền truy cập đơn hàng.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu đơn hàng. Liên hệ quản trị để được cấp.",
  },
  receipt: {
    pageTitle: "Phiếu nhận",
    notFoundTitle: "Không tìm thấy phiếu nhận",
    notFoundDescription: "Phiếu nhận không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với phiếu nhận.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu phiếu nhận. Liên hệ quản trị để được cấp.",
    action: {
      confirm: "Xác nhận nhập kho",
      cancel: "Huỷ phiếu",
    },
    // BE 4A-8 (docs 00 rescope 04/11): bỏ mua hàng — phiếu mua hàng cũ chỉ còn đọc, huỷ được khi còn nháp
    legacyPurchase: {
      badge: "Mua hàng (cũ)",
      title: "Phiếu mua hàng cũ",
      description:
        "Mua hàng đã bỏ khỏi hệ thống: phiếu này chỉ còn để xem; phiếu còn nháp thì chỉ huỷ được. Hàng chỉ còn về theo đơn sản xuất.",
      confirmNote: "Phiếu mua hàng cũ không xác nhận được — chỉ huỷ được khi còn nháp.",
    },
    receiptType: {
      PRODUCTION: "Đơn sản xuất",
      PURCHASE: "Mua hàng (cũ)",
      RETURN: "Hàng hoàn",
    },
    // Lý do nút bị khoá (allowedReceiptActions)
    disabledReason: {
      noLines: "Chưa có dòng kiểm đếm — kiểm đếm trước khi xác nhận",
    },
    // Card thao tác khi không còn nút cấp phiếu
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem phiếu nhận.",
      inPutaway: "Đang chờ cất hàng lên vị trí lưu trữ.",
      openPutaway: "Xem việc cất hàng của phiếu",
    },
    noCountLines: "Chưa có dòng kiểm đếm.",
    linesDraftTitle: "Dòng kiểm đếm",
    linesConfirmedTitle: "Dòng nhận",
    linesDraftDescription: "Số đang kiểm đếm của phiếu nháp — chưa ghi nhận tồn.",
    linesConfirmedDescription: "Phiếu đã xác nhận chỉ còn xem; sai sót xử lý bằng điều chỉnh tồn.",
    linesCancelledDescription: "Phiếu đã huỷ trước khi xác nhận — không nhập kho, chỉ còn xem.",
    // Nhãn trường dùng chung giữa thông tin phiếu và cột danh sách
    field: {
      receiptType: "Loại phiếu",
      productionOrder: "Đơn sản xuất",
      producer: "Đơn vị sản xuất",
    },
    // Cột tiến độ thùng theo dòng Đơn sản xuất (4A-5)
    productionProgress: {
      header: "Thùng theo Đơn SX",
      // Có đơn vị "thùng" để số "10/10" không đứng trần
      cartonsOfOrdered: (received: number, ordered: number) => `${received}/${ordered} thùng`,
      thisReceipt: (cartons: number) => `phiếu này ${cartons} thùng`,
      remaining: (cartons: number) => `còn ${cartons} thùng`,
    },
    confirmDialog: {
      cancelTitle: "Huỷ phiếu nhận",
      confirmDescription: (number: string) =>
        `Chốt số của ${number}: các thùng thành tồn đang nhận ở khu nhận hàng, đơn sản xuất cập nhật SL đã nhận, phiếu chuyển sang cất hàng. Sau khi xác nhận phiếu chỉ còn xem, sai sót phải điều chỉnh tồn.`,
      cancelDescription: (number: string) =>
        `Huỷ ${number}? Chỉ phiếu nháp mới huỷ được; thùng đã cấp mã bị huỷ theo. Không thể khôi phục.`,
    },
    dateRangeInvalid: "Ngày bắt đầu sau ngày kết thúc — không có phiếu nào khớp.",
  },
  shipping: SHIPPING_UI_LABELS,
  vehicleType: VEHICLE_TYPE_UI_LABELS,
  warehouseCapacity: WAREHOUSE_CAPACITY_UI_LABELS,
  warehouseMap: WAREHOUSE_MAP_UI_LABELS,
  loadPlan: LOAD_PLAN_UI_LABELS,
  taxonomy: TAXONOMY_UI_LABELS,
  inventoryItem: INVENTORY_ITEM_UI_LABELS,
  cartonSpec: CARTON_SPEC_UI_LABELS,
  product: PRODUCT_UI_LABELS,
  cartonCheck: CARTON_CHECK_UI_LABELS,
  fulfillment: {
    pickingTitle: "Lấy hàng",
    pickingSubtitle: "Nhiệm vụ lấy hàng theo đơn: gán nhân viên, bắt đầu và hoàn tất lấy hàng.",
    packingTitle: "Kiểm thùng & dán nhãn giao hàng",
    packingSubtitle:
      "Quét LPN từng thùng, dán nhãn giao hàng, loại thùng hư hỏng và hoàn tất thành lô giao.",
    notFoundTitle: "Không tìm thấy nhiệm vụ lấy hàng",
    // BE trả 404 (không phải 403) khi task không được gán cho người gọi
    notFoundDescription:
      "Nhiệm vụ không tồn tại, hoặc không được gán cho bạn nên bạn không xem được.",
    // Link cũ tới task mà BE không trả kho (`warehouseId` null) — không biết mở trong tab của kho nào
    noWarehouseTitle: "Nhiệm vụ chưa gắn kho",
    noWarehouseDescription:
      "Không xác định được kho của nhiệm vụ nên không mở được trong tab theo kho. Chọn kho đang làm việc để mở nhiệm vụ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền mở màn hình này.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem nhiệm vụ lấy hàng. Liên hệ quản trị để được cấp.",
    action: {
      create: "Tạo nhiệm vụ lấy hàng",
      assign: "Gán lại",
      changeDestination: "Đổi đích",
      startPicking: "Bắt đầu lấy hàng",
      completePicking: "Hoàn tất lấy hàng",
      moveToDispatch: "Chuyển sang khu xuất hàng",
      // Docs 07 §4.3 bước 7: thêm thùng còn thiếu đã về kho vào cùng task (BE `POST …/top-up`)
      topUp: "Lấy bổ sung",
      openPacking: "Mở trạm kiểm thùng",
      openPicking: "Xem lấy hàng",
    },
    // Lọc danh sách task (BE `GET /fulfillment/tasks?status&warehouseId&assignedUserId`, SCRUM-466)
    filter: {
      warehouse: "Kho",
      status: "Trạng thái",
      assignee: "Người được gán",
      allWarehouses: "Tất cả kho",
      allStatuses: "Tất cả trạng thái",
      allAssignees: "Tất cả người",
      pickWarehouseFirst: "Chọn kho trước",
      // Lọc người từ link (?assignee=) mà chưa có tên để hiện — không lộ id người dùng
      filteredAssignee: "Người đang lọc",
      clear: "Bỏ lọc",
      clearWarehouse: "Bỏ lọc kho",
      noMatchTitle: "Không có nhiệm vụ khớp bộ lọc",
      noMatchDescription: "Thử bỏ bớt bộ lọc để xem thêm nhiệm vụ.",
      outOfScope: "Kho này nằm ngoài phạm vi dữ liệu của bạn.",
      assigneesFailed: "Không tải được danh sách người được gán.",
      // Lọc người được gán trên header cột (data-table-mode-a §4.1)
      assigneeSearch: "Tìm người…",
      assigneeEmpty: "Không có người phù hợp.",
      // Chip thanh "Cấu hình" — phạm vi dữ liệu do BE quyết theo mã quyền (task-oversight:READ)
      scope: "Phạm vi",
      scopeAll: "mọi nhiệm vụ",
      scopeOwn: "nhiệm vụ được gán cho bạn",
      columns: "Cột hiển thị",
      actions: "Thao tác",
    },
    // Dialog tạo task: đơn chờ xuất kho đọc từ GET /fulfillment/task-candidates (cần fulfillment-task-assignment:CREATE)
    // Docs 07 §4.1 bước 1–2: đơn đã release, hoặc đơn chờ hàng lấy trước phần đã giữ
    createDescription:
      "Chọn đơn đã có lệnh xuất kho, hoặc đơn đang chờ hàng để lấy trước phần đã có, và gán nhân viên lấy hàng. Mỗi đơn chỉ có một nhiệm vụ.",
    noCreateTitle: "Chưa đủ quyền tạo nhiệm vụ lấy hàng",
    noCreateDescription:
      "Tài khoản chưa được cấp quyền tạo nhiệm vụ lấy hàng — liên hệ quản trị để được cấp.",
    candidate: {
      fieldLabel: "Đơn hàng",
      loading: "Đang tải đơn hàng…",
      placeholder: "Chọn đơn hàng",
      search: "Gõ số đơn hoặc tên khách…",
      noMatch: "Không có đơn nào khớp.",
      empty: "Không có đơn nào chờ xuất kho",
      emptyTitle: "Chưa có đơn nào chờ xuất kho",
      emptyDescription:
        "Chỉ đơn đã có lệnh xuất kho và chưa có nhiệm vụ — kể cả đợt giao kế tiếp đã có lệnh xuất kho — hoặc đơn đang chờ hàng đã giữ được một phần thùng mới hiện ở đây. Đơn mới xác nhận cần ra lệnh xuất kho trước.",
      // Docs 07 §4.1 bước 1: đơn Awaiting Stock có thùng đã giữ — lấy trước phần đã có
      awaitingStock: "Chờ hàng",
      loadFailed: "Không tải được danh sách đơn hàng chờ xuất kho.",
      guestCustomer: "Khách vãng lai",
      truncated: (shown: number, total: number) =>
        `Chỉ hiện ${shown}/${total} đơn cũ nhất đang chờ — tạo nhiệm vụ cho các đơn này trước để thấy tiếp.`,
      summary: (lineCount: number, totalQuantity: number) =>
        `${lineCount} dòng · ${totalQuantity} sản phẩm`,
      placed: (date: string) => `Đặt ${date}`,
    },
    noAssignTitle: "Chưa đủ quyền chọn người nhận nhiệm vụ",
    noAssignDescription:
      "Danh sách người nhận nhiệm vụ chỉ hiện cho tài khoản được cấp quyền gán nhiệm vụ — liên hệ quản trị để được cấp.",
    alreadyAssigned: "Nhiệm vụ đang được gán cho người này — chọn người khác để gán lại.",
    noTaskLines: "Nhiệm vụ chưa có dòng hàng.",
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem nhiệm vụ này.",
      notAssignee: "Chỉ nhân viên được gán mới thao tác được trên nhiệm vụ này.",
      waitingPick: "Chưa lấy hàng xong nên chưa đóng gói được.",
      // Task Staged: thùng giữ riêng ở khu chờ xuất, chỉ quản lý kho (task-assignment:UPDATE) chuyển được (docs 07 §4.3)
      waitingDispatch: "Thùng đang ở khu chờ xuất — chờ quản lý kho chuyển sang khu xuất hàng.",
    },
    // Đích lấy hàng của task (BE `PickDestination`, docs 07 §1, §3): chọn khi tạo task
    destination: {
      fieldLabel: "Đích lấy hàng",
      DISPATCH: "Khu xuất hàng",
      STAGING: "Khu chờ xuất",
      DISPATCH_HINT: "Đơn xuất ngay: tồn bị trừ khi quét xác nhận từng thùng.",
      STAGING_HINT:
        "Giữ riêng thùng cho đơn (chờ đủ hàng hoặc chờ khách thanh toán): chỉ chuyển vị trí, chưa trừ tồn.",
      stagingArea: "Khu chờ xuất của kho",
      stagingAreaPlaceholder: "Chọn khu chờ xuất",
      // Kho có đúng một khu chờ xuất đang hoạt động: BE tự chọn, không cần gửi mã khu
      stagingAreaSingle: (code: string) => `Dùng khu chờ xuất ${code} của kho.`,
      stagingAreaNone:
        "Kho của đơn này chưa có khu chờ xuất đang hoạt động — chọn đích khu xuất hàng, hoặc nhờ quản trị kho tạo khu chờ xuất.",
      stagingAreasFailed:
        "Không tải được sơ đồ kho — để trống, máy chủ tự chọn khu chờ xuất nếu kho chỉ có một.",
      stagingAreaRequired: "Chọn khu chờ xuất của kho",
      // Docs 07 §4.1 bước 2, 17 §4.4 bước 15: đơn Awaiting Stock chỉ lấy sang khu xuất hàng khi Sale cho giao một phần
      awaitingStockStagingOnly:
        "Đơn đang chờ hàng: lấy trước phần đã có về khu chờ xuất. Chỉ lấy sang khu xuất hàng khi Sale đã cho phép giao một phần.",
      // Dialog "Đổi đích" của task Pending (BE `PUT …/destination`, docs 07 §4.1 bước 3, BR-08)
      changeTitle: (taskCode: string) => `Đổi đích nhiệm vụ ${taskCode}`,
      changeDescription: "Chỉ đổi đích được khi nhiệm vụ chưa bắt đầu lấy hàng.",
    },
    self: "Tôi",
    // Chữ của màn nhiệm vụ lấy hàng (đặt ở đây, không viết thẳng trong component)
    taskTitle: (code: string) => `Nhiệm vụ ${code}`,
    taskInfoTitle: "Thông tin nhiệm vụ",
    taskLinesCaption: "Dòng hàng của nhiệm vụ",
    taskEmptyTitle: "Chưa có nhiệm vụ lấy hàng",
    taskTableCaption: (shown: number, total: number) =>
      `Hiển thị ${shown} / ${total} nhiệm vụ lấy hàng`,
    viewTask: (code: string) => `Xem nhiệm vụ ${code}`,
    assignTask: (code: string) => `Gán lại nhiệm vụ ${code}`,
    assignDescription:
      "Chỉ gán lại được khi nhiệm vụ chưa bắt đầu lấy hàng. Người được gán phải là nhân viên kho hoặc quản lý kho đang hoạt động.",
    confirm: {
      completePicking: (code: string) =>
        `Xác nhận đã lấy đủ thùng của nhiệm vụ ${code}? Thao tác không hoàn lại được.`,
      moveToDispatch: (code: string) =>
        `Chuyển cả nhiệm vụ ${code} từ khu chờ xuất sang khu xuất hàng? Tồn của mọi thùng trong nhiệm vụ sẽ bị trừ và thao tác không hoàn lại được.`,
      topUp: (code: string) =>
        `Lấy bổ sung cho nhiệm vụ ${code}? Các thùng đơn đã giữ thêm được đưa vào cùng nhiệm vụ và nhiệm vụ quay lại Đang lấy hàng.`,
    },
    // Nhãn trường dùng chung giữa cột danh sách, thẻ thông tin và form
    field: {
      task: "Số nhiệm vụ",
      order: "Đơn hàng",
      assignee: "Người được gán",
      pick: "Lấy hàng",
      pack: "Đóng gói",
      assignedAt: "Ngày gán",
      packedAt: "Đóng gói xong",
      destination: "Đích lấy hàng",
      stagingLocation: "Khu chờ xuất",
      stagedAt: "Về khu chờ xuất lúc",
      movedToDispatchAt: "Chuyển sang khu xuất hàng lúc",
    },
  },
} as const;

/**
 * Lỗi task xuất kho → câu tiếng Việt. BE (FulfillmentServiceImpl) chỉ ném mã chung
 * `NOT_FOUND` / `CONFLICT` / `VALIDATION_FAILED` kèm message tiếng Anh, không có mã riêng — nên
 * câu hiển thị chọn theo NGỮ CẢNH thao tác (xem `features/fulfillment/errors.ts`).
 */
export const FULFILLMENT_ERROR_MESSAGES = {
  // 404 ở thao tác: task không có hoặc người gọi không phải người được gán
  notAssignee: "Nhiệm vụ không tồn tại hoặc không được gán cho bạn. Dữ liệu đã được tải lại.",
  // 409 chung: pick/pack/đơn đã đổi trạng thái ở nơi khác (hoặc đơn đã huỷ → task đóng)
  stale:
    "Nhiệm vụ hoặc đơn hàng đã đổi trạng thái nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  createConflict:
    "Chỉ đơn đã có lệnh xuất kho mới tạo được nhiệm vụ lấy hàng; đơn mới xác nhận phải được quản lý kho xuất kho trước.",
  // 422 STAGING_AREA_INVALID: khu chờ xuất không phải khu đang hoạt động của kho xuất (docs 07 §4.1 bước 2)
  STAGING_AREA_INVALID: "Chọn khu chờ xuất đang hoạt động của kho xuất của đơn.",
  // 409 PICK_ORDER_ON_HOLD khi chuyển sang khu xuất hàng: đơn đang treo (docs 07 §6 "Đơn đang treo khi task Staged")
  PICK_ORDER_ON_HOLD:
    "Đơn đang tạm giữ nên chưa chuyển sang khu xuất hàng được — thùng vẫn ở khu chờ xuất. Gỡ treo đơn rồi thử lại.",
  // 409 khi tạo task / đổi đích: đơn Awaiting Stock chỉ lấy về khu chờ xuất, hoặc sang khu xuất hàng khi Sale cho
  // phép giao một phần (docs 07 §4.1 bước 2)
  PICK_AWAITING_STOCK_DESTINATION:
    "Đơn đang chờ hàng chỉ lấy trước về khu chờ xuất, hoặc sang khu xuất hàng khi Sale đã cho phép giao một phần.",
  // 409 khi chuyển sang khu xuất hàng: đơn còn chờ hàng mà Sale chưa cho giao một phần (docs 07 §4.3 bước 8)
  PICK_AWAITING_STOCK_NOT_READY:
    "Đơn còn chờ hàng nên thùng ở lại khu chờ xuất — chờ đủ hàng rồi lấy bổ sung, hoặc Sale cho phép giao một phần.",
  // 409 khi lấy bổ sung: task đã huỷ hoặc đã hoàn tất kiểm thùng (thùng đã thành shipment) — docs 07 §4.3 bước 7
  topUpConflict:
    "Nhiệm vụ không còn nhận thêm thùng (đã huỷ hoặc đã hoàn tất kiểm thùng). Dữ liệu đã được tải lại.",
  dispatchConflict:
    "Nhiệm vụ không còn ở trạng thái Đã tập kết (khu chờ xuất) nên không chuyển được. Dữ liệu đã được tải lại.",
  orderNotFound: "Không tìm thấy đơn hàng",
  assignConflict: "Chỉ gán lại được khi nhiệm vụ chưa bắt đầu lấy hàng. Dữ liệu đã được tải lại.",
  // 409 PICK_TASK_STATE_CONFLICT khi đổi đích: task đã bắt đầu lấy hàng (docs 07 §4.1 bước 3, BR-08)
  destinationConflict:
    "Chỉ đổi đích được khi nhiệm vụ chưa bắt đầu lấy hàng. Dữ liệu đã được tải lại.",
  assigneeInvalid: "Người được gán phải là nhân viên kho hoặc quản lý kho đang hoạt động",
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  // Danh sách đơn chờ xuất kho (GET /fulfillment/task-candidates): 403 thiếu quyền tạo task, 403 kho ngoài
  // phạm vi dữ liệu, 404 kho không tồn tại
  candidatesForbidden:
    "Bạn chưa được cấp quyền tạo nhiệm vụ lấy hàng nên không xem được đơn chờ xuất kho.",
  OUT_OF_DATA_SCOPE:
    "Kho này nằm ngoài phạm vi dữ liệu của bạn — bạn chỉ xem được đơn của kho mình phụ trách.",
  warehouseNotFound: "Không tìm thấy kho.",
  // 409 khi tạo task / bắt đầu lấy hàng / phân bổ lại: hàng giữ cho đơn nằm ở kho khác kho xuất (BE
  // FulfillmentServiceImpl#pickingWarehouse, PickList.plan / replaceShort — release không kiểm nơi giữ hàng)
  FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE:
    "Hàng giữ cho đơn đang nằm ở kho khác kho xuất — cần lệnh chuyển kho đưa hàng về đúng kho rồi mới lấy hàng.",
  // 409 khi hoàn tất mà BE còn dòng chưa lấy (BE `PickList.requireAllPicked` / task chưa lập dòng)
  PICK_LINES_INCOMPLETE: "Còn dòng chưa lấy xong nên chưa hoàn tất được. Dữ liệu đã được tải lại.",
  OPTIMISTIC_LOCK: "Nhiệm vụ vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  LOCK_TIMEOUT: "Nhiệm vụ đang được người khác thao tác. Thử lại sau giây lát.",
  STORAGE_ERROR: "Kho lưu trữ file thiết kế đang không truy cập được. Thử lại sau.",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;

/** Lỗi validate form task xuất kho (zod Input) — hiện inline dưới ô. */
export const FULFILLMENT_FIELD_MESSAGES = {
  orderRequired: "Chọn đơn hàng",
  assigneeRequired: "Chọn nhân viên được gán",
  resolutionNoteRequired: "Nhập cách đã xử lý",
  resolutionNoteTooLong: "Tối đa 1000 ký tự",
  // BE ConfirmPickRequest / ShortPickRequest: locationCode @NotBlank @Size(max = 64)
  locationRequired: "Chọn vị trí",
  codeTooLong: "Tối đa 64 ký tự",
  // BE ConfirmPickRequest / PutBackRequest: lpn @NotBlank @Size(max = 30); ShortPickRequest: reason @NotNull
  lpnRequired: "Quét hoặc nhập mã LPN của thùng",
  lpnTooLong: "Tối đa 30 ký tự",
  shortReasonRequired: "Chọn lý do báo thiếu",
} as const;

/**
 * BE `errorCode` của goods receipt (ErrorCode.java + `GoodsReceiptController` sau 4A-9) → câu tiếng Việt. Message BE
 * là tiếng Anh, có mã đơn / UUID — không hiển thị thô.
 */
export const RECEIPT_ERROR_MESSAGES = {
  GOODS_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhận",
  // BR-01 / BR-15 (docs 03 §6): chỉ nhận cho Đơn sản xuất nhận được hàng, tại đúng kho nhận
  PRODUCTION_ORDER_NOT_RECEIVABLE:
    "Đơn sản xuất không còn nhận được hàng (chưa gửi, đã nhận đủ, đã đóng hoặc huỷ). Dữ liệu đã được tải lại.",
  // BR-02 (docs 03 §6): không nhận quá số thùng Đơn sản xuất đặt, tính cả phiếu nháp
  RECEIPT_EXCEEDS_PRODUCTION_ORDER: "Số thùng nhận vượt số thùng còn lại của dòng đơn sản xuất",
  RECEIPT_LINE_NOT_ON_PRODUCTION_ORDER: "Dòng này không thuộc đơn sản xuất của phiếu",
  // BR-13 (docs 03 §6): mỗi thùng chứa đúng quy cách của dòng
  RECEIPT_CARTON_NOT_STANDARD: "Thùng phải chứa đúng số lượng chuẩn của quy cách thùng",
  LOCATION_NOT_FOUND: "Không tìm thấy mã vị trí",
  LOCATION_AREA_MISMATCH: "Mã vị trí không đúng loại khu của kho này",
  INVALID_RECEIPT_TRANSITION:
    "Phiếu nhận đã đổi trạng thái nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho",
  INVENTORY_ITEM_NOT_FOUND: "Không có SKU này trong danh mục mặt hàng kho",
  // SCRUM-473: thùng có LPN, in nhãn
  ...RECEIPT_CARTON_ERROR_MESSAGES,
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  OPTIMISTIC_LOCK: "Phiếu vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  CONTRACT_MISMATCH: "Dữ liệu trả về không đúng định dạng",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;

/** Lỗi validate form phiếu nhận (zod Input) — hiện inline dưới ô. */
export const RECEIPT_FIELD_MESSAGES = {
  purchaseOrderRequired: "Chọn đơn đặt hàng",
  linesRequired: "Cần ít nhất một dòng kiểm đếm",
  linesTooMany: "Tối đa 200 dòng mỗi phiếu",
  quantity: "SL nhận phải là số nguyên > 0",
  locationRequired: "Nhập hoặc quét mã vị trí",
  tooLong: "Quá dài",
  lotRequired: "SKU theo dõi lô — nhập số lô",
  expiryRequired: "SKU theo dõi hạn dùng — nhập hạn dùng",
  expiryInvalid: "Ngày không hợp lệ",
  expiryNotAfterReceipt: "Hạn dùng phải sau ngày nhận",
  overLimit: "Tổng SL nhận của dòng PO vượt SL đặt cộng dung sai",
  duplicateLot: "Dòng PO này đã có một dòng cùng số lô — gộp SL của một lô vào một dòng",
  approvalReasonRequired: "Nhập lý do",
  supplierRequired: "Chọn nhà cung cấp",
  warehouseRequired: "Chọn kho nhận",
  blindReasonRequired: "Nhập lý do không có PO",
  skuRequired: "Nhập SKU",
} as const;

export const TOAST_MESSAGES = {
  putaway: {
    confirmed: (lpn: string, locationCode: string) => `Đã cất thùng ${lpn} vào ${locationCode}`,
  },
  form: {
    saveBlocked: "Chưa thể lưu",
    checkForm: "Kiểm tra lại biểu mẫu",
  },
  order: {
    cancelled: "Đã huỷ đơn hàng",
    released: "Đã ra lệnh xuất kho cho đơn",
    creditApproved: "Đã duyệt công nợ",
    creditRejected: "Đã từ chối duyệt công nợ",
  },
  receipt: {
    created: "Đã lập phiếu nhập",
    counted: "Đã lưu kiểm đếm",
    confirmed: "Đã xác nhận nhập kho",
    cancelled: "Đã huỷ phiếu nhận",
  },
  shipping: SHIPPING_TOAST_MESSAGES,
  vehicleType: VEHICLE_TYPE_TOAST_MESSAGES,
  warehouseCapacity: WAREHOUSE_CAPACITY_TOAST_MESSAGES,
  warehouseMap: WAREHOUSE_MAP_TOAST_MESSAGES,
  loadPlan: LOAD_PLAN_TOAST_MESSAGES,
  taxonomy: TAXONOMY_TOAST_MESSAGES,
  user: IDENTITY_TOAST_MESSAGES.user,
  role: IDENTITY_TOAST_MESSAGES.role,
  inventoryItem: INVENTORY_ITEM_TOAST_MESSAGES,
  fulfillment: {
    created: "Đã tạo nhiệm vụ lấy hàng",
    // BE trả lại task đã có của đơn (vẫn 201) thay vì tạo mới
    alreadyExists: "Đơn này đã có nhiệm vụ và đang gán cho người khác — không tạo nhiệm vụ mới",
    assigned: "Đã gán nhiệm vụ",
    destinationChanged: "Đã đổi đích lấy hàng",
    pickingStarted: "Đã bắt đầu lấy hàng",
    pickingCompleted: "Đã hoàn tất lấy hàng",
    // Chuyển cả tác vụ từ khu chờ xuất sang khu xuất hàng (BE `POST …/dispatch-transfer`, docs 07 §4.3 bước 8)
    movedToDispatch: "Đã chuyển nhiệm vụ sang khu xuất hàng — tồn đã được trừ",
    // Lấy bổ sung (BE `POST …/top-up`, docs 07 §4.3 bước 7): thùng còn thiếu đã về kho thêm vào cùng task
    toppedUp: "Đã thêm thùng vào nhiệm vụ — nhiệm vụ quay lại lấy hàng",
    // Phân bổ lại dòng thiếu (BE `POST …/pick-lines/{lineId}/reallocation`, PR #147)
    lineReallocated: "Đã phân bổ lại dòng thiếu",
    linesPlanned: "Đã tạo danh sách dòng lấy hàng",
    // Báo thiếu thùng (BE `POST …/pick-lines/{lineId}/short`, docs 07 §4.4): đơn tạm giữ, chờ phân bổ lại
    shortReported: (sku: string, lpn: string | null | undefined) =>
      `Đã báo thiếu ${lpn ? `thùng ${lpn} (${sku})` : sku}`,
    // Cất lại nguyên thùng (BE `POST …/pick-lines/{lineId}/put-back`, docs 07 §4.5 bước 14)
    putBack: (lpn: string | null | undefined, sku: string, location: string) =>
      `Đã cất ${lpn ? `thùng ${lpn}` : sku} về ${location}`,
  },
  cartonCheck: CARTON_CHECK_TOAST_MESSAGES,
} as const;
