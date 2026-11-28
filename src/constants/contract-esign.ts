/** HOP-DONG-API.md (2026-11-28): shared wire values and limits. */
export const CONTRACT_TERMS_REVIEW = ["NONE", "PENDING", "APPROVED", "REJECTED"] as const;
export const CONTRACT_ESIGN_PERMISSIONS = {
  terms: "sales-contract-terms:APPROVE",
  signature: "sales-contract-signatures:APPROVE",
} as const;
export const CONTRACT_ESIGN_LIMITS = {
  specialTerms: 4000,
  penaltyPercent: 8,
  quantityTolerancePercent: 10,
  warrantyMonths: 36,
  signer: 300,
  companySigner: 200,
  authorization: 200,
  rejectNote: 500,
  extendDays: 60,
  pdfBytes: 20 * 1024 * 1024,
} as const;
export const CONTRACT_ESIGN_PATHS = {
  list: "/sales-contracts",
  summary: "/sales-contracts/summary",
  route: "/admin/sales/contracts",
  storage: "stockflow:admin:sales:contracts:config",
  statsStorage: "stockflow:admin:sales:contracts:stats",
  contract: (orderId: string, suffix: string) =>
    `/orders/${encodeURIComponent(orderId)}/contract${suffix}`,
  portal: (orderId: string, suffix = "") =>
    `/orders/me/${encodeURIComponent(orderId)}/contract${suffix}`,
} as const;
export const CONTRACT_TERMS_LABELS = {
  NONE: "Chưa gửi duyệt điều khoản",
  PENDING: "Chờ duyệt điều khoản",
  APPROVED: "Đã duyệt điều khoản",
  REJECTED: "Điều khoản bị từ chối",
} as const;
export const CONTRACT_ESIGN_LABELS = {
  title: "Hợp đồng",
  terms: "Điều khoản",
  signers: "Người ký",
  specialTerms: "Thoả thuận riêng",
  nonstandard: "Khác chuẩn",
  default: "Theo cấu hình hệ thống",
  overdue: "Quá hạn ký",
  penaltyPercent: "Phạt vi phạm (%)",
  quantityTolerancePercent: "Dung sai số lượng (%)",
  warrantyMonths: "Bảo hành (tháng)",
  sellerSignerName: "Họ tên người ký bên bán",
  sellerSignerTitle: "Chức danh bên bán",
  authorizationRef: "Số giấy uỷ quyền",
  buyerSignerName: "Họ tên người ký bên mua",
  buyerSignerTitle: "Chức danh bên mua",
  review: "Gửi duyệt điều khoản",
  approve: "Duyệt",
  reject: "Từ chối",
  withdraw: "Rút lại",
  extend: "Gia hạn ký",
  companySign: "Ký phía công ty",
  external: "Tải bản để ký ngoài",
  upload: "Tải lên bản đã ký số",
  revisions: "Lịch sử phiên bản",
  signatures: "Chữ ký",
  valid: "Chữ ký số hợp lệ",
  matches: "Khớp bản đã gửi",
  scan: "Bản scan — không có chữ ký số",
  test: "Chứng thư dùng thử",
  chain: "Chưa kiểm chuỗi chứng thư",
  testWarning:
    "Chứng thư số dùng thử của hệ thống, không do tổ chức cung cấp dịch vụ chứng thực chữ ký số cấp.",
  certificateMissing:
    "Chưa có thông tin chứng thư trước khi ký. Chữ ký hệ thống có thể dùng chứng thư thử; hãy kiểm tra kết quả sau khi ký.",
  fourEyes:
    "Người lập hoặc gửi hợp đồng không được ký phía công ty. Vui lòng chuyển cho người được uỷ quyền khác.",
  unavailable: "Chức năng này chưa khả dụng.",
  success: "Đã cập nhật hợp đồng.",
  failure: "Không thể cập nhật hợp đồng. Vui lòng thử lại.",
  pendingTerms: "Chờ duyệt điều khoản",
  signBy: "Hạn ký",
  awaitingCompany: "Chờ công ty ký",
  salesOwner: "Sale phụ trách",
} as const;
export const CONTRACT_ESIGN_ERRORS: Readonly<Record<string, string>> = {
  SALES_CONTRACT_STATUS_INVALID: "Trạng thái hiện tại của hợp đồng không cho phép thao tác này",
  CONTRACT_OTP_INVALID: "Mã xác nhận không đúng",
  CONTRACT_OTP_EXPIRED: "Mã xác nhận đã hết hạn hoặc không còn dùng được; vui lòng yêu cầu mã mới",
  CONTRACT_OTP_TOO_MANY: "Bạn đã yêu cầu mã xác nhận quá nhiều lần; vui lòng thử lại sau",
  CONTRACT_TERMS_REVIEW_PENDING:
    "Hợp đồng đang chờ duyệt điều khoản. Rút lại đề nghị trước khi sửa.",
  CONTRACT_TERMS_REVIEW_NOT_PENDING:
    "Hợp đồng không còn chờ duyệt điều khoản. Vui lòng kiểm tra dữ liệu mới.",
  CONTRACT_TERMS_REVIEW_NOT_NEEDED: "Hợp đồng dùng điều khoản chuẩn, không cần gửi duyệt.",
  CONTRACT_TERMS_REVIEW_REQUIRED: "Cần duyệt điều khoản khác chuẩn trước khi gửi hợp đồng.",
  CONTRACT_SIGNER_IS_AUTHOR: CONTRACT_ESIGN_LABELS.fourEyes,
  CONTRACT_SIGNED_FILE_REJECTED:
    "Bản ký số bị từ chối: chữ ký không hợp lệ hoặc nội dung không khớp bản đã gửi.",
  CONTRACT_NOT_SIGNABLE: "Hợp đồng không còn ở trạng thái cho phép ký.",
  CONTRACT_SIGN_DEADLINE_PASSED: "Đã quá hạn ký. Vui lòng gia hạn trước khi khách ký.",
  OPTIMISTIC_LOCK:
    "Hợp đồng vừa thay đổi. Đã tải lại dữ liệu, vui lòng kiểm tra trước khi tiếp tục.",
};
