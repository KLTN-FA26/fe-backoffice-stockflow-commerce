import { PageSkeleton } from "@/components/shared/PageSkeleton";

/** Màn quét / biên bản của một chuyến — skeleton dạng chi tiết, không kế thừa skeleton danh sách. */
export default function Loading() {
  return <PageSkeleton variant="detail" />;
}
