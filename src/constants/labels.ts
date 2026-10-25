/**
 * Nhãn UI + nội dung toast dùng lại ≥2 lần (§15 — không hardcode string).
 */

import { IDENTITY_TOAST_MESSAGES } from "./labels-identity";
import { INVENTORY_ITEM_TOAST_MESSAGES, INVENTORY_ITEM_UI_LABELS } from "./labels-inventory-item";
import { LOAD_PLAN_TOAST_MESSAGES, LOAD_PLAN_UI_LABELS } from "./labels-load-plan";
import { PACKING_TOAST_MESSAGES, PACKING_UI_LABELS } from "./labels-packing";
import { PRODUCT_UI_LABELS } from "./labels-product";
import { SHIPPING_TOAST_MESSAGES, SHIPPING_UI_LABELS } from "./labels-shipping";
import { TAXONOMY_TOAST_MESSAGES, TAXONOMY_UI_LABELS } from "./labels-taxonomy";
import { TRANSFER_TOAST_MESSAGES, TRANSFER_UI_LABELS } from "./labels-transfer";
import { TRANSFER_PACK_TOAST_MESSAGES, TRANSFER_PACK_UI_LABELS } from "./labels-transfer-pack";
import { VEHICLE_TYPE_TOAST_MESSAGES, VEHICLE_TYPE_UI_LABELS } from "./labels-vehicle-type";

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
  // Ô chọn ngày dùng chung (components/shared/DatePicker)
  datePicker: {
    placeholder: "Chọn ngày",
    today: "Hôm nay",
    clear: "Xoá ngày",
  },
  // Ô chọn dạng cây dùng chung (components/shared/TreeSelect)
  treeSelect: {
    expand: (label: string) => `Mở ${label}`,
    collapse: (label: string) => `Thu gọn ${label}`,
  },
  // Khung back-office (sidebar / topbar)
  shell: {
    appName: "StockFlowCommerce",
    navBack: "Quay lại",
    globalSearch: "Tìm toàn cục",
    quickSearch: "Tìm nhanh",
    quickSearchHint: "Tìm nhanh (⌘K)",
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
    notFoundTitle: "Không tìm thấy đơn hàng",
    notFoundDescription: "Đơn hàng không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền truy cập đơn hàng.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu đơn hàng. Liên hệ quản trị để được cấp.",
  },
  supplier: {
    pageTitle: "Nhà cung cấp",
    notFoundTitle: "Không tìm thấy nhà cung cấp",
    notFoundDescription: "Mã nhà cung cấp không tồn tại hoặc đã bị xoá.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với nhà cung cấp.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu nhà cung cấp. Liên hệ quản trị để được cấp.",
  },
  purchaseOrder: {
    pageTitle: "Đơn đặt NCC",
    notFoundTitle: "Không tìm thấy đơn đặt hàng",
    notFoundDescription: "Đơn đặt hàng không tồn tại hoặc đã bị xoá.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với đơn đặt hàng.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu đơn đặt hàng. Liên hệ quản trị để được cấp.",
    supplierFilter: "Đang lọc theo NCC",
    clearSupplierFilter: "Bỏ lọc NCC",
    createAction: "Tạo đơn đặt hàng",
    createSubtitle:
      "Chọn nhà cung cấp, thêm dòng SKU — PO được tạo ở trạng thái Nháp, duyệt ở màn chi tiết.",
    creating: "Đang tạo...",
    backToList: "Quay lại danh sách",
    createConfirmDescription: (lines: number, total: string) =>
      `Xác nhận tạo PO với ${lines} dòng hàng, tổng ${total}? PO được tạo ở trạng thái Nháp.`,
    // BE SCRUM-462 `PUT /purchase-orders/{id}` — màn sửa PO nháp (#30).
    editAction: "Lưu thay đổi",
    draftEdit: {
      title: (poNumber: string) => `Sửa nháp ${poNumber}`,
      subtitle:
        "Sửa kho nhận, ngày giao, ghi chú và dòng hàng. Nhà cung cấp và tiền tệ giữ nguyên; dòng đã lưu giữ giá đã thương lượng.",
      saving: "Đang lưu...",
      backToDetail: "Về chi tiết đơn",
      reviewTitle: "Rà soát trước khi lưu",
      reviewDescription: "Tổng hợp nháp và các mục cần kiểm tra trước khi lưu thay đổi.",
      afterSave: "Đơn vẫn ở trạng thái Nháp; gửi duyệt ở màn chi tiết.",
      confirmDescription: (lines: number, total: string) =>
        `Lưu nháp với ${lines} dòng hàng, tổng ${total}? Dòng bị xoá khỏi danh sách sẽ bị xoá khỏi đơn.`,
      // Form đang mở, refetch nền thấy đơn không còn là nháp thường (vd người khác đã gửi duyệt)
      statusChanged:
        "Đơn vừa đổi trạng thái nên không lưu được thay đổi nữa. Sao chép phần cần giữ rồi về màn chi tiết.",
      permissionLost:
        "Bạn không còn quyền sửa đơn đặt hàng nên không lưu được thay đổi. Sao chép phần cần giữ rồi về màn chi tiết.",
      notEditableTitle: "Không sửa được đơn này",
      notEditableDescription:
        "Chỉ sửa được PO thường đang ở trạng thái Nháp. Đơn đã gửi duyệt thì trả về nháp (từ chối duyệt) rồi mới sửa.",
      readOnlyHint: "Không đổi được sau khi tạo đơn (BR-07).",
      stepIssuesTitle: "Cần xử lý trước khi lưu thay đổi",
      // BE `ProcurementServiceImpl#requireReceivingWarehouse`: kho nhận phải ACTIVE + trong phạm vi
      warehouseInactive: "Kho nhận của đơn không còn hoạt động — chọn kho khác để lưu.",
      warehouseInactiveTag: "(không còn hoạt động)",
      linesEmpty: "Chưa có dòng hàng. Cần ít nhất một dòng trước khi lưu.",
      // Có PO:UPDATE nhưng thiếu procurement-supplier-items:READ — BE PUT không đòi quyền danh mục
      noCatalogPermission:
        "Bạn không có quyền xem danh mục hàng của NCC: chỉ sửa được dòng đã lưu, không thêm được dòng mới. Hệ thống vẫn kiểm điều khoản khi lưu.",
      // Thiếu quyền danh mục: xoá dòng đã lưu thì không thêm lại được trong màn này
      removeSavedLineTitle: "Xoá dòng đã lưu?",
      removeSavedLineDescription: (sku: string) =>
        `Bạn không có quyền xem danh mục NCC nên không thêm lại được dòng ${sku} sau khi xoá. Khi lưu, dòng này bị xoá khỏi đơn.`,
      removeSavedLineConfirm: "Xoá dòng",
      // BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200)
      linesLimit: (max: number) =>
        `Đơn nháp tối đa ${max} dòng hàng — xoá bớt dòng để thêm dòng mới.`,
      linesMaxError: (max: number) => `Tối đa ${max} dòng hàng`,
    },
    stepIssuesTitle: "Cần xử lý trước khi tạo PO",
    linesEmpty: "Chưa có dòng hàng. Cần ít nhất một dòng trước khi tạo PO.",
    suppliersLoadFailedTitle: "Không tải được danh sách nhà cung cấp",
    suppliersLoadFailed: "Cần quyền xem nhà cung cấp để chọn NCC cho đơn.",
    // Ô kho nhận (SCRUM-390) — dùng chung màn tạo + sửa nháp
    warehouseField: {
      label: "Kho nhận hàng",
      loading: "Đang tải…",
      placeholder: "Chọn kho",
      loadFailed: "Không tải được danh sách kho — thử lại để chọn kho nhận hàng.",
      editLoadFailed: "Không tải được danh sách kho — đơn vẫn giữ kho đang chọn.",
    },
    // Bước Dòng hàng của wizard PO
    linesStep: {
      title: "Dòng hàng",
      description:
        "Chọn SKU trong danh mục của nhà cung cấp, số lượng theo MOQ và quy cách; đơn giá điền sẵn theo danh mục khi cùng tiền tệ PO — tổng = số lượng × đơn giá.",
      add: "Thêm dòng hàng",
      // Sửa nháp: dòng đã lưu giữ giá đã thương lượng (issue #30 §2), chỉ dòng mới điền giá danh mục
      // Sửa nháp thiếu quyền đọc danh mục NCC: không thêm được dòng mới
      editDescriptionNoCatalog:
        "Dòng đã lưu giữ đơn giá đã thương lượng; sửa số lượng, mô tả hoặc xoá dòng — tổng = số lượng × đơn giá.",
      editDescription:
        "Dòng đã lưu giữ đơn giá đã thương lượng; dòng mới chọn SKU trong danh mục của nhà cung cấp, số lượng theo MOQ và quy cách, đơn giá điền sẵn khi cùng tiền tệ PO — tổng = số lượng × đơn giá.",
    },
    // BE PR #71: mô tả trống ⇒ BE lấy tên sản phẩm của SKU
    lineDescriptionPlaceholder: "Bỏ trống để dùng tên sản phẩm của SKU",
    // Bước "Rà soát" của wizard tạo PO (màn sửa dùng `draftEdit.reviewTitle` / `reviewDescription`)
    review: {
      title: "Rà soát trước khi tạo PO",
      description: "Tổng hợp PO và các mục cần kiểm tra trước khi tạo.",
      warehouse: "Kho nhận hàng",
      autoDate: (date: string) => `Hệ thống tự đặt: ${date}`,
      tax: "Thuế",
      total: "Tổng PO",
      poNumber: "Số PO",
      poNumberPending: "Hệ thống tự cấp khi tạo đơn",
      statusAfterCreate: "Trạng thái sau khi tạo",
      statusAfterSave: "Trạng thái sau khi lưu",
      createHint: (action: string, status: string) =>
        `Nhấn "${action}" để tạo đơn ở trạng thái ${status}; duyệt đơn ở màn chi tiết.`,
    },
    paymentTermDays: "Thời hạn thanh toán",
    leadTimeDays: "Thời gian giao hàng",
    days: "ngày",
    supplierLoading: "Đang tải NCC…",
    invalidSupplierFilterTitle: "Bộ lọc nhà cung cấp không hợp lệ",
    invalidSupplierFilterDescription:
      "Mã nhà cung cấp trên đường dẫn không đúng. Bỏ lọc để xem toàn bộ đơn đặt hàng.",
    supplierUnavailable: "Không tải được tên NCC",
    // Nhãn dùng lại ≥2 chỗ trong module (CLAUDE.md: dùng lại ≥2 lần → constants).
    supplier: "Nhà cung cấp",
    supplierCode: "Mã NCC",
    currency: "Tiền tệ",
    currencyOfPo: "Tiền tệ của PO",
    status: "Trạng thái",
    expectedDate: "Ngày giao dự kiến",
    expectedDateShort: "Ngày giao DK",
    lines: "Dòng hàng",
    lineCount: "Số dòng",
    sku: "Mã SKU",
    skuMissing: "Chưa nhập SKU",
    orderedQty: "SL đặt",
    receivedQty: "SL nhận",
    openQty: "SL còn lại",
    unitPrice: "Đơn giá",
    grandTotal: "Tổng giá trị",
    totalAmount: "Tổng tiền",
    totals: "Tổng cộng",
    supplierResponse: "Phản hồi",
    supplierReference: "Mã tham chiếu NCC",
    notUsed: "Chưa dùng",
    /** Cột bảng + panel chi tiết lịch sử gửi NCC. */
    delivery: {
      attemptedAt: "Thời điểm gửi",
      recipient: "Người nhận",
      result: "Kết quả",
      deliveredAt: "Tới NCC lúc",
      actor: "Người cho phép",
      requestedAt: "Thời điểm",
    },
    /** Tên thao tác — nút ở panel hành động và tiêu đề dialog dùng chung. */
    action: {
      submit: "Gửi duyệt",
      // BE SCRUM-462: sửa kho, ngày giao, ghi chú, dòng hàng của PO nháp.
      edit: "Sửa nháp",
      approve: "Phê duyệt",
      reject: "Từ chối duyệt",
      send: "Xác nhận & gửi NCC",
      recordConfirmation: "Ghi nhận NCC phản hồi",
      recoverDelivery: "Khôi phục gửi NCC",
      closeShort: "Đóng thiếu",
      close: "Đóng đơn",
      // SCRUM-436: mở màn tạo phiếu nhận cho PO này (không còn nhận trực tiếp trên PO).
      receive: "Nhận hàng",
      cancel: "Huỷ PO",
    },
    validation: {
      // Dùng chung schema tạo / sửa nháp / form wizard PO
      noteMaxError: (max: number) => `Ghi chú tối đa ${max} ký tự`,
      linesMinOne: "Phải có ít nhất 1 dòng hàng",
      supplierRequired: "Chọn nhà cung cấp",
      warehouseRequired: "Chọn kho nhận hàng",
      skuRequired: "Nhập mã SKU",
      skuDuplicate: "SKU bị trùng trong PO",
      descriptionRequired: "Nhập mô tả sản phẩm",
      skuNotInCatalog: "Chọn SKU trong danh mục của NCC",
      unitPriceRequired: "Nhập đơn giá (lớn hơn 0)",
      unitPriceKeepNegotiated: "Dòng đã lưu cần giữ đơn giá đã thương lượng — nhập đơn giá",
      unitPriceCurrencyMismatch:
        "Giá danh mục tính theo {catalog}, khác tiền tệ PO ({po}) — nhập đơn giá",
      expectedDateRequired: "Nhập ngày giao dự kiến",
      /** BE `PurchaseOrder#confirm` / `#reviseDraft`: ngày giao không được trước ngày đặt (400). */
      expectedBeforeOrderDate: "Ngày giao không được trước ngày đặt hàng",
      /** `{moq}` / `{pack}` — SL tối thiểu và bội số đóng gói của dòng danh mục NCC. */
      quantityTerms: "SL tối thiểu {moq}, theo bội số {pack}",
    },
    /** Bộ chọn SKU theo danh mục hàng của NCC trên form PO (#30, BE `GET /suppliers/{id}/items`). */
    catalog: {
      skuPlaceholder: "Chọn SKU trong danh mục",
      skuSearch: "Tìm SKU hoặc mã của NCC…",
      skuEmpty: "Không tìm thấy SKU.",
      skuAria: (line: number) => `SKU dòng ${line}`,
      skuLocked: "Dòng đã lưu giữ nguyên SKU — muốn đổi SKU thì xoá dòng và thêm dòng mới.",
      needSupplier: "Chọn nhà cung cấp ở bước Thông tin PO để chọn SKU.",
      // BE #118: dòng mới cùng tiền tệ danh mục để trống giá ⇒ BE lấy giá danh mục
      pricePlaceholder: "Trống = giá danh mục",
      noPermission:
        "Bạn chưa có quyền xem danh mục hàng của NCC nên không chọn được SKU. Liên hệ quản trị để được cấp.",
      loading: "Đang tải danh mục hàng của NCC…",
      loadFailed: "Không tải được danh mục hàng của NCC.",
      empty: "NCC này chưa có SKU nào trong danh mục — thêm SKU vào danh mục trước khi đặt hàng.",
      openCatalog: "Mở danh mục hàng của NCC",
      truncated: (n: number) => `Danh mục có nhiều SKU — chỉ hiện ${n} SKU đầu.`,
      moq: (n: number) => `MOQ ${n}`,
      packSize: (n: number) => `Quy cách ${n}`,
      catalogPrice: (money: string) => `Giá danh mục ${money}`,
      leadTime: (n: number) => `Giao ${n} ngày`,
      priceFromCatalog: "theo danh mục",
      catalogPriceLines: "Dòng dùng giá danh mục",
      currencyHint: (c: string) => `Danh mục của NCC tính giá theo ${c}.`,
      applyCurrency: (c: string) => `Dùng ${c} để điền sẵn giá`,
      changeSupplierTitle: "Đổi nhà cung cấp?",
      changeSupplierDescription:
        "Các dòng hàng đang chọn SKU theo danh mục của NCC cũ (SKU, giá, MOQ) sẽ bị xoá để chọn lại theo NCC mới.",
      changeSupplierConfirm: "Đổi nhà cung cấp",
      suggestFromCatalog: "theo thời gian giao của danh mục",
      suggestFromSupplier: "theo thời gian giao của NCC",
    },
    /** BE #36 `cancellationDeliveryStatus` / `warnings` / `templateCode`. */
    cancellationNotice: "Thông báo huỷ tới NCC",
    deliveryDateInPast:
      "Ngày giao dự kiến đã qua — vẫn tạo và gửi được, nên đổi ngày hoặc thống nhất lại với NCC.",
    template: {
      "purchase-order.sent": "Gửi đơn đặt hàng",
      "purchase-order.cancelled": "Thông báo huỷ",
    },
    templateLabel: "Loại thư",
    /** Cảnh báo thẻ Gửi NCC (`deliveryAlert`). */
    deliveryAlert: {
      recoverable:
        "Lần gửi gần nhất chưa tới được NCC. Kiểm tra lịch sử gửi; người có quyền duyệt có thể khôi phục gửi.",
      retrying:
        "Lần gửi trước chưa tới được NCC — hệ thống đang tự gửi lại, trạng thái sẽ tự cập nhật.",
    },
    /** Lý do một đơn trong danh sách cần xử lý (`poAttentionReason`). */
    attention: {
      deliveryFailed: "Gửi NCC thất bại — cần khôi phục gửi",
      supplierRejected: "NCC từ chối — huỷ và tạo đơn mới",
    },
  },
  receipt: {
    pageTitle: "Phiếu nhận",
    notFoundTitle: "Không tìm thấy phiếu nhận",
    notFoundDescription: "Phiếu nhận không tồn tại hoặc đường dẫn không hợp lệ.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền thao tác này với phiếu nhận.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem dữ liệu phiếu nhận. Liên hệ quản trị để được cấp.",
    action: {
      create: "Tạo phiếu nhận",
      saveLines: "Lưu kiểm đếm",
      confirm: "Xác nhận nhập kho",
      cancel: "Huỷ phiếu",
      moveToQc: "Chuyển sang khu QC",
      inspect: "Kết luận QC",
    },
    poNotFoundTitle: "Không tìm thấy đơn đặt hàng của phiếu",
    poNotFoundDescription:
      "Không đọc được dòng của đơn đặt hàng nên chưa kiểm đếm được. Phiếu vẫn còn — có thể huỷ phiếu hoặc liên hệ quản trị.",
    noPoReadTitle: "Cần quyền xem đơn đặt hàng",
    noPoReadDescription:
      "Tạo phiếu và kiểm đếm cần đọc dòng của đơn đặt hàng (SL đặt, còn mở). Tài khoản chưa được cấp quyền xem đơn đặt hàng — liên hệ quản trị để được cấp.",
    // Luồng nhận của dòng — BE chốt `qcRequired` theo cờ SKU lúc lưu kiểm đếm (docs 03 §1)
    flow: {
      threeStep: "3 bước · qua QC",
      twoStep: "2 bước · cất thẳng",
    },
    countSaved: "Kết quả kiểm đếm đã lưu",
    countSavedDescription:
      "Số liệu do máy chủ trả về sau khi lưu — luồng của từng dòng chốt theo cờ Yêu cầu QC của SKU.",
    editCount: "Sửa kiểm đếm",
    cancelEdit: "Huỷ sửa",
    // Lý do nút bị khoá (allowedReceiptActions)
    disabledReason: {
      noLines: "Chưa có dòng kiểm đếm — lưu kiểm đếm trước khi xác nhận",
    },
    // Card thao tác khi không còn nút cấp phiếu
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem phiếu nhận.",
      inQc: "QC thực hiện theo từng dòng ở bảng Dòng nhận.",
      inPutaway: "Đang chờ cất hàng lên vị trí lưu trữ (putaway).",
    },
    draftExists: "Đơn này đã có phiếu nhận nháp — mở phiếu đó để kiểm đếm tiếp, tránh đếm trùng:",
    noCountLines: "Chưa có dòng kiểm đếm.",
    linesConfirmedDescription: "Phiếu đã xác nhận chỉ còn xem; QC thực hiện theo từng dòng.",
    linesCancelledDescription: "Phiếu đã huỷ trước khi xác nhận — không nhập kho, chỉ còn xem.",
    dateRangeInvalid: "Ngày bắt đầu sau ngày kết thúc — không có phiếu nào khớp.",
  },
  transfer: TRANSFER_UI_LABELS,
  transferPack: TRANSFER_PACK_UI_LABELS,
  shipping: SHIPPING_UI_LABELS,
  vehicleType: VEHICLE_TYPE_UI_LABELS,
  loadPlan: LOAD_PLAN_UI_LABELS,
  taxonomy: TAXONOMY_UI_LABELS,
  inventoryItem: INVENTORY_ITEM_UI_LABELS,
  product: PRODUCT_UI_LABELS,
  packing: PACKING_UI_LABELS,
  fulfillment: {
    pickingTitle: "Lấy hàng",
    pickingSubtitle: "Task xuất kho theo đơn: gán nhân viên, bắt đầu và hoàn tất lấy hàng.",
    packingTitle: "Đóng gói",
    packingSubtitle:
      "Quét kiểm, đóng kiện, cân đo, in nhãn và hoàn tất đóng gói; đối chiếu thiết kế đã khoá của dòng in.",
    notFoundTitle: "Không tìm thấy task xuất kho",
    // BE trả 404 (không phải 403) khi task không được gán cho người gọi
    notFoundDescription: "Task không tồn tại, hoặc không được gán cho bạn nên bạn không xem được.",
    forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền mở màn hình này.",
    noReadDescription:
      "Bạn được mở trang nhưng chưa được cấp quyền xem task xuất kho. Liên hệ quản trị để được cấp.",
    action: {
      create: "Tạo task lấy hàng",
      assign: "Gán lại",
      startPicking: "Bắt đầu lấy hàng",
      completePicking: "Hoàn tất lấy hàng",
      reverify: "Kiểm tra lại thiết kế",
      openPacking: "Mở trạm đóng gói",
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
      noMatchTitle: "Không có task khớp bộ lọc",
      noMatchDescription: "Thử bỏ bớt bộ lọc để xem thêm task.",
      outOfScope: "Kho này nằm ngoài phạm vi dữ liệu của bạn.",
      assigneesFailed: "Không tải được danh sách người được gán.",
    },
    // Dialog tạo task: đơn chờ xuất kho đọc từ GET /fulfillment/task-candidates (cần fulfillment-task-assignment:CREATE)
    noCreateTitle: "Chưa đủ quyền tạo task lấy hàng",
    noCreateDescription:
      "Tài khoản chưa được cấp quyền tạo task xuất kho — liên hệ quản trị để được cấp.",
    candidate: {
      fieldLabel: "Đơn hàng",
      loading: "Đang tải đơn hàng…",
      placeholder: "Chọn đơn hàng",
      empty: "Không có đơn nào chờ xuất kho",
      emptyTitle: "Chưa có đơn nào chờ xuất kho",
      emptyDescription:
        "Chỉ đơn đã release (sẵn sàng xuất kho) và chưa có task mới hiện ở đây. Đơn mới xác nhận cần release trước.",
      loadFailed: "Không tải được danh sách đơn hàng chờ xuất kho.",
      printed: "Có dòng in",
      guestCustomer: "Khách vãng lai",
      truncated: (shown: number, total: number) =>
        `Chỉ hiện ${shown}/${total} đơn cũ nhất đang chờ — tạo task cho các đơn này trước để thấy tiếp.`,
      summary: (lineCount: number, totalQuantity: number) =>
        `${lineCount} dòng · ${totalQuantity} sản phẩm`,
      placed: (date: string) => `Đặt ${date}`,
    },
    noAssignTitle: "Chưa đủ quyền chọn người nhận task",
    noAssignDescription:
      "Danh sách người nhận task chỉ hiện cho tài khoản được cấp quyền gán task — liên hệ quản trị để được cấp.",
    // Flow X-CHK (BR-DSG-003): lệch checksum là lỗi phải chặn, không có nút bỏ qua
    holdTitle: "Kiện đang bị giữ do lệch thiết kế.",
    holdDescription:
      "Checksum file thiết kế không khớp bản khách đã chốt nên chưa được đóng gói. Quản lý kho khôi phục đúng file rồi bấm Kiểm tra lại thiết kế; không có thao tác bỏ qua.",
    stillOnHold: "Thiết kế vẫn lệch checksum — kiện tiếp tục bị giữ",
    alreadyAssigned: "Task đang được gán cho người này — chọn người khác để gán lại.",
    artifactDisclaimer:
      "File tải về từ bundle đã khoá; đường dẫn chỉ dùng được trong thời gian ngắn.",
    noDesignLines: "Đơn không có dòng tuỳ chỉnh — không cần đối chiếu thiết kế.",
    noTaskLines: "Task chưa có dòng hàng.",
    noActions: {
      viewOnly: "Bạn chỉ có quyền xem task này.",
      notAssignee: "Chỉ nhân viên được gán mới thao tác được trên task này.",
      waitingPick: "Chưa lấy hàng xong nên chưa đóng gói được.",
    },
    self: "Tôi",
    // Nhãn trường dùng chung giữa cột danh sách, thẻ thông tin và form
    field: {
      task: "Mã task",
      order: "Đơn hàng",
      assignee: "Người được gán",
      pick: "Lấy hàng",
      pack: "Đóng gói",
      assignedAt: "Ngày gán",
      packedAt: "Đóng gói xong",
    },
    // Kết quả đối chiếu checksum thiết kế (cột danh sách, thẻ dòng, lịch sử)
    integrity: {
      unverified: "Chưa đối chiếu",
      match: "Khớp",
      mismatch: "Lệch checksum",
    },
  },
} as const;

