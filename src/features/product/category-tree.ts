/**
 * Thứ tự cây của danh mục — PURE, không side effect.
 *
 * BE sắp `path,asc` theo cả chuỗi, nên không ra thứ tự cây khi mã có '-' / '_' hoặc trùng tiền tố:
 * '-' (0x2D) đứng trước '/' (0x2F), collation theo locale lại bỏ qua dấu → "/AO-KHOAC" chen giữa
 * "/AO" và con "/AO/THUN". So từng cấp (đoạn mã giữa hai '/') thì cha luôn đứng ngay trước con;
 * anh em cùng cấp xếp theo `sortOrder` (ô "Thứ tự") rồi tới mã.
 */
import type { PaginatedResponse } from "@/lib/api/query-factory";

const segmentsOf = (path: string) => path.split("/").filter(Boolean);
const pathOf = (segments: readonly string[], depth: number) =>
  `/${segments.slice(0, depth + 1).join("/")}`;

/** So hai path chỉ theo mã từng cấp (khi không biết `sortOrder` của tổ tiên). */
export function compareCategoryPath(a: string, b: string): number {
  const x = segmentsOf(a);
  const y = segmentsOf(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const left = x[i] ?? "";
    const right = y[i] ?? "";
    if (left !== right) return left < right ? -1 : 1;
  }
  return x.length - y.length;
}

/**
 * Bản sao đã sắp theo thứ tự cây — không đổi mảng gốc (dữ liệu của React Query). Ở cấp đầu tiên
 * hai path khác nhau, so `sortOrder` của hai nút tổ tiên tại cấp đó (tra trong chính `rows`); thiếu
 * tổ tiên (vd đang lọc) thì so theo mã.
 */
export function inTreeOrder<T extends { path: string; sortOrder?: number }>(
  rows: readonly T[],
): T[] {
  const sortOrderByPath = new Map(rows.map((row) => [row.path, row.sortOrder]));
  return [...rows].sort((a, b) => {
    const x = segmentsOf(a.path);
    const y = segmentsOf(b.path);
    for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
      const left = x[i] ?? "";
      const right = y[i] ?? "";
      if (left === right) continue;
      const orderLeft = sortOrderByPath.get(pathOf(x, i));
      const orderRight = sortOrderByPath.get(pathOf(y, i));
      if (orderLeft !== undefined && orderRight !== undefined && orderLeft !== orderRight) {
        return orderLeft - orderRight;
      }
      return left < right ? -1 : 1;
    }
    return x.length - y.length;
  });
}

/** Các path tổ tiên của một path: "/A/B/C" → ["/A", "/A/B"]. */
export function ancestorPathsOf(path: string): string[] {
  const segments = segmentsOf(path);
  return segments.slice(0, -1).map((_, depth) => pathOf(segments, depth));
}

/** Dòng của cây kèm số danh mục con trực tiếp (để hiện nút mở / thu gọn). */
export type CategoryTreeRow<T> = T & { childCount: number };

/** Số con trực tiếp theo path của cha. */
function childCounts(rows: readonly { path: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const parent = ancestorPathsOf(row.path).at(-1);
    if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  return counts;
}

/** Path của các danh mục có con — "Mở tất cả" mở đúng những dòng này. */
export function expandablePaths(rows: readonly { path: string }[]): string[] {
  return [...childCounts(rows).keys()];
}

/**
 * Cây thư mục như Drive: giữ dòng mà MỌI tổ tiên đều đang mở (`expanded` chứa path cha), gắn số con.
 * Tổ tiên không có trong `rows` (dữ liệu lệch) thì bỏ qua để dòng không bị ẩn vĩnh viễn.
 * `expanded = null` → hiện phẳng tất cả (đang tìm / lọc).
 */
export function visibleTreeRows<T extends { path: string }>(
  rows: readonly T[],
  expanded: ReadonlySet<string> | null,
): CategoryTreeRow<T>[] {
  const counts = childCounts(rows);
  const present = new Set(rows.map((row) => row.path));
  return rows
    .filter(
      (row) =>
        expanded === null ||
        ancestorPathsOf(row.path).every((path) => !present.has(path) || expanded.has(path)),
    )
    .map((row) => ({ ...row, childCount: counts.get(row.path) ?? 0 }));
}

/**
 * Cắt danh sách (đã sắp thứ tự cây) thành một trang cùng hình `PageResponse` của BE. Trang vượt quá
 * cuối (vd vừa ngưng dùng dòng cuối khi đang lọc) → về trang cuối thay vì trang trống.
 */
export function toClientPage<T>(
  rows: readonly T[],
  page: number,
  size: number,
): PaginatedResponse<T> {
  const totalElements = rows.length;
  const totalPages = Math.ceil(totalElements / size);
  const current = Math.min(Math.max(0, page), Math.max(0, totalPages - 1));
  return {
    items: rows.slice(current * size, current * size + size),
    page: current,
    size,
    totalElements,
    totalPages,
    hasNext: current + 1 < totalPages,
    hasPrevious: current > 0,
  };
}
