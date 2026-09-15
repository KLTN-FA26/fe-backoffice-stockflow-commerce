/** Copy của trang chủ — giữ nguyên văn bản bản cũ, không viết mới. */
const HOME_TITLE_LEAD = "Kiểm soát dòng hàng từ";
const HOME_TITLE_ACCENT = "nhập kho đến bàn giao.";

export const HOME_COPY = {
  /** Ảnh minh hoạ kho vận ở cột phải hero — file trong public/. */
  illustrationSrc: "/hero-home.png",
  title: `${HOME_TITLE_LEAD} ${HOME_TITLE_ACCENT}`,
  titleLead: HOME_TITLE_LEAD,
  titleAccent: HOME_TITLE_ACCENT,
  description:
    "StockFlowCommerce tập trung dữ liệu mua hàng, tồn kho và hoàn tất đơn vào một không gian làm việc nhất quán cho đội ngũ vận hành.",
  ctaLabel: "Vào hệ thống",
  ctaHint: "Dành cho nhân sự được cấp quyền",
  loginLabel: "Đăng nhập",
  footerLeft: "© 2026 StockFlowCommerce",
  footerRight: "Hệ thống quản lý vận hành kho",
} as const;