/** Nhãn vai trò file thiết kế (BE `DesignArtifactRole`) — không hiện enum thô. */
export const DESIGN_ARTIFACT_ROLE_LABELS = {
  CUSTOMER_PREVIEW: "Bản xem trước",
  TECHNICAL_SPEC: "Thông số kỹ thuật",
  PRINT_READY: "File in",
  PRODUCTION_INSTRUCTION: "Hướng dẫn sản xuất",
} as const;

/**
 * Lỗi task xuất kho → câu tiếng Việt. BE (FulfillmentServiceImpl) chỉ ném mã chung
 * `NOT_FOUND` / `CONFLICT` / `VALIDATION_FAILED` kèm message tiếng Anh, không có mã riêng — nên
 * câu hiển thị chọn theo NGỮ CẢNH thao tác (xem `features/fulfillment/errors.ts`).
 */
export const FULFILLMENT_ERROR_MESSAGES = {
  // 404 ở thao tác: task không có hoặc người gọi không phải người được gán
  notAssignee: "Task không tồn tại hoặc không được gán cho bạn. Dữ liệu đã được tải lại.",
  // 409 chung: pick/pack/đơn đã đổi trạng thái ở nơi khác (hoặc đơn đã huỷ → task đóng)
  stale:
    "Task hoặc đơn hàng đã đổi trạng thái nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  createConflict:
    "Chỉ đơn đã release (sẵn sàng xuất kho) mới đưa vào xuất kho; đơn mới xác nhận phải release trước. Đơn đang sản xuất chỉ vào xuất kho khi có dòng hàng có sẵn (lấy trước hàng in); đơn toàn hàng in phải chờ sản xuất xong.",
  orderNotFound: "Không tìm thấy đơn hàng",
  assignConflict: "Chỉ gán lại được khi task chưa bắt đầu lấy hàng. Dữ liệu đã được tải lại.",
  assigneeInvalid: "Người được gán phải là nhân viên kho hoặc quản lý kho đang hoạt động",
  // BE trả cùng mã 409 cho "pack không còn ON_HOLD" và "đơn đã rời khâu xuất kho"
  reverifyConflict:
    "Kiện không còn bị giữ, hoặc đơn hàng không còn ở khâu xuất kho. Dữ liệu đã được tải lại.",
  artifactMissing: "Bundle thiết kế đã chốt không có file này",
  // 409 PICK_TASK_STATE_CONFLICT khi tải file (BE `TaskAccess.orderInFulfilment`) — khác CONFLICT lệch checksum
  artifactOrderClosed: "Đơn đã rời khâu xuất kho nên không tải được file thiết kế.",
  // URL ký BE trả không phải http(s) — không mở để tránh chạy `javascript:` trong tab
  artifactUrlInvalid: "Đường dẫn file thiết kế không hợp lệ — không mở được. Báo bộ phận kỹ thuật.",
  popupBlocked:
    "Trình duyệt đã chặn tab mới — cho phép mở cửa sổ bật lên cho trang này rồi tải lại.",
  artifactMismatch:
    "File thiết kế trong kho lưu trữ không khớp checksum đã chốt — không tải được. Báo QC kiểm tra.",
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  // Danh sách đơn chờ xuất kho (GET /fulfillment/task-candidates): 403 thiếu quyền tạo task, 403 kho ngoài
  // phạm vi dữ liệu, 404 kho không tồn tại
  candidatesForbidden:
    "Bạn chưa được cấp quyền tạo task xuất kho nên không xem được đơn chờ xuất kho.",
  OUT_OF_DATA_SCOPE:
    "Kho này nằm ngoài phạm vi dữ liệu của bạn — bạn chỉ xem được đơn của kho mình phụ trách.",
  warehouseNotFound: "Không tìm thấy kho.",
  // 409 khi tạo task / bắt đầu lấy hàng / phân bổ lại: hàng giữ cho đơn nằm ở kho khác kho xuất (BE
  // FulfillmentServiceImpl#pickingWarehouse, PickList.plan / replaceShort — release không kiểm nơi giữ hàng)
  FULFILLMENT_HOLDS_OUTSIDE_WAREHOUSE:
    "Hàng giữ cho đơn đang nằm ở kho khác kho xuất — cần lệnh chuyển kho đưa hàng về đúng kho rồi mới lấy hàng.",
  // 409 khi hoàn tất mà BE còn dòng chưa lấy (BE `PickList.requireAllPicked` / task chưa lập dòng)
  PICK_LINES_INCOMPLETE: "Còn dòng chưa lấy xong nên chưa hoàn tất được. Dữ liệu đã được tải lại.",
  OPTIMISTIC_LOCK: "Task vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  LOCK_TIMEOUT: "Task đang được người khác thao tác. Thử lại sau giây lát.",
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
  // BE ConfirmPickRequest / ShortPickRequest: @NotBlank @Size(max = 64), quantity @NotNull @Positive
  locationRequired: "Chọn vị trí",
  codeRequired: "Chọn mã hàng",
  codeTooLong: "Tối đa 64 ký tự",
  quantityRequired: "Nhập số lượng là số nguyên lớn hơn 0",
} as const;

