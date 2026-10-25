import { useMemo, useState } from "react";

import type { KeyboardEvent } from "react";

export interface TreeSelectNode {
  id: string;
  parentId: string | null | undefined;
  label: string;
  /** Chữ phụ mono sau nhãn (mã danh mục…). */
  hint?: string;
  disabled?: boolean;
}

export interface TreeSelectRowData {
  node: TreeSelectNode;
  depth: number;
  hasChildren: boolean;
}

function childrenMap(nodes: readonly TreeSelectNode[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const map = new Map<string | null, TreeSelectNode[]>();
  for (const node of nodes) {
    // Cha không nằm trong danh sách (đã ngưng / bị lọc) → coi như gốc để nút không biến mất.
    const key = node.parentId && ids.has(node.parentId) ? node.parentId : null;
    map.set(key, [...(map.get(key) ?? []), node]);
  }
  return map;
}

function ancestorsOf(id: string, byId: ReadonlyMap<string, TreeSelectNode>): string[] {
  const out: string[] = [];
  let current = byId.get(id)?.parentId;
  while (current && byId.has(current) && !out.includes(current)) {
    out.push(current);
    current = byId.get(current)?.parentId;
  }
  return out;
}

/**
 * Trạng thái cây của `TreeSelect`: nhánh đang mở, ô tìm, và danh sách dòng hiển thị (duyệt cây theo
 * thứ tự). Đang tìm → chỉ nút khớp + tổ tiên của chúng, bung hết.
 */
export function useTreeSelect(nodes: readonly TreeSelectNode[]) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => childrenMap(nodes), [nodes]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    const visible = q
      ? new Set(
          nodes
            .filter((n) => `${n.label} ${n.hint ?? ""}`.toLocaleLowerCase("vi").includes(q))
            .flatMap((n) => [n.id, ...ancestorsOf(n.id, byId)]),
        )
      : null;
    const out: TreeSelectRowData[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const node of children.get(parent) ?? []) {
        if (visible && !visible.has(node.id)) continue;
        const hasChildren = (children.get(node.id)?.length ?? 0) > 0;
        out.push({ node, depth, hasChildren });
        if (hasChildren && (visible || expanded.has(node.id))) walk(node.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [nodes, byId, children, expanded, query]);

  const toggle = (id: string, next?: boolean) =>
    setExpanded((prev) => {
      const set = new Set(prev);
      if (next ?? !set.has(id)) set.add(id);
      else set.delete(id);
      return set;
    });

  /** Mở lại ô: xoá tìm và bung nhánh chứa `value` (giữ các nhánh người dùng đã mở trước đó). */
  const reset = (value: string) => {
    setQuery("");
    if (value) setExpanded((prev) => new Set([...prev, ...ancestorsOf(value, byId)]));
  };

  const onRowKeyDown = (event: KeyboardEvent, row: TreeSelectRowData) => {
    if (!row.hasChildren || query) return;
    if (event.key === "ArrowRight") toggle(row.node.id, true);
    else if (event.key === "ArrowLeft") toggle(row.node.id, false);
    else return;
    event.preventDefault();
  };

  return { query, setQuery, expanded, rows, byId, toggle, reset, onRowKeyDown };
}
