import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

export const SAMPLE_COPY: LoadErrorCopy = {
  pageTitle: "Yêu cầu mẫu",
  notFoundTitle: "Không tìm thấy yêu cầu mẫu",
  notFoundDescription:
    "Yêu cầu mẫu không tồn tại, chưa tới kho của bạn hoặc đường dẫn không hợp lệ.",
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem yêu cầu mẫu.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem dữ liệu yêu cầu mẫu. Liên hệ quản trị để được cấp.",
};

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
