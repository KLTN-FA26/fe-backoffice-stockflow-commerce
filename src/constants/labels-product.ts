/**
 * Câu tiếng Việt cho lỗi BE khi gửi duyệt / xuất bản sản phẩm và nhãn hộp thoại từ chối duyệt
 * (BE `ProductController`). Tách khỏi `labels.ts` cho gọn, như labels-taxonomy.
 */

/** Rẽ theo `errorCode` của BE (`ErrorCode.java`), không hiện câu tiếng Anh của server. */
export const PRODUCT_ERROR_MESSAGES = {
  // BE `Product.submit` (docs 01 §3): 409 PRODUCT_BRAND_REQUIRED kèm fieldErrors[brandId] — gửi
  // duyệt chỉ có ở trang chi tiết (không có form) nên câu chỉ thẳng ô Thương hiệu ở màn Chỉnh sửa.
  brandRequired:
    "Chưa chọn Thương hiệu nên chưa gửi duyệt được — hãy Chỉnh sửa sản phẩm, chọn thương hiệu rồi gửi lại.",
  // BE `ProductPublicationAdapter.publish`: SP không còn APPROVED / PUBLISHED (vd vừa bị tạm ngưng
  // hoặc trả về Nháp ở nơi khác) — mutation đã tải lại chi tiết (isStaleProductError).
  notApproved:
    "Sản phẩm không còn ở trạng thái Đã duyệt (có thể vừa bị tạm ngưng) nên chưa xuất bản được. Dữ liệu đã được tải lại.",
  // BE `ProductPublicationAdapter.publish`: không có danh mục đang dùng gắn với sản phẩm.
  categoryRequired:
    "Chưa xuất bản được: sản phẩm cần một danh mục đang dùng — danh mục hiện tại chưa gán hoặc đã ngưng dùng.",
  // BE `ProductPublicationAdapter.publish`: không biến thể nào ở trạng thái Đang dùng (ACTIVE).
  skuRequired:
    "Chưa xuất bản được: cần ít nhất một biến thể Đang dùng — hãy kích hoạt một biến thể rồi thử lại.",
} as const;

/** Hộp thoại từ chối duyệt — BE `POST /products/{id}/rejection` (`RejectProductRequest.reason` @NotBlank). */
export const PRODUCT_REJECT_LABELS = {
  title: "Từ chối duyệt sản phẩm?",
  description:
    "Sản phẩm trở về Nháp để người soạn sửa lại. Lý do được lưu cùng sản phẩm và trong lịch sử thay đổi.",
  confirm: "Từ chối",
  reasonLabel: "Lý do từ chối",
} as const;

