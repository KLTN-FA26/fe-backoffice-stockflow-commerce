import { useState } from "react";

/** `set` với `id` đổi chiều: có thì bỏ, chưa có thì thêm (bản mới, không sửa bản cũ). */
export const toggled = (set: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Một tập id bật / tắt từng phần tử — ô tick "hàng chèn" của kế hoạch và của ước tính (RTM-LPGROUP). */
export function useToggleSet(initial?: Iterable<string>) {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(initial));
  return { ids, toggle: (id: string) => setIds((current) => toggled(current, id)) };
}
