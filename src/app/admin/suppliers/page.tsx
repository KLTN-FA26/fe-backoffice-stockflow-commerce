"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "cn";
import {
  BarChart3,
  Building2,
  CheckCircle,
  Clock,
  Columns3,
  Eye,
  FileDown,
  FileText,
  Filter,
  ListFilter,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Star,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatTile } from "@/components/shared/StatTile";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { suppliers, type Supplier } from "@/lib/mock-data";
import { usePageConfig } from "@/hooks/use-page-config";

type SupplierStatusFilter = "all" | "active" | "inactive";
type SupplierSearchField =
  "supplierId" | "name" | "taxCode" | "contactName" | "contactEmail" | "contactPhone";
type SupplierColumnSearchKey = "supplierId" | "name" | "contact" | "email";
type SupplierTableColumnKey =
  | "supplierId"
  | "name"
  | "contact"
  | "email"
  | "terms"
  | "currency"
  | "leadTimeDays"
  | "rating"
  | "active"
  | "actions";

interface SupplierPageConfig {
  showStats: boolean;
  statuses: SupplierStatusFilter[];
  globalSearch: {
    query: string;
    fields: SupplierSearchField[];
  };
  columnSearch: Partial<Record<SupplierColumnSearchKey, string>>;
  visibleColumns: SupplierTableColumnKey[];
}

const STORAGE_KEY = "stockflow:admin:suppliers:config";

const DEFAULT_VISIBLE_COLUMNS: SupplierTableColumnKey[] = [
  "supplierId",
  "name",
  "contact",
  "email",
  "terms",
  "currency",
  "leadTimeDays",
  "rating",
  "active",
  "actions",
];

const DEFAULT_CONFIG: SupplierPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: {
    query: "",
    fields: ["supplierId", "name", "taxCode"],
  },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};

function mergeStoredConfig(
  stored: Partial<SupplierPageConfig>,
  fallback: SupplierPageConfig,
): SupplierPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}

const STATUS_OPTIONS: { label: string; value: SupplierStatusFilter }[] = [
  { label: "Tất cả", value: "all" },
  { label: "Đang hoạt động", value: "active" },
  { label: "Tạm ngưng", value: "inactive" },
];

const SEARCH_FIELDS: {
  label: string;
  value: SupplierSearchField;
  getValue: (supplier: Supplier) => string;
}[] = [
  { label: "Mã NCC", value: "supplierId", getValue: (supplier) => supplier.supplierId },
  { label: "Nhà cung cấp", value: "name", getValue: (supplier) => supplier.name },
  { label: "MST", value: "taxCode", getValue: (supplier) => supplier.taxCode },
  { label: "Người liên hệ", value: "contactName", getValue: (supplier) => supplier.contactName },
  { label: "Email", value: "contactEmail", getValue: (supplier) => supplier.contactEmail },
  { label: "SĐT", value: "contactPhone", getValue: (supplier) => supplier.contactPhone },
];

const COLUMN_SEARCH_LABELS: Record<SupplierColumnSearchKey, string> = {
  supplierId: "Mã NCC",
  name: "Nhà cung cấp",
  contact: "Liên hệ",
  email: "Email",
};

const TABLE_COLUMN_LABELS: Record<SupplierTableColumnKey, string> = {
  supplierId: "Mã NCC",
  name: "Nhà cung cấp",
  contact: "Liên hệ",
  email: "Email",
  terms: "Terms",
  currency: "Tiền tệ",
  leadTimeDays: "Lead time",
  rating: "Rating",
  active: "Trạng thái",
  actions: "Thao tác",
};