/** Trang chi tiết + form sản phẩm — `UI_LABELS.product` trỏ về đây. */
export const PRODUCT_UI_LABELS = {
  pageTitle: "Sản phẩm",
  // Ô chọn thương hiệu / danh mục: giá trị hiện tại đã ngưng dùng (vẫn giữ, không mời chọn cái khác)
  inactiveOption: " (đã ngưng)",
  // Trang chi tiết tải lỗi — chỉ 404 mới là "không tìm thấy" (api-conventions §8)
  notFound: {
    title: "Không tìm thấy sản phẩm",
    description: "Sản phẩm không tồn tại hoặc đã bị xoá.",
  },
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem sản phẩm này.",
  // Form sửa bị 409 OPTIMISTIC_LOCK (BE `Product.requireVersion`, `UpdateProductRequest.version`):
  // giữ nội dung đang nhập, lấy `version` mới và nêu ô người khác vừa đổi
  edit: {
    // Tên ô như nhãn trên form — dùng khi liệt kê ô bị đổi (mã sản phẩm bất biến nên không có)
    fields: {
      name: "Tên sản phẩm",
      nameEn: "Tên tiếng Anh",
      brandId: "Thương hiệu",
      categoryId: "Danh mục",
      taxClass: "Nhóm thuế",
      customizable: "Cho phép cá nhân hoá / in ấn",
      shortDescription: "Mô tả ngắn",
      description: "Mô tả tiếng Việt",
      descriptionEn: "Mô tả tiếng Anh",
    },
    checking:
      "Sản phẩm vừa được người khác sửa — đang tải bản mới nhất để so với nội dung bạn nhập…",
    stale: (changed: readonly string[]) =>
      `Sản phẩm vừa được người khác sửa${
        changed.length > 0 ? ` (người khác đổi: ${changed.join(", ")})` : ""
      }. Nội dung bạn nhập vẫn giữ nguyên — kiểm tra lại rồi bấm "Lưu thay đổi" lần nữa để lưu bản của bạn${
        changed.length > 0 ? " (ghi đè các ô trên)" : ""
      }.`,
    reloadFailed:
      "Sản phẩm vừa được người khác sửa nhưng không tải được bản mới nhất. Hãy tải lại trang rồi thử lại.",
  },
  // Thẻ trạng thái + hành động ở cột phải (như thẻ hành động trang chi tiết NCC)
  actionCard: {
    edit: "Chỉnh sửa sản phẩm",
    noActions: "Bạn không có thao tác nào với sản phẩm ở trạng thái này.",
    draftOnly: "Chỉ sản phẩm Nháp mới sửa được thông tin chung.",
  },
  // BE chỉ trả các trường này khi INACTIVE (tạm ngưng) / DISCONTINUED
  statusReason: {
    suspendedAt: "Tạm ngưng từ",
    suspendReason: "Lý do tạm ngưng",
    discontinuedAt: "Ngừng kinh doanh từ",
    discontinueReason: "Lý do ngừng kinh doanh",
  },
  // BE `TaxClass` (PR #71) → nhãn tiếng Việt
  taxClass: {
    STANDARD: "Tiêu chuẩn",
    REDUCED: "Giảm thuế",
    EXEMPT: "Miễn thuế",
  },
  // Mục Mô tả — BE có thể trả mô tả rỗng
  description: {
    title: "Mô tả",
    empty: "Chưa có mô tả",
    emptyVi: "Chưa có mô tả tiếng Việt",
  },
  // Dòng thời gian vòng đời ở cột phải
  lifecycle: {
    title: "Vòng đời sản phẩm",
    current: "Hiện tại",
  },
  // Chứng từ còn mở — BE `GET /products/{id}/open-references` (BR-PRD-005: chỉ cảnh báo, không chặn)
  openReferences: {
    title: "Chứng từ còn mở",
    hint: "Dòng đơn mua / đơn bán chưa xong có SKU của sản phẩm — tạm ngưng hay ngừng kinh doanh không huỷ các dòng này.",
    loading: "Đang kiểm tra chứng từ còn mở…",
    loadFailed: "Không tải được chứng từ còn mở.",
    empty: "Không còn chứng từ nào đang mở.",
  },
  // Form tạo: trục điền sẵn theo danh mục (BE `CategoryAttributeService`, spec D9 — chỉ là gợi ý) và
  // xác nhận số SKU trước khi tạo cả ma trận (BE PR #116: một giao dịch, tối đa 100 tổ hợp)
  create: {
    prefilled: (names: readonly string[]) =>
      `Danh mục gợi ý trục bắt buộc: ${names.join(", ")} — đã điền sẵn. Chọn giá trị cho từng trục, hoặc gỡ nếu sản phẩm không cần.`,
    quickAdd: "Trục gợi ý của danh mục:",
    confirmTitle: (count: number) => `Tạo sản phẩm và ${count} SKU?`,
    confirmDescription: (count: number) =>
      `Hệ thống tạo sản phẩm, trục và ${count} biến thể Nháp trong cùng một lần; biến thể đầu tiên là biến thể mặc định. Bị từ chối thì không có gì được tạo.`,
    confirm: "Tạo sản phẩm",
  },
  // Wizard tạo / sửa sản phẩm — cùng bố cục wizard PO / NCC (stepper, thanh dưới, bước rà soát)
  wizard: {
    process: "Quy trình",
    next: "Tiếp tục",
    create: "Tạo bản nháp",
    save: "Lưu thay đổi",
    saving: "Đang lưu...",
    stepIssuesTitle: "Cần xử lý trước khi tiếp tục",
    // Ô của bước rà soát chưa có trong `edit.fields` (mã bất biến khi sửa nên không ở đó)
    fields: {
      productCode: "Mã sản phẩm",
      name: "Tên",
      kind: "Loại",
    },
    kind: {
      customizable: "Tùy chỉnh / In ấn",
      standard: "Tiêu chuẩn",
    },
  },
  // Ô chọn trục biến thể (dialog "Trục biến thể" + form tạo) — lý do khoá hiện thành chữ, không chỉ
  // `title` trên nút bị vô hiệu (trình duyệt không hiện). Luật: BE `ProductAttributeSet.replaceAxes`.
  axes: {
    description:
      "Mỗi trục là một thuộc tính (màu, cỡ…) và các giá trị sản phẩm có. Thứ tự trục là thứ tự trong tên và SKU của biến thể.",
    // `requireDraft` → 409 PRODUCT_AXES_LOCKED
    lockNotDraft:
      "Bộ trục đã khoá vì sản phẩm không còn ở trạng thái Nháp: không thêm, gỡ trục được — chỉ thêm được giá trị mới cho trục hiện có.",
    // `valueIdsUsedByVariants` không rỗng → 409 PRODUCT_AXES_LOCKED khi thêm trục
    lockOptionUsed:
      "Không thêm trục mới được vì đã có biến thể dùng giá trị của trục — trục mới sẽ làm các biến thể đó thiếu giá trị. Vẫn gỡ được trục chưa có biến thể dùng và thêm giá trị mới cho trục hiện có.",
    // Gỡ trục / bỏ giá trị đang có biến thể mang → 409 ATTRIBUTE_IN_USE
    axisInUse:
      "Có biến thể đang dùng giá trị của trục này — không gỡ được trục và không bỏ chọn được các giá trị đó.",
    noCandidates:
      "Không còn thuộc tính kiểu Chọn một / Màu sắc nào để thêm làm trục — đã dùng hết, đã ngưng dùng, hoặc đang là thuộc tính mô tả của sản phẩm.",
    manageAttributes: "Tạo hoặc bật lại thuộc tính ở trang Thuộc tính (mở tab mới)",
  },
  // Mục Biến thể — nút trên dòng tiêu đề mục
  variants: {
    generate: "Sinh tổ hợp biến thể",
    add: "Thêm biến thể",
    // Panel biến thể khi sản phẩm không nhận thay đổi (BE `Product.acceptsChanges` / requireChangeable)
    lockedHint:
      "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh nên không sửa được biến thể và ảnh.",
  },
} as const;
