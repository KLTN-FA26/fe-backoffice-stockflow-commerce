import { tripErrorMessage } from "@/features/putaway/trip-errors";
import { toast } from "@/components/shared/Toast";

/**
 * Callback chung cho thao tác cấp chuyến (đi, đóng, đổi bin, bỏ thùng): lỗi → toast; chuyến đã đổi ở nơi khác →
 * tải lại (`onStale`). Invalidate thuộc factory (`trip-mutations`), ở đây chỉ việc của màn.
 */
export function tripCallbacks(onStale: () => void, done?: () => void) {
  return {
    onSuccess: () => done?.(),
    onError: (error: unknown) => {
      const result = tripErrorMessage(error);
      toast.error(result.message);
      if (result.stale) onStale();
      done?.();
    },
  };
}