function computeStats(list: Supplier[]) {
  const active = list.filter((supplier) => supplier.active).length;
  const inactive = list.length - active;
  const avgRating = list.length
    ? (list.reduce((sum, supplier) => sum + supplier.rating, 0) / list.length).toFixed(1)
    : "0.0";
  const avgLeadTime = list.length
    ? Math.round(list.reduce((sum, supplier) => sum + supplier.leadTimeDays, 0) / list.length)
    : 0;

  return [
    { label: "Tổng NCC", value: list.length.toString(), icon: Building2 },
    { label: "Đang hoạt động", value: active.toString(), icon: CheckCircle },
    { label: "Tạm ngưng", value: inactive.toString(), icon: FileText },
    { label: "Rating TB", value: avgRating, icon: Star },
    { label: "Lead time TB", value: `${avgLeadTime} ngày`, icon: Clock },
  ];
}

function fullAddress(supplier: Supplier) {
  const { street, ward, district, province } = supplier.address;
  return [street, ward, district, province].filter(Boolean).join(", ");
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function statusLabel(status: SupplierStatusFilter) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function fieldLabel(field: SupplierSearchField) {
  return SEARCH_FIELDS.find((option) => option.value === field)?.label ?? field;
}

// Giữ lại cho toolbar sắp dùng — chưa reference nhưng không xoá.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ToolbarButton({
  label,
  active = false,
  children,
  onClick,
}: {
  label: string;
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "border-positive/20 bg-positive/5 text-positive hover:bg-positive/10 hover:text-positive rounded-[var(--r-sm)]",
            active && "border-positive bg-positive/10",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ColumnFilterButton({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const active = Boolean(value.trim());

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Lọc ${label}`}
          className={cn(
            "text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-6 rounded-[var(--r-sm)] focus-visible:ring-0",
            active && "bg-info/10 text-info hover:bg-info/10 hover:text-info",
          )}
        >
          <Filter className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="text-ink-primary mb-2 text-xs font-medium">Lọc {label}</div>
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="bg-bg-surface h-8 rounded-[var(--r-sm)] text-[0.75rem]"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onChange("")}
            disabled={!active}
          >
            Xoá
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const { config, setConfig, updateConfig } = usePageConfig<SupplierPageConfig>(
    STORAGE_KEY,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [selectedSupplierKeys, setSelectedSupplierKeys] = useState<Set<string>>(new Set());

  const toggleStatus = (status: SupplierStatusFilter) => {
    updateConfig((current) => {
      if (status === "all") return { ...current, statuses: ["all"] };
      const withoutAll = current.statuses.filter((item) => item !== "all");
      const next = withoutAll.includes(status)
        ? withoutAll.filter((item) => item !== status)
        : [...withoutAll, status];
      return { ...current, statuses: next.length ? next : ["all"] };
    });
  };

  const toggleSearchField = (field: SupplierSearchField) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return {
        ...current,
        globalSearch: { ...current.globalSearch, fields },
      };
    });
  };

  const updateColumnSearch = (key: SupplierColumnSearchKey, value: string) => {
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  };

  const clearColumnSearch = () => {
    updateConfig((current) => ({ ...current, columnSearch: {} }));
  };

  const toggleTableColumn = (column: SupplierTableColumnKey) => {
    if (column === "actions") return;
    updateConfig((current) => {
      const visibleColumns = current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column];
      return {
        ...current,
        visibleColumns: visibleColumns.includes("actions")
          ? visibleColumns
          : [...visibleColumns, "actions"],
      };
    });
  };

  const resetAll = () => setConfig(DEFAULT_CONFIG);

  const filtered = useMemo(() => {
    let list = suppliers;

    const statuses = config.statuses;
    if (
      !statuses.includes("all") &&
      !(statuses.includes("active") && statuses.includes("inactive"))
    ) {
      if (statuses.includes("active")) list = list.filter((supplier) => supplier.active);
      if (statuses.includes("inactive")) list = list.filter((supplier) => !supplier.active);
    }

    const globalQuery = normalize(config.globalSearch.query);
    if (globalQuery && config.globalSearch.fields.length > 0) {
      const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((supplier) =>
        config.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(supplier) ?? "").includes(globalQuery),
        ),
      );
    }

    const columnSearch = config.columnSearch;
    if (normalize(columnSearch.supplierId ?? "")) {
      const q = normalize(columnSearch.supplierId ?? "");
      list = list.filter((supplier) => normalize(supplier.supplierId).includes(q));
    }
    if (normalize(columnSearch.name ?? "")) {
      const q = normalize(columnSearch.name ?? "");
      list = list.filter((supplier) =>
        normalize(`${supplier.name} ${supplier.taxCode}`).includes(q),
      );
    }
    if (normalize(columnSearch.contact ?? "")) {
      const q = normalize(columnSearch.contact ?? "");
      list = list.filter((supplier) =>
        normalize(`${supplier.contactName} ${supplier.contactPhone}`).includes(q),
      );
    }
    if (normalize(columnSearch.email ?? "")) {
      const q = normalize(columnSearch.email ?? "");
      list = list.filter((supplier) => normalize(supplier.contactEmail).includes(q));
    }

    return list;
  }, [config]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const hasStatusFilter = !config.statuses.includes("all");
  const hasGlobalSearch = Boolean(config.globalSearch.query.trim());
  const activeColumnSearch = Object.entries(config.columnSearch).filter(([, value]) =>
    value?.trim(),
  );
  const defaultSearchFields = DEFAULT_CONFIG.globalSearch.fields;
  const hasFieldConfig =
    config.globalSearch.fields.length !== defaultSearchFields.length ||
    config.globalSearch.fields.some((field) => !defaultSearchFields.includes(field));
  const visibleColumnCount = config.visibleColumns.filter((column) => column !== "actions").length;
  const hasColumnConfig = visibleColumnCount !== DEFAULT_VISIBLE_COLUMNS.length - 1;
  const hasAnyConfig =
    hasStatusFilter ||
    hasGlobalSearch ||
    hasFieldConfig ||
    activeColumnSearch.length > 0 ||
    config.showStats ||
    hasColumnConfig;

  const columns: (ColumnDef<Supplier> & { key: SupplierTableColumnKey })[] = [
    {
      key: "supplierId",
      header: "Mã NCC",
      sortable: true,
      searchable: true,
      compare: (a, b) => a.supplierId.localeCompare(b.supplierId),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.supplierId ?? ""}
          label="Mã NCC"
          placeholder="Lọc mã"
          onChange={(value) => updateColumnSearch("supplierId", value)}
        />
      ),
      cell: (row) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {row.supplierId}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nhà cung cấp",
      sortable: true,
      searchable: true,
      compare: (a, b) => a.name.localeCompare(b.name),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.name ?? ""}
          label="Nhà cung cấp"
          placeholder="Tên / MST"
          onChange={(value) => updateColumnSearch("name", value)}
        />
      ),
      cell: (row) => (
        <div className="min-w-[220px]">
          <div className="text-ink-primary font-medium">{row.name}</div>
          <div className="text-ink-tertiary mt-0.5 text-xs">MST {row.taxCode}</div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      searchable: true,
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.contact ?? ""}
          label="Liên hệ"
          placeholder="Tên / SĐT"
          onChange={(value) => updateColumnSearch("contact", value)}
        />
      ),
      cell: (row) => (
        <div className="text-ink-secondary min-w-[190px] text-[0.8125rem]">
          <div>{row.contactName}</div>
          <div className="text-ink-tertiary mt-0.5 text-xs">{row.contactPhone}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      searchable: true,
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.email ?? ""}
          label="Email"
          placeholder="Lọc email"
          onChange={(value) => updateColumnSearch("email", value)}
        />
      ),
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem]">{row.contactEmail}</span>
      ),
    },
    {
      key: "terms",
      header: "Terms",
      sortable: true,
      compare: (a, b) => a.paymentTerms.localeCompare(b.paymentTerms),
      cell: (row) => (
        <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
          {row.paymentTerms}
        </span>
      ),
    },
    {
      key: "currency",
      header: "Tiền tệ",
      cell: (row) => (
        <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
          {row.currency}
        </span>
      ),
    },
    {
      key: "leadTimeDays",
      header: "Lead time",
      align: "right",
      sortable: true,
      compare: (a, b) => a.leadTimeDays - b.leadTimeDays,
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {row.leadTimeDays} ngày
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      align: "right",
      sortable: true,
      compare: (a, b) => a.rating - b.rating,
      cell: (row) => (
        <span className="text-ink-primary inline-flex items-center justify-end gap-1 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          <Star className="text-warning size-3" />
          {row.rating.toFixed(1)}
        </span>
      ),
    },
    {
      key: "active",
      header: "Trạng thái",
      sortable: true,
      compare: (a, b) => Number(a.active) - Number(b.active),
      cell: (row) => (
        <StatusDot domain="product" status={row.active ? "Active" : "Inactive"} size="sm" />
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => router.push(`/admin/suppliers/${row.supplierId}`)}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] transition-colors"
          aria-label="Xem chi tiết NCC"
        >
          <Eye className="size-3.5" />
        </Button>
      ),
    },
  ];

  const visibleColumns = columns.filter((column) => config.visibleColumns.includes(column.key));

  return (
    <>
      <PageHeader
        title="Nhà cung cấp"
        subtitle="Quản lý hồ sơ NCC dùng cho Replenishment, Purchase Order và Supplier Invoice."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={config.showStats ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                updateConfig((current) => ({ ...current, showStats: !current.showStats }))
              }
              className={cn(
                "rounded-[var(--r-sm)]",
                config.showStats &&
                  "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
              )}
            >
              <BarChart3 className="size-3.5" />
              {config.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/admin/suppliers/create")}
              variant="default"
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Tạo nhà cung cấp
            </Button>
          </div>
        }
      />

      <motion.div
        initial={false}
        animate={{
          gridTemplateRows: config.showStats ? "1fr" : "0fr",
          opacity: config.showStats ? 1 : 0,
        }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="grid overflow-hidden"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} />
            ))}
          </div>
        </div>
      </motion.div>

      <TooltipProvider>
        <div className="border-border-default bg-bg-surface mb-3 rounded-[var(--r-sm)] border px-3 py-2 shadow-[var(--card-shadow)]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px] flex-1 lg:max-w-xl">
              <Search className="text-accent pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={config.globalSearch.query}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    globalSearch: { ...current.globalSearch, query: event.target.value },
                  }))
                }
                placeholder="Tìm nhà cung cấp theo mã, tên, MST..."
                className="border-border-default bg-bg-surface focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] pl-9 text-[0.8125rem] shadow-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Lọc trạng thái"
                    className={cn(
                      "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] focus-visible:ring-0",
                      hasStatusFilter &&
                        "border-info bg-info/10 text-info hover:bg-info/10 hover:text-info",
                    )}
                  >
                    <Filter className={cn("text-info size-4", hasStatusFilter && "text-current")} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>Lọc trạng thái NCC</PopoverTitle>
                    <PopoverDescription>
                      Search và chọn một hoặc nhiều trạng thái.
                    </PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    <CommandInput placeholder="Tìm trạng thái..." />
                    <CommandList>
                      <CommandEmpty>Không có trạng thái phù hợp.</CommandEmpty>
                      <CommandGroup>
                        {STATUS_OPTIONS.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => toggleStatus(option.value)}
                            className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:bg-transparent"
                          >
                            <Checkbox checked={config.statuses.includes(option.value)} />
                            <span>{option.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateConfig((current) => ({ ...current, statuses: ["all"] }))}
                    >
                      Xoá lọc
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      onClick={() => setStatusPopoverOpen(false)}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={searchPopoverOpen} onOpenChange={setSearchPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Chọn trường search"
                    className={cn(
                      "border-border-default bg-bg-surface text-ink-tertiary hover:bg-special/5 hover:text-special focus-visible:border-border-default data-[state=open]:border-border-default data-[state=open]:bg-bg-surface data-[state=open]:text-ink-tertiary rounded-[var(--r-sm)] focus-visible:ring-0",
                      hasFieldConfig &&
                        "border-special bg-special/10 text-special hover:border-special hover:bg-special/10 hover:text-special data-[state=open]:border-special data-[state=open]:bg-special/10 data-[state=open]:text-special",
                    )}
                  >
                    <ListFilter
                      className={cn("text-special size-4", hasFieldConfig && "text-current")}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[25rem] p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>Trường tìm kiếm</PopoverTitle>
                    <PopoverDescription>
                      Chọn một hoặc nhiều fields cho thanh search chính.
                    </PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    <CommandInput placeholder="Tìm field..." />
                    <CommandList>
                      <CommandEmpty>Không có field phù hợp.</CommandEmpty>
                      <CommandGroup>
                        {SEARCH_FIELDS.map((field) => (
                          <CommandItem
                            key={field.value}
                            value={field.label}
                            onSelect={() => toggleSearchField(field.value)}
                            className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:bg-transparent"
                          >
                            <Checkbox checked={config.globalSearch.fields.includes(field.value)} />
                            <span>{field.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateConfig((current) => ({
                          ...current,
                          globalSearch: {
                            ...current.globalSearch,
                            fields: DEFAULT_CONFIG.globalSearch.fields,
                          },
                        }))
                      }
                    >
                      Mặc định
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateConfig((current) => ({
                          ...current,
                          globalSearch: {
                            ...current.globalSearch,
                            fields: SEARCH_FIELDS.map((field) => field.value),
                          },
                        }))
                      }
                    >
                      Chọn tất cả
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      disabled={config.globalSearch.fields.length === 0}
                      onClick={() => setSearchPopoverOpen(false)}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={columnsPopoverOpen} onOpenChange={setColumnsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Ẩn hiện cột"
                    className={cn(
                      "border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] focus-visible:ring-0",
                      hasColumnConfig &&
                        "border-warning bg-warning/10 text-warning hover:bg-warning/10 hover:text-warning",
                    )}
                  >
                    <Columns3
                      className={cn("text-warning size-4", hasColumnConfig && "text-current")}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <PopoverHeader className="border-border-default border-b p-3">
                    <PopoverTitle>Ẩn hiện cột</PopoverTitle>
                    <PopoverDescription>Chọn các cột muốn thấy trên table.</PopoverDescription>
                  </PopoverHeader>
                  <Command>
                    <CommandInput placeholder="Tìm cột..." />
                    <CommandList>
                      <CommandEmpty>Không có cột phù hợp.</CommandEmpty>
                      <CommandGroup>
                        {DEFAULT_VISIBLE_COLUMNS.map((column) => (
                          <CommandItem
                            key={column}
                            value={TABLE_COLUMN_LABELS[column]}
                            disabled={
                              column === "actions" ||
                              (config.visibleColumns.includes(column) && visibleColumnCount <= 1)
                            }
                            onSelect={() => toggleTableColumn(column)}
                            className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:bg-transparent"
                          >
                            <Checkbox
                              checked={config.visibleColumns.includes(column)}
                              disabled={
                                column === "actions" ||
                                (config.visibleColumns.includes(column) && visibleColumnCount <= 1)
                              }
                            />
                            <span>{TABLE_COLUMN_LABELS[column]}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-border-default flex justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateConfig((current) => ({
                          ...current,
                          visibleColumns: DEFAULT_VISIBLE_COLUMNS,
                        }))
                      }
                    >
                      Hiện tất cả
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      onClick={() => setColumnsPopoverOpen(false)}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {selectedSupplierKeys.size > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.info(
                      "Xoá nhà cung cấp",
                      `Đã chọn ${selectedSupplierKeys.size} nhà cung cấp. Chức năng này đang ở UI-only.`,
                    );
                    setSelectedSupplierKeys(new Set());
                  }}
                  className="border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger rounded-[var(--r-sm)]"
                >
                  <X className="size-4" />
                  Xoá đã chọn
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.success(
                    "Xuất file mock",
                    `Sẵn sàng xuất ${filtered.length} nhà cung cấp đang hiển thị.`,
                  )
                }
                className="border-positive/20 bg-positive/5 text-positive hover:bg-positive/10 hover:text-positive rounded-[var(--r-sm)]"
              >
                <FileDown className="size-4" />
                Xuất Excel
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <div className="border-border-default bg-bg-subtle/70 mb-4 flex flex-wrap items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
        <div className="text-ink-primary mr-1 flex items-center gap-2 font-medium">
          <Settings2 className="text-accent size-3.5" />
          Cấu hình
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Stats: {config.showStats ? "Đang hiện" : "Đang ẩn"}
          </Badge>
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Trạng thái: {config.statuses.map(statusLabel).join(", ")}
            {hasStatusFilter && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => updateConfig((current) => ({ ...current, statuses: ["all"] }))}
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full bg-transparent p-0"
                aria-label="Xoá lọc trạng thái"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Search chính: {hasGlobalSearch ? `“${config.globalSearch.query}”` : "Chưa dùng"}
            {hasGlobalSearch && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  updateConfig((current) => ({
                    ...current,
                    globalSearch: { ...current.globalSearch, query: "" },
                  }))
                }
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full bg-transparent p-0"
                aria-label="Xoá search chính"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Trường search: {config.globalSearch.fields.map(fieldLabel).join(", ") || "Chưa chọn"}
            {hasFieldConfig && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  updateConfig((current) => ({
                    ...current,
                    globalSearch: {
                      ...current.globalSearch,
                      fields: DEFAULT_CONFIG.globalSearch.fields,
                    },
                  }))
                }
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full bg-transparent p-0"
                aria-label="Reset trường search"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Search trong cột:{" "}
            {activeColumnSearch.length
              ? activeColumnSearch
                  .map(
                    ([key, value]) =>
                      `${COLUMN_SEARCH_LABELS[key as SupplierColumnSearchKey]} “${value}”`,
                  )
                  .join(", ")
              : "Chưa dùng"}
            {activeColumnSearch.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={clearColumnSearch}
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full bg-transparent p-0"
                aria-label="Xoá search trong cột"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
          <Badge variant="outline" className="bg-bg-subtle text-ink-secondary gap-1">
            Cột hiển thị: {visibleColumnCount}/{DEFAULT_VISIBLE_COLUMNS.length - 1}
            {hasColumnConfig && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  updateConfig((current) => ({
                    ...current,
                    visibleColumns: DEFAULT_VISIBLE_COLUMNS,
                  }))
                }
                className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-4 rounded-full bg-transparent p-0"
                aria-label="Reset cột hiển thị"
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={resetAll}
          disabled={!hasAnyConfig}
          className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary ml-auto rounded-[var(--r-sm)]"
        >
          <RotateCcw className="size-3" />
          Đặt lại
        </Button>
      </div>

      <DataTable
        data={filtered}
        columns={visibleColumns}
        rowKey={(row) => row.supplierId}
        caption={`Hiển thị ${filtered.length} nhà cung cấp`}
        selectable
        selectedKeys={selectedSupplierKeys}
        onSelectionChange={setSelectedSupplierKeys}
        flagRow={(row) => !row.active || row.rating < 4}
        pageSize={15}
      />

      {filtered.length > 0 && (
        <div className="border-border-default bg-bg-surface text-ink-secondary mt-4 rounded-[var(--r-sm)] border px-4 py-3 text-[0.8125rem]">
          <div className="text-ink-primary font-medium">Địa chỉ NCC đang hiển thị</div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {filtered.map((supplier) => (
              <div
                key={supplier.supplierId}
                className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border px-3 py-2"
              >
                <div className="text-accent font-[family-name:var(--font-mono)] text-xs">
                  {supplier.supplierId}
                </div>
                <div className="text-ink-secondary mt-1 line-clamp-1 text-xs">
                  {fullAddress(supplier)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
