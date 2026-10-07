import { Skeleton } from "@/components/shared/Skeleton";

/**
 * Skeleton đúng bố cục thật của màn đơn hàng (api-conventions §8 "Skeleton đúng shape layout").
 * `PageSkeleton` dùng chung có thẻ thống kê + header riêng — màn order không có, dùng lại sẽ
 * vẽ 2 tiêu đề (list) hoặc làm bố cục nhảy khi tải xong (detail).
 */

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
// Mã đơn · Người nhận · Ngày đặt · Tổng tiền · Trạng thái · Thao tác (order-list/columns.tsx)
const TABLE_COLS = "grid-cols-[1.1fr_1.6fr_1fr_1fr_1fr_0.4fr]";
const CARD = "border-border-default bg-bg-surface rounded-[var(--card-radius)] border";

function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Đang tải nội dung" aria-busy="true">
      <span className="sr-only">Đang tải nội dung</span>
      {children}
    </div>
  );
}

function HeaderSkeleton({ withAction }: { withAction: boolean }) {
  return (
    <div className="flex items-end justify-between gap-6 pb-2">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-[60vw]" />
        <Skeleton className="h-4 w-80 max-w-[72vw]" />
      </div>
      {withAction && <Skeleton className="hidden h-8 w-24 sm:block" />}
    </div>
  );
}

/** Chỉ phần bảng — đặt dưới header + toolbar THẬT của danh sách. */
export function OrderTableSkeleton() {
  return (
    <LoadingRegion>
      <div className={CARD}>
        <div
          className={`border-border-default bg-bg-subtle grid ${TABLE_COLS} gap-4 border-b px-4 py-3`}
        >
          {[0, 1, 2, 3, 4].map((col) => (
            <Skeleton key={col} className="h-3 w-full max-w-24" />
          ))}
        </div>
        <div className="divide-border-default divide-y px-4">
          {ROWS.map((row) => (
            <div key={row} className={`grid ${TABLE_COLS} items-center gap-4 py-3`}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full max-w-44" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="ml-auto size-7" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Cả trang danh sách (header không có thẻ thống kê + toolbar + bảng) — cho loading.tsx/gate. */
export function OrderListPageSkeleton() {
  return (
    <div className="space-y-4">
      <HeaderSkeleton withAction={false} />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 max-w-sm flex-1" />
        <Skeleton className="size-9" />
        <Skeleton className="size-9" />
      </div>
      <OrderTableSkeleton />
    </div>
  );
}

/** Trang chi tiết: dòng hàng bên trái; thẻ thao tác + thông tin + tài chính bên phải. */
export function OrderDetailSkeleton() {
  return (
    <LoadingRegion>
      <div className="space-y-4">
        <HeaderSkeleton withAction />
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className={`${CARD} space-y-3 p-[var(--card-pad)]`}>
            <Skeleton className="h-5 w-32" />
            {[0, 1].map((line) => (
              <div
                key={line}
                className="border-border-default flex gap-3 rounded-[var(--r-sm)] border p-3"
              >
                <Skeleton className="size-10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full max-w-64" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-5">
            <div className={`${CARD} space-y-4 p-[var(--card-pad)]`}>
              <Skeleton className="mx-auto h-6 w-28 rounded-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className={`${CARD} space-y-2 p-[var(--card-pad)]`}>
              <Skeleton className="mb-3 h-5 w-24" />
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-4 w-full" />
              ))}
            </div>
            <div className={`${CARD} flex items-center justify-between p-[var(--card-pad)]`}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-32" />
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
