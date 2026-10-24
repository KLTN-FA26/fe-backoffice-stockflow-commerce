import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Chi tiết một kế hoạch — skeleton dạng chi tiết, không kế thừa skeleton danh sách. */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
