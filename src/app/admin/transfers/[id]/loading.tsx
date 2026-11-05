import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Chi tiết lệnh — skeleton đúng dạng trang chi tiết (không dùng skeleton danh sách của route cha). */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
