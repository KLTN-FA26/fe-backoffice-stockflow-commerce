import { notFound } from "next/navigation";

/**
 * Mọi đường dẫn `/admin/...` không khớp trang nào: Next chỉ vẽ 404 chung (không có khung quản trị) cho đường dẫn không
 * khớp, nên trang này chủ động gọi `notFound()` để `app/admin/not-found.tsx` hiện trong khung có trình đơn.
 * Các trang có thật luôn thắng catch-all này.
 */
export default function AdminUnknownPage() {
  notFound();
}
