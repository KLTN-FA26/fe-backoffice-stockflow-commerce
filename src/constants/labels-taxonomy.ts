/**
 * Nhãn, thông báo và lỗi của màn Thương hiệu & danh mục (BE `ProductTaxonomyController`).
 * Tách khỏi `labels.ts` cho gọn; `UI_LABELS.taxonomy` / `TOAST_MESSAGES.taxonomy` trỏ về đây.
 */

import { TAXONOMY_LIMITS } from "./numbers";
import { PAGE_SIZE } from "./table";

export const TAXONOMY_UI_LABELS = {
  pageTitle: "Thương hiệu & danh mục",
  pageSubtitle:
    "Dữ liệu tham chiếu để phân loại sản phẩm. Không xoá được — ngưng dùng để ẩn khỏi form sản phẩm.",
  tabBrands: "Thương hiệu",
  tabCategories: "Danh mục",
  createBrand: "Tạo thương hiệu",
  createCategory: "Tạo danh mục",
  brandTitle: "Thương hiệu",
  categoryTitle: "Danh mục",
  codeHint: "Chữ, số, '_' hoặc '-'; tự in hoa. Không đổi được sau khi tạo.",
  lockedHint: "Mã không đổi được sau khi tạo.",
  categoryLockedHint: "Mã và danh mục cha không đổi được sau khi tạo.",
  readOnlyHint: "Bạn chỉ có quyền xem thông tin này.",
  staleTitle: "Dữ liệu đã thay đổi",
  brandNoun: "thương hiệu",
  expandAll: "Mở tất cả",
  collapseAll: "Thu gọn tất cả",
  expandRow: "Mở danh mục con của",
  viewRow: "Xem",
  collapseRow: "Thu gọn danh mục con của",
  categoryNoun: "danh mục",
  activeHint: "Bỏ chọn để ngưng dùng — sản phẩm mới không chọn được nữa, sản phẩm cũ giữ nguyên.",
  brandSearchPlaceholder: "Tìm theo mã hoặc tên thương hiệu",
  categorySearchPlaceholder: "Tìm theo mã hoặc tên danh mục",
  rootCategory: "— Danh mục gốc —",
  /** Ô chọn danh mục dạng cây (TreeSelect). */
  categoryPickerPlaceholder: "Chọn danh mục",
  categoryPickerSearch: "Tìm danh mục…",
  categoryPickerEmpty: "Không có danh mục khớp",
  parentLoading: "Đang tải danh sách danh mục…",
  parentLoadFailed: "Không tải được danh sách danh mục — hiện chỉ chọn được danh mục gốc.",
  listTruncated: `Danh sách quá dài — chỉ hiện ${PAGE_SIZE.masterData * TAXONOMY_LIMITS.maxLookupPages} bản ghi đầu, hãy tìm hoặc lọc để thu hẹp.`,
  maxDepthReached: "đã đủ 11 cấp",
  allStatuses: "Tất cả",
  active: "Đang dùng",
  inactive: "Ngừng dùng",
  field: {
    code: "Mã",
    name: "Tên",
    slug: "Slug",
    logo: "Logo",
    logoUrl: "URL logo",
    parent: "Danh mục cha",
    level: "Cấp",
    sortOrder: "Thứ tự",
    imageUrl: "URL ảnh",
    seoTitle: "Tiêu đề SEO",
    seoDescription: "Mô tả SEO",
    active: "Trạng thái",
  },
  brandEmptyTitle: "Chưa có thương hiệu",
  brandEmptyDescription: "Tạo thương hiệu đầu tiên để gắn cho sản phẩm.",
  categoryEmptyTitle: "Chưa có danh mục",
  categoryEmptyDescription: "Tạo danh mục gốc trước, rồi thêm danh mục con bên dưới.",
  noMatchTitle: "Không tìm thấy kết quả",
  noMatchDescription: "Thử từ khoá khác hoặc bỏ bộ lọc.",
  clearFilters: "Bỏ bộ lọc",
} as const;

export const TAXONOMY_TOAST_MESSAGES = {
  brandCreated: "Đã tạo thương hiệu",
  brandUpdated: "Đã cập nhật thương hiệu",
  categoryCreated: "Đã tạo danh mục",
  categoryUpdated: "Đã cập nhật danh mục",
} as const;

/**
 * BE `errorCode` của thương hiệu / danh mục (`ProductTaxonomyService`) → câu tiếng Việt.
 * Message BE là tiếng Anh, có UUID — không hiển thị thô.
 */
export const TAXONOMY_ERROR_MESSAGES = {
  // Trùng mã HOẶC trùng slug sinh từ mã (vd A_B và A-B cùng slug a-b) — uk_*_code / uk_*_slug
  BRAND_CODE_ALREADY_EXISTS: "Mã đã được dùng (hoặc trùng slug với mã khác, vd A_B và A-B).",
  CATEGORY_CODE_ALREADY_EXISTS: "Mã đã được dùng (hoặc trùng slug với mã khác, vd A_B và A-B).",
  BRAND_NOT_FOUND: "Thương hiệu không còn tồn tại — danh sách đã được tải lại.",
  CATEGORY_NOT_FOUND: "Danh mục không còn tồn tại — danh sách đã được tải lại.",
  PARENT_NOT_FOUND: "Danh mục cha không còn tồn tại — danh sách đã được tải lại, hãy chọn lại.",
  MAX_DEPTH: "Danh mục cha đã ở cấp sâu nhất (cây tối đa 11 cấp).",
  // PUT của BE không nhận version (ghi đè cả bản) — không cho lưu lại trên dữ liệu cũ
  OPTIMISTIC_LOCK:
    "Thông tin vừa được người khác sửa. Danh sách đã được tải lại — hãy mở lại để sửa trên bản mới nhất.",
  LOAD_FAILED: "Không tải được danh sách. Vui lòng thử lại.",
  UNSUPPORTED_PARAMETER: "Bộ lọc hoặc sắp xếp không được hỗ trợ.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NETWORK_ERROR: "Không kết nối được máy chủ",
  generic: "Không thực hiện được thao tác. Vui lòng thử lại.",
} as const;
