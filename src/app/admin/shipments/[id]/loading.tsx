import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Chi tiết một lô giao — skeleton dạng chi tiết, không kế thừa skeleton danh sách. */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
