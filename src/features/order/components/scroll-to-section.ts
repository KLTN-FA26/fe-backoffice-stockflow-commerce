/**
 * Đưa người dùng về đầu khối vừa sửa sau khi lưu / chọn xong (S06-4): trang không còn dừng giữa bản xem trước với nút kế
 * tiếp và trạng thái đơn ngoài tầm nhìn. Chờ một khung hình để khối vẽ lại xong; tôn trọng `prefers-reduced-motion`.
 */
export function scrollToSection(id: string): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (!element || typeof element.scrollIntoView !== "function") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });
}
