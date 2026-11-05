import type { UserStatusAction } from "../../types";

interface StatusActionCopy {
  /** Nút trên thẻ tài khoản. */
  button: string;
  title: string;
  /** Mô tả hậu quả; hộp thoại còn đòi lý do (SCRUM-474 LOCK-REASON). */
  description: string;
  confirm: string;
  danger: boolean;
}

/** Câu chữ xác nhận từng thao tác trạng thái — hậu quả lấy từ mô tả endpoint của BE PR #72. */
export const STATUS_ACTION_COPY: Record<UserStatusAction, StatusActionCopy> = {
  lock: {
    button: "Khoá tài khoản",
    title: "Khoá tài khoản?",
    description:
      "Tài khoản bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi bạn mở khoá.",
    confirm: "Khoá tài khoản",
    danger: true,
  },
  unlock: {
    button: "Mở khoá",
    title: "Mở khoá tài khoản?",
    description:
      "Tài khoản đăng nhập lại được, kể cả khi đang bị khoá tạm vì nhập sai mật khẩu nhiều lần.",
    confirm: "Mở khoá",
    danger: false,
  },
  disable: {
    button: "Vô hiệu hoá",
    title: "Vô hiệu hoá tài khoản?",
    description:
      "Tài khoản được giữ lại để lịch sử còn tên người thao tác, nhưng bị đăng xuất mọi nơi và không đăng nhập được nữa.",
    confirm: "Vô hiệu hoá",
    danger: true,
  },
  enable: {
    button: "Kích hoạt lại",
    title: "Kích hoạt lại tài khoản?",
    description: "Tài khoản được đưa về trạng thái hoạt động và đăng nhập lại được.",
    confirm: "Kích hoạt lại",
    danger: false,
  },
};
