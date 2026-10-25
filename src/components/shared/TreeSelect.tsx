"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen, Search } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FORM_SELECT_CLASS } from "./form-control-classes";

import type { KeyboardEvent, ReactNode, Ref } from "react";

export interface TreeSelectNode {
  id: string;
  parentId: string | null | undefined;
  label: string;
  /** Chữ phụ mono sau nhãn (mã danh mục…). */
  hint?: string;
  disabled?: boolean;
}

interface TreeSelectProps {
  /** Nút theo thứ tự cây (cha trước con, anh em theo thứ tự hiển thị). */
  nodes: readonly TreeSelectNode[];
  /** "" = chưa chọn (hoặc chọn `rootOption`). */
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Dòng chọn giá trị "" ở đầu cây (vd "Danh mục gốc"). */
  rootLabel?: string;
  /** Nội dung ô khi đã chọn — mặc định là nhãn của nút. */
  renderValue?: (node: TreeSelectNode) => ReactNode;
  id?: string;
  disabled?: boolean;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface Row {
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
 * Ô chọn một nút trong cây kiểu Drive (giống cây ở bảng Danh mục): bấm mũi tên để mở / thu gọn
 * nhánh, bấm dòng để chọn. Gõ tìm → hiện nút khớp kèm nhánh cha. Mở ra thì nhánh chứa giá trị đang
 * chọn đã bung sẵn. ←/→ trên một dòng thu / mở nhánh. Không chứa nghiệp vụ — dữ liệu qua `nodes`.
 */
export function TreeSelect({
  nodes,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  rootLabel,
  renderValue,
  className,
  ...triggerProps
}: TreeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const children = useMemo(() => childrenMap(nodes), [nodes]);
  const selected = byId.get(value);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    // Đang tìm: chỉ nút khớp + tổ tiên của chúng, bung hết.
    const visible = q
      ? new Set(
          nodes
            .filter((n) => `${n.label} ${n.hint ?? ""}`.toLocaleLowerCase("vi").includes(q))
            .flatMap((n) => [n.id, ...ancestorsOf(n.id, byId)]),
        )
      : null;
    const out: Row[] = [];
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

  const onOpenChange = (next: boolean) => {
    if (next) {
      setQuery("");
      // Bung sẵn nhánh chứa giá trị đang chọn (giữ các nhánh người dùng đã mở trước đó).
      if (value) setExpanded((prev) => new Set([...prev, ...ancestorsOf(value, byId)]));
    }
    setOpen(next);
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onRowKeyDown = (event: KeyboardEvent, row: Row) => {
    if (!row.hasChildren || query) return;
    if (event.key === "ArrowRight") toggle(row.node.id, true);
    else if (event.key === "ArrowLeft") toggle(row.node.id, false);
    else return;
    event.preventDefault();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="tree"
          className={cn(
            FORM_SELECT_CLASS,
            "justify-between gap-2 px-2.5 font-normal",
            !selected && !(rootLabel && value === "") && "text-ink-tertiary",
            className,
          )}
          {...triggerProps}
        >
          <span className="flex min-w-0 items-baseline gap-2 truncate">
            {selected
              ? (renderValue?.(selected) ?? selected.label)
              : rootLabel && value === ""
                ? rootLabel
                : placeholder}
          </span>
          <ChevronDown className="text-ink-tertiary size-3.5 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 gap-0 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).querySelector("input")?.focus();
        }}
      >
        <div className="border-border-default flex items-center gap-2 border-b px-2.5">
          <Search className="text-ink-tertiary size-3.5 shrink-0" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="placeholder:text-ink-tertiary h-9 w-full bg-transparent text-[0.8125rem] outline-none"
          />
        </div>
        <div role="tree" aria-label={placeholder} className="max-h-72 overflow-y-auto p-1">
          {rootLabel && !query && (
            <TreeRow
              label={rootLabel}
              depth={0}
              selected={value === ""}
              onSelect={() => choose("")}
            />
          )}
          {rows.map((row) => (
            <TreeRow
              key={row.node.id}
              label={row.node.label}
              hint={row.node.hint}
              depth={row.depth}
              disabled={row.node.disabled}
              selected={row.node.id === value}
              expanded={row.hasChildren ? query !== "" || expanded.has(row.node.id) : undefined}
              onToggle={query ? undefined : () => toggle(row.node.id)}
              onSelect={() => choose(row.node.id)}
              onKeyDown={(event) => onRowKeyDown(event, row)}
            />
          ))}
          {rows.length === 0 && (
            <p className="text-ink-tertiary px-2 py-6 text-center text-[0.8125rem]">{emptyText}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TreeRow({
  label,
  hint,
  depth,
  selected,
  disabled,
  expanded,
  onToggle,
  onSelect,
  onKeyDown,
}: {
  label: string;
  hint?: string;
  depth: number;
  selected: boolean;
  disabled?: boolean;
  /** undefined = nút lá (không có mũi tên). */
  expanded?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}) {
  const isBranch = expanded !== undefined;
  const FolderIcon = isBranch && expanded ? FolderOpen : Folder;
  return (
    <div
      className="flex items-center gap-0.5"
      style={{ paddingInlineStart: `${depth * 1.125}rem` }}
    >
      {isBranch && onToggle ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={
            expanded ? UI_LABELS.treeSelect.collapse(label) : UI_LABELS.treeSelect.expand(label)
          }
          onClick={onToggle}
          className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-6 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isBranch ? expanded : undefined}
        aria-level={depth + 1}
        disabled={disabled}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          "hover:bg-bg-muted focus-visible:bg-bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-sm)] px-1.5 py-1.5 text-left text-[0.8125rem] outline-none disabled:pointer-events-none disabled:opacity-50",
          selected && "bg-bg-muted text-ink-primary font-medium",
        )}
      >
        <FolderIcon className="text-ink-tertiary size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        {hint && (
          <span className="text-ink-tertiary shrink-0 font-[family-name:var(--font-mono)] text-xs">
            {hint}
          </span>
        )}
        {selected && <Check className="text-ink-primary ml-auto size-3.5 shrink-0" aria-hidden />}
      </button>
    </div>
  );
}
