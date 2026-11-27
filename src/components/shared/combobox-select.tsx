"use client";

import {
  createContext,
  isValidElement,
  use,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Combobox chọn một (Popover + Command, gõ để lọc) với đúng API của `components/ui/select` —
 * `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`,
 * `SelectLabel`, `SelectSeparator` — nên chỗ gọi chỉ đổi đường import. Trigger vẫn là
 * `role="combobox"`, mục vẫn là `role="option"`. Không chứa nghiệp vụ.
 *
 * Nhãn của giá trị đang chọn lấy từ chính các `SelectItem`: khi danh sách đóng, `SelectContent` vẫn
 * dựng các mục ở chế độ "ghi nhãn" (không ra DOM); mỗi mục ghi nhãn của mình vào `Select` trong
 * layout effect (trước khi vẽ) để `SelectValue` có chữ hiển thị.
 */

type Labels = Map<string, ReactNode>;

interface SelectCtx {
  value: string;
  select: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  labels: Labels;
  register: (value: string, text: string, node: ReactNode) => void;
  contentId: string;
}

const SelectContext = createContext<SelectCtx | null>(null);
/** `true` khi mục đang dựng chỉ để ghi nhãn (danh sách đóng). */
const RegisterOnly = createContext(false);
/** Chữ đang gõ ở ô tìm — mục tự ẩn khi không khớp (cmdk không tự lọc / sắp xếp lại DOM). */
const SearchContext = createContext("");

function useSelect(): SelectCtx {
  const ctx = use(SelectContext);
  if (!ctx) throw new Error("Select* phải nằm trong <Select>");
  return ctx;
}

/** Chữ thuần của một nhãn ReactNode — để lọc khi gõ. */
function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

/** Bỏ dấu tiếng Việt + chữ thường: gõ "kho ha noi" vẫn ra "Kho Hà Nội". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

function Select({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  name,
  required,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  children?: ReactNode;
}) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const value = valueProp ?? innerValue;
  const open = openProp ?? innerOpen;
  const contentId = useId();
  const [labels, setLabels] = useState<Labels>(() => new Map());
  // Ổn định (chỉ dùng setter) — mục gọi trong effect; chỉ đổi state khi chữ của nhãn đổi.
  const [register] = useState(
    () => (key: string, text: string, node: ReactNode) =>
      setLabels((prev) =>
        prev.has(key) && nodeText(prev.get(key)) === text ? prev : new Map(prev).set(key, node),
      ),
  );

  const setOpen = (next: boolean) => {
    if (disabled && next) return;
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  const select = (next: string) => {
    if (valueProp === undefined) setInnerValue(next);
    if (next !== value) onValueChange?.(next);
    setOpen(false);
  };

  return (
    <SelectContext value={{ value, select, open, setOpen, disabled, labels, register, contentId }}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
    </SelectContext>
  );
}

const TRIGGER_CLASS =
  "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled,
  onKeyDown,
  ...props
}: ComponentProps<"button"> & { size?: "sm" | "default" }) {
  const ctx = useSelect();
  const empty = !ctx.value || !ctx.labels.has(ctx.value);
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        aria-expanded={ctx.open}
        aria-controls={ctx.contentId}
        aria-haspopup="listbox"
        data-slot="select-trigger"
        data-size={size}
        data-placeholder={empty ? "" : undefined}
        disabled={disabled ?? ctx.disabled}
        className={cn(TRIGGER_CLASS, className)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            ctx.setOpen(true);
          }
        }}
        {...props}
      >
        {children}
        <ChevronDownIcon aria-hidden className="text-muted-foreground pointer-events-none size-4" />
      </button>
    </PopoverTrigger>
  );
}

/** `children` (nếu có) thay nhãn của mục đang chọn — như `SelectValue` của Radix. */
function SelectValue({
  placeholder,
  className,
  children,
}: {
  placeholder?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const ctx = useSelect();
  const label = ctx.value ? (children ?? ctx.labels.get(ctx.value)) : undefined;
  return (
    <span data-slot="select-value" className={cn("truncate", className)}>
      {label ?? placeholder}
    </span>
  );
}

function SelectContent({
  className,
  children,
  align = "start",
  searchPlaceholder = "Tìm…",
  emptyText = "Không có kết quả",
  title,
}: {
  className?: string;
  children?: ReactNode;
  /** Tiêu đề đậm đầu danh sách, trên ô tìm — như một cột của bảng "Bộ lọc". */
  title?: ReactNode;
  align?: "start" | "center" | "end";
  /** Bỏ qua — giữ để tương thích chữ ký `SelectContent` của Radix. */
  position?: "popper" | "item-aligned";
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const ctx = useSelect();
  if (!ctx.open) return <RegisterOnly value>{children}</RegisterOnly>;
  return (
    <PopoverContent
      id={ctx.contentId}
      data-slot="select-content"
      align={align}
      className={cn("w-(--radix-popover-trigger-width) min-w-56 gap-0 px-1.5 py-2", className)}
    >
      <ContentBody title={title} searchPlaceholder={searchPlaceholder} emptyText={emptyText}>
        {children}
      </ContentBody>
    </PopoverContent>
  );
}

/**
 * Thân danh sách, cùng dáng một cột của bảng "Bộ lọc" (`ListFilterColumn`): tiêu đề đậm, ô tìm, mục
 * có ô tick. Dựng mới mỗi lần mở nên ô tìm luôn trống. Tự lọc (`shouldFilter={false}`): cmdk lọc thì
 * sắp xếp lại DOM theo nhóm của nó, vỡ khi mục nằm trong `SelectGroup` (div thường).
 */
function ContentBody({
  title,
  searchPlaceholder,
  emptyText,
  children,
}: {
  title?: ReactNode;
  searchPlaceholder: string;
  emptyText: string;
  children?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  return (
    <Command className="h-auto rounded-none! bg-transparent p-0" shouldFilter={false}>
      {title ? (
        <p data-slot="select-title" className="text-ink-primary px-2 pb-1 text-sm font-semibold">
          {title}
        </p>
      ) : null}
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      <CommandList className="max-h-64 pt-1">
        <CommandEmpty>{emptyText}</CommandEmpty>
        <SearchContext value={fold(search.trim())}>{children}</SearchContext>
      </CommandList>
    </Command>
  );
}

function SelectItem({
  value,
  disabled,
  className,
  children,
  textValue,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  /** Chữ dùng để lọc khi nhãn không phải chữ thuần. */
  textValue?: string;
}) {
  const ctx = useSelect();
  const registerOnly = use(RegisterOnly);
  const text = textValue ?? nodeText(children);
  // Nhãn mới nhất cho effect ghi nhãn, mà effect đó chỉ chạy lại khi giá trị / chữ đổi.
  const latest = useRef(children);
  useLayoutEffect(() => {
    latest.current = children;
  });
  const { register } = ctx;
  useLayoutEffect(() => {
    register(value, text, latest.current);
  }, [register, value, text]);
  const search = use(SearchContext);
  if (registerOnly) return null;
  if (search && !fold(text).includes(search)) return null;
  const checked = ctx.value === value;
  return (
    <CommandItem
      value={value}
      disabled={disabled}
      aria-checked={checked}
      onSelect={() => ctx.select(value)}
      className={cn(
        "text-ink-secondary data-selected:bg-bg-muted/60 data-selected:text-ink-primary gap-2.5 text-sm",
        checked && "text-ink-primary font-medium",
        className,
      )}
    >
      {/* Ô tick như bảng "Bộ lọc" — chỉ hiển thị; chọn một vẫn là chọn một (chọn mục khác thì đổi). */}
      <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </CommandItem>
  );
}

function SelectGroup({ className, children }: { className?: string; children?: ReactNode }) {
  if (use(RegisterOnly)) return <>{children}</>;
  return (
    <div role="group" data-slot="select-group" className={cn("p-1", className)}>
      {children}
    </div>
  );
}

function SelectLabel({ className, children }: { className?: string; children?: ReactNode }) {
  if (use(RegisterOnly)) return null;
  return (
    <div
      data-slot="select-label"
      className={cn("text-muted-foreground px-1.5 py-1 text-xs", className)}
    >
      {children}
    </div>
  );
}

function SelectSeparator({ className }: { className?: string }) {
  if (use(RegisterOnly)) return null;
  return (
    <div data-slot="select-separator" className={cn("bg-border -mx-1 my-1 h-px", className)} />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
