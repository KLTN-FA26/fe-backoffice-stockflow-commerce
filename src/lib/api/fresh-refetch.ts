/**
 * Phần kết quả `refetch()` của TanStack Query mà một form cần để biết đã tải được bản MỚI. `refetch()`
 * KHÔNG ném khi GET lỗi: nó resolve với `isError` và vẫn giữ `data` của lần tải thành công TRƯỚC — nên
 * "Promise đã resolve" hay "có `data`" không chứng minh được gì.
 */
export interface RefetchResult<T> {
  isSuccess: boolean;
  data: T | undefined;
  dataUpdatedAt: number;
}

export type Refetch<T> = () => Promise<RefetchResult<T>>;

/**
 * Gọi `refetch` một lần; chỉ trả bản ghi khi CHÍNH lần GET này thành công: `isSuccess` và `data` được
 * ghi từ lúc bấm trở đi (lần tải bị huỷ / gộp vẫn trả `isSuccess` với dữ liệu cũ → loại theo
 * `dataUpdatedAt`). Lỗi (mạng, 5xx, 403, 404) hay Promise bị từ chối → `undefined`, không ném.
 */
export async function refetchFresh<T>(refetch: Refetch<T>): Promise<T | undefined> {
  const startedAt = Date.now();
  const result = await refetch().catch(() => undefined);
  if (!result?.isSuccess || result.data === undefined || result.dataUpdatedAt < startedAt) {
    return undefined;
  }
  return result.data;
}