/**
 * BE `errorCode` (ErrorCode.java, nhánh BE `test`) → câu tiếng Việt cho màn PO.
 * Không hiển thị message thô tiếng Anh của BE (có thể chứa UUID).
 */
/** Lỗi BE của form tạo PO (fieldErrors theo tên field BE) → câu tiếng Việt hiện inline dưới ô. */
export const PO_CREATE_FIELD_MESSAGES = {
  supplierId: "Nhà cung cấp không hợp lệ",
  warehouseId: "Kho nhận không hợp lệ",
  currency: "Tiền tệ không hợp lệ",
  expectedDate: "Ngày giao dự kiến không hợp lệ",
  note: "Ghi chú không hợp lệ",
  lines: "Cần ít nhất một dòng hàng",
  skuId: "Mã SKU không hợp lệ",
  description: "Mô tả không hợp lệ",
  orderedQty: "SL đặt không hợp lệ",
  unitPrice: "Đơn giá không hợp lệ",
  taxRate: "Thuế suất không hợp lệ",
} as const;

export const PO_ERROR_MESSAGES = {
  INVALID_PURCHASE_ORDER_TRANSITION:
    "Đơn đặt hàng đã đổi trạng thái nên không thể thực hiện thao tác này. Dữ liệu đã được tải lại.",
  PURCHASE_ORDER_NOT_FOUND: "Không tìm thấy đơn đặt hàng",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp",
  SUPPLIER_INACTIVE: "Nhà cung cấp đã ngừng hợp tác, không thể tạo đơn mới",
  CONFLICT: "Yêu cầu xung đột với dữ liệu hiện tại",
  VALIDATION_FAILED: "Dữ liệu không hợp lệ",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này",
  OUT_OF_DATA_SCOPE: "Đơn đặt hàng này nằm ngoài phạm vi dữ liệu của bạn",
  OPTIMISTIC_LOCK: "Đơn vừa được người khác cập nhật. Dữ liệu đã được tải lại, hãy thử lại.",
  LOCK_TIMEOUT: "Đơn đang được xử lý ở nơi khác, thử lại sau ít giây",
  IDEMPOTENT_REQUEST_IN_PROGRESS: "Yêu cầu trước đó vẫn đang xử lý",
  EXTERNAL_SERVICE_ERROR: "Dịch vụ gửi NCC đang gặp lỗi, thử lại sau",
  AUTHORIZATION_UNAVAILABLE: "Chưa kiểm tra được quyền truy cập, thử lại sau",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  CONTRACT_MISMATCH: "Dữ liệu trả về không đúng định dạng",
  // BE #36 (9fbb90f) — mã lỗi nghiệp vụ PO/NCC. Câu nói rõ cách xử lý: thử lại thường không giúp.
  PO_DELIVERY_DATE_REQUIRED: "Cần ngày giao dự kiến trước khi gửi nhà cung cấp",
  PO_REASON_REQUIRED: "Cần nhập lý do (1–1000 ký tự)",
  PO_SUPPLIER_RESPONSE_INVALID: "Phản hồi của nhà cung cấp phải là Xác nhận hoặc Từ chối",
  PO_COMMUNICATION_NOT_CONFIGURED:
    "Chưa gửi được: hệ thống chưa cấu hình thông tin bên mua (công ty, người liên hệ, địa chỉ kho nhận). Liên hệ quản trị hệ thống — thử lại sẽ không được.",
  PO_LINE_DESCRIPTION_REQUIRED:
    "Có dòng hàng chưa có mô tả sản phẩm nên không gửi được nhà cung cấp. Huỷ PO này và tạo lại, nhập mô tả cho mọi dòng.",
  SUPPLIER_DELIVERY_CONTACT_INVALID:
    "Email/API nhận PO của nhà cung cấp không hợp lệ hoặc chưa được cho phép. Cập nhật hồ sơ nhà cung cấp rồi gửi lại.",
  SUPPLIER_PROFILE_INVALID:
    "Hồ sơ hoặc điều khoản của nhà cung cấp không hợp lệ. Cập nhật hồ sơ nhà cung cấp rồi thử lại.",
  INVALID_SUPPLIER_CONFIRMATION:
    "Không ghi nhận được phản hồi này của nhà cung cấp (đã ghi nhận trước đó hoặc trạng thái không cho phép). Dữ liệu đã được tải lại.",
  // BE PR #71 — luồng duyệt D4, kho nhận, dòng theo inventory item.
  SELF_APPROVAL_NOT_ALLOWED:
    "Bạn đã gửi duyệt đơn này nên không tự duyệt được — cần người khác phê duyệt.",
  INVENTORY_ITEM_NOT_FOUND:
    "Có SKU chưa có dữ liệu kho (inventory item). Kiểm tra lại mã SKU của sản phẩm.",
  WAREHOUSE_NOT_FOUND: "Không tìm thấy kho nhận hàng",
  WAREHOUSE_INACTIVE: "Kho nhận hàng đã ngừng hoạt động — chọn kho khác",
  warehouseOutOfScope: "Bạn không phụ trách kho nhận hàng đã chọn — chọn kho khác",
  // Gửi NCC bị 409 CONFLICT (BE ProcurementServiceImpl#publishDelivery): NCC ngừng hợp tác / thiếu
  // email-API nhận PO, hoặc lần gửi đã thành công / bị chặn. Ngày giao đã qua KHÔNG còn bị chặn
  // (BE #36 9fbb90f: chỉ cảnh báo qua `warnings` — BR-06).
  sendSupplierUnavailable:
    "Chưa gửi được nhà cung cấp: nhà cung cấp phải đang hợp tác và có email/API nhận PO, hoặc đơn đã được gửi thành công trước đó.",
  // Khôi phục gửi bị 409 CONFLICT (BE PurchaseOrder#requireDeliveryRecovery + publishDelivery).
  recoverConflict:
    "Chưa gửi lại được: chỉ gửi lại khi lần gửi trước đã thất bại hẳn; nhà cung cấp phải đang hợp tác và có email/API nhận PO. Dữ liệu đã được tải lại.",
  // BE develop (SCRUM-69/462) — điều khoản danh mục NCC, SKU không mua được, sửa PO nháp.
  SUPPLIER_TERMS_VIOLATED: "Có dòng hàng không đáp ứng điều khoản trong danh mục của nhà cung cấp",
  SUPPLIER_ITEM_NOT_LISTED: "Nhà cung cấp này không có SKU này trong danh mục",
  PO_LINE_BELOW_MOQ: "Số lượng thấp hơn số lượng đặt hàng tối thiểu của nhà cung cấp",
  PO_LINE_NOT_PACK_MULTIPLE: "Số lượng phải là bội số của quy cách đóng gói của nhà cung cấp",
  PO_LINE_PRICE_REQUIRED: "Cần nhập đơn giá: giá trong danh mục dùng loại tiền khác",
  SKU_NOT_PURCHASABLE: "SKU không ở trạng thái được đặt mua",
  PURCHASE_ORDER_NOT_EDITABLE: "Chỉ sửa được PO thường đang ở trạng thái nháp",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;

/**
 * BE `errorCode` của goods receipt (ErrorCode.java + GoodsReceiptServiceImpl, PR #62) → câu
 * tiếng Việt. Message BE là tiếng Anh, có số PO/UUID — không hiển thị thô.
 */
export const RECEIPT_ERROR_MESSAGES = {
  GOODS_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu nhận",
  PURCHASE_ORDER_NOT_FOUND: "Không tìm thấy đơn đặt hàng của phiếu nhận",
  // BR-01 (docs 03 §6)
  PURCHASE_ORDER_NOT_RECEIVABLE:
    "Đơn đặt hàng chưa chốt hoặc đã nhận xong nên không nhận hàng được. Dữ liệu đã được tải lại.",
  // BR-02 (docs 03 §6)
  OVER_RECEIPT_TOLERANCE: "Số lượng nhận vượt quá SL đặt cộng dung sai của nhà cung cấp",
  // BR-03 / BR-06 (docs 03 §6)
  RECEIPT_LOT_DATA_INVALID:
    "Thông tin lô / hạn dùng không khớp cách theo dõi của SKU (thiếu, thừa, hoặc hạn dùng không sau ngày nhận)",
  LOCATION_NOT_FOUND: "Không tìm thấy mã vị trí",
  // BE gap: cùng mã cho "sai loại khu" lẫn "kho chưa có khu QUALITY_CONTROL" (lúc xác nhận)
  LOCATION_AREA_MISMATCH: "Mã vị trí không đúng loại khu của kho này (nhận hàng / QC / cách ly)",
  INVALID_RECEIPT_TRANSITION:
    "Phiếu nhận đã đổi trạng thái nên không thực hiện được thao tác này. Dữ liệu đã được tải lại.",
  // BR-08 (docs 03 §6)
  QC_QUANTITY_MISMATCH: "Tổng Đạt + Cách ly + Không đạt phải bằng số lượng đã chuyển sang khu QC",
  // BE gap: cùng mã cho trùng dòng PO + lô, dòng không thuộc PO, khu cách ly trùng khu không đạt…
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
  qcSum: "Tổng Đạt + Cách ly + Không đạt phải bằng SL đã chuyển sang khu QC",
  qcQuantity: "Số lượng phải là số nguyên ≥ 0",
  qcLocationRequired: "Nhập mã khu cách ly",
  qcReasonRequired: "Nhập lý do",
  qcSameLocation: "Hàng cách ly và hàng không đạt phải ở hai vị trí khác nhau",
} as const;

/**
 * BE `errorCode` / tên trường ảo → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 * Nguồn mã lỗi: BE ErrorCode + SaveSupplierRequest (PR #36).
 */
export const SUPPLIER_ERROR_MESSAGES = {
  SUPPLIER_CODE_ALREADY_EXISTS: "Mã nhà cung cấp đã tồn tại",
  SUPPLIER_TAX_CODE_ALREADY_EXISTS: "Mã số thuế đã thuộc nhà cung cấp khác",
  SUPPLIER_HAS_OPEN_PURCHASE_ORDERS:
    "Nhà cung cấp còn đơn đặt hàng đang mở, không thể ngừng hợp tác",
  SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp",
  CODE_IMMUTABLE: "Không được đổi mã nhà cung cấp sau khi tạo",
  emailRequiredForEmailChannel: "Kênh Email cần có email liên hệ",
  invalidApiEndpoint:
    "Endpoint phải là địa chỉ https hợp lệ (không có query, fragment, cổng khác 443)",
  invalidPhoneDigits: "Số điện thoại phải có 8–15 chữ số",
  generic: "Dữ liệu không hợp lệ",
} as const;

/** Tên trường NCC bằng tiếng Việt — dùng chung cho form và câu báo lỗi từ BE. */
export const SUPPLIER_FIELD_LABELS = {
  code: "Mã nhà cung cấp",
  /** Dạng gọn cho bảng, card, phần rà soát. */
  codeShort: "Mã NCC",
  name: "Tên nhà cung cấp",
  taxCode: "Mã số thuế",
  contactName: "Người liên hệ",
  email: "Email",
  phone: "Số điện thoại",
  status: "Trạng thái",
  paymentTermDays: "Thời hạn thanh toán",
  leadTimeDays: "Thời gian giao hàng",
  communicationChannel: "Kênh gửi PO",
  apiEndpoint: "API endpoint",
  overReceiptTolerancePercent: "Dung sai nhận vượt",
  printSubcontractor: "NCC in gia công",
  lossTolerancePercent: "Dung sai hao hụt gia công",
  // Trường ảo của BE SaveSupplierRequest (PR #36)
  deliveryContactValid: "Kênh gửi PO",
  phoneDigitsValid: "Số điện thoại",
} as const;

/** Nhãn kênh gửi PO (BE `communicationChannel`) — không hiện enum thô EMAIL/API. */
export const SUPPLIER_CHANNEL_LABELS = {
  EMAIL: "Email",
  API: "API",
} as const;

/** Câu phụ khi BE từ chối dữ liệu đang lưu (vd seed sai định dạng). */
export const SUPPLIER_ERROR_HINTS = {
  invalidDeliveryContact: "Thông tin kênh gửi PO không hợp lệ",
  fixProfile: "cập nhật hồ sơ nhà cung cấp rồi thử lại",
} as const;

export const TOAST_MESSAGES = {
  form: {
    saveBlocked: "Chưa thể lưu",
    checkForm: "Kiểm tra lại biểu mẫu",
  },
  supplier: {
    created: "Tạo nhà cung cấp thành công",
    updated: "Cập nhật nhà cung cấp thành công",
    activated: "Đã kích hoạt lại nhà cung cấp",
    deactivated: "Đã ngừng hợp tác với nhà cung cấp",
    blacklisted: "Đã đưa nhà cung cấp vào danh sách đen",
    // Base UI: BE chưa có endpoint xuất dữ liệu NCC
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
  purchaseOrder: {
    created: "Đã tạo đơn đặt hàng",
    draftSaved: "Đã lưu đơn nháp",
    // 409 OPTIMISTIC_LOCK khi sửa nháp: giữ dữ liệu đang nhập, chỉ tải lại phiên bản mới của đơn.
    draftConflict:
      "Đơn vừa được người khác sửa. Đã tải lại phiên bản mới; dữ liệu bạn đang nhập vẫn giữ nguyên — kiểm tra lại rồi lưu.",
    // Tải lại PO sau lỗi lưu nháp thất bại (mạng / 5xx) — chưa rõ nguyên nhân, giữ form
    draftReloadFailed:
      "Chưa tải lại được đơn — dữ liệu bạn đang nhập vẫn giữ nguyên, thử lưu lại sau ít phút.",
    // 403 khi lưu nhưng tải lại được đơn (phạm vi vừa được trả lại)
    draftRetrySave: "Đơn đã sửa được trở lại — dữ liệu bạn đang nhập vẫn giữ nguyên, hãy lưu lại.",
    possibleDuplicate: "Có thể trùng đơn (BR-PO-003)",
    submitted: "Đã gửi duyệt đơn",
    approved: "Đã phê duyệt đơn",
    rejected: "Đã trả đơn về nháp",
    sent: "Đã xác nhận đơn và đưa vào hàng đợi gửi NCC",
    deliveryFailed: "Gửi NCC chưa thành công — kiểm tra lịch sử gửi",
    cancelled: "Đã huỷ đơn",
    closedShort: "Đã đóng thiếu đơn",
    closed: "Đã đóng đơn",
    deliveryRecovered: "Đã gửi lại đơn cho NCC",
    confirmationRecorded: "Đã ghi nhận phản hồi của NCC",
    actionFailed: "Không thực hiện được thao tác",
    exportNotAvailable: "Xuất Excel chưa có API — sẽ nối khi BE hỗ trợ",
  },
  receipt: {
    created: "Đã tạo phiếu nhận",
    linesSaved: "Đã lưu kiểm đếm",
    confirmed: "Đã xác nhận nhập kho",
    cancelled: "Đã huỷ phiếu nhận",
    movedToQc: "Đã chuyển hàng sang khu QC",
    inspected: "Đã ghi nhận kết luận QC",
  },
  transfer: TRANSFER_TOAST_MESSAGES,
  transferPack: TRANSFER_PACK_TOAST_MESSAGES,
  shipping: SHIPPING_TOAST_MESSAGES,
  vehicleType: VEHICLE_TYPE_TOAST_MESSAGES,
  loadPlan: LOAD_PLAN_TOAST_MESSAGES,
  taxonomy: TAXONOMY_TOAST_MESSAGES,
  user: IDENTITY_TOAST_MESSAGES.user,
  role: IDENTITY_TOAST_MESSAGES.role,
  inventoryItem: INVENTORY_ITEM_TOAST_MESSAGES,
  fulfillment: {
    created: "Đã tạo task lấy hàng",
    // BE trả lại task đã có của đơn (vẫn 201) thay vì tạo mới
    alreadyExists: "Đơn này đã có task và đang gán cho người khác — không tạo task mới",
    assigned: "Đã gán task",
    pickingStarted: "Đã bắt đầu lấy hàng",
    pickingCompleted: "Đã hoàn tất lấy hàng",
    held: "Lệch checksum thiết kế — kiện bị giữ, chờ kiểm tra lại thiết kế",
    reverified: "Thiết kế khớp — đã gỡ giữ, người đóng gói hoàn tất lại",
    // Phân bổ lại dòng thiếu (BE `POST …/pick-lines/{lineId}/reallocation`, PR #147)
    lineReallocated: "Đã phân bổ lại dòng thiếu",
    linesPlanned: "Đã tạo danh sách dòng lấy hàng",
    // Báo thiếu hàng (BE `POST …/pick-lines/{lineId}/short`, PR #147): đơn tạm giữ, chờ phân bổ lại
    shortReported: (sku: string, quantity: number) => `Đã báo thiếu ${quantity} × ${sku}`,
    // Trả hàng về kệ (BE `POST …/pick-lines/{lineId}/put-back`, SCRUM-275)
    putBack: (quantity: number, sku: string, bin: string) =>
      `Đã trả ${quantity} × ${sku} về ${bin}`,
  },
  packing: PACKING_TOAST_MESSAGES,
} as const;
