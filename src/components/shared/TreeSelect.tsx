"use client";

import { useState } from "react";
import { cn } from "cn";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FORM_SELECT_CLASS } from "./form-control-classes";
import { TreeSelectRow } from "./TreeSelectRow";
import { useTreeSelect } from "./use-tree-select";

import type { ReactNode, Ref } from "react";
import type { TreeSelectNode } from "./use-tree-select";

export type { TreeSelectNode } from "./use-tree-select";

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
  const tree = useTreeSelect(nodes);
  const { query, rows, expanded } = tree;
  const selected = tree.byId.get(value);

  const onOpenChange = (next: boolean) => {
    if (next) tree.reset(value);
    setOpen(next);
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
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
            onChange={(event) => tree.setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="placeholder:text-ink-tertiary h-9 w-full bg-transparent text-[0.8125rem] outline-none"
          />
        </div>
        <div role="tree" aria-label={placeholder} className="max-h-72 overflow-y-auto p-1">
          {rootLabel && !query && (
            <TreeSelectRow
              label={rootLabel}
              depth={0}
              selected={value === ""}
              onSelect={() => choose("")}
            />
          )}
          {rows.map((row) => (
            <TreeSelectRow
              key={row.node.id}
              label={row.node.label}
              hint={row.node.hint}
              depth={row.depth}
              disabled={row.node.disabled}
              selected={row.node.id === value}
              expanded={row.hasChildren ? query !== "" || expanded.has(row.node.id) : undefined}
              onToggle={query ? undefined : () => tree.toggle(row.node.id)}
              onSelect={() => choose(row.node.id)}
              onKeyDown={(event) => tree.onRowKeyDown(event, row)}
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
