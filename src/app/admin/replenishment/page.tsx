"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightCircle,
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "cn";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { numberCell, statusCell, textCell } from "@/components/shared/column-helpers";
import {
  replenishmentProposals,
  skus,
  purchaseOrders,
  type ReplenishmentProposal,
} from "@/lib/mock-data";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import { usePageConfig } from "@/hooks/use-page-config";

type ProposalStatusFilter = "all" | ReplenishmentProposal["status"];
type ProposalSearchField = "proposalId" | "skuId" | "variantLabel" | "reason";
type ProposalColumnSearchKey = "skuId" | "variantLabel" | "reason";
type ProposalTableColumnKey =
  | "skuId"
  | "variantLabel"
  | "stockOnHand"
  | "incoming"
  | "stockReserved"
  | "reorderPoint"
  | "suggestedQty"
  | "reason"
  | "status"
  | "actions";

interface ReplenishmentPageConfig {
  showStats: boolean;
  statuses: ProposalStatusFilter[];
  globalSearch: { query: string; fields: ProposalSearchField[] };
  columnSearch: Partial<Record<ProposalColumnSearchKey, string>>;
  visibleColumns: ProposalTableColumnKey[];
}

const STORAGE_KEY = "stockflow:admin:replenishment:config";
const DEFAULT_VISIBLE_COLUMNS: ProposalTableColumnKey[] = [
  "skuId",
  "variantLabel",
  "stockOnHand",
  "incoming",
  "stockReserved",
  "reorderPoint",
  "suggestedQty",
  "reason",
  "status",
  "actions",
];
const DEFAULT_CONFIG: ReplenishmentPageConfig = {
  showStats: false,
  statuses: ["all"],
  globalSearch: { query: "", fields: ["skuId", "variantLabel"] },
  columnSearch: {},
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
};

function mergeStoredConfig(
  stored: Partial<ReplenishmentPageConfig>,
  fallback: ReplenishmentPageConfig,
): ReplenishmentPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
    columnSearch: stored.columnSearch ?? {},
    visibleColumns: stored.visibleColumns?.length ? stored.visibleColumns : DEFAULT_VISIBLE_COLUMNS,
  };
}

const STATUS_OPTIONS = ["all", "Draft Proposal", "Reviewed", "Converted"].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as ProposalStatusFilter,
}));

const TABLE_COLUMN_LABELS: Record<ProposalTableColumnKey, string> = {
  skuId: "SKU",
  variantLabel: "Tên SKU",
  stockOnHand: "Tồn hiện tại",
  incoming: "Hàng đang về",
  stockReserved: "Hàng chờ xuất",
  reorderPoint: "Reorder point",
  suggestedQty: "SL đề xuất",
  reason: "Lý do",
  status: "Trạng thái",
  actions: "Thao tác",
};

const COLUMN_SEARCH_LABELS: Record<ProposalColumnSearchKey, string> = {
  skuId: "SKU",
  variantLabel: "Tên SKU",
  reason: "Lý do",
};

function skuLabel(row: ReplenishmentProposal) {
  return skus.find((sku) => sku.skuId === row.skuId)?.variantLabel ?? "";
}

function skuNumber(
  row: ReplenishmentProposal,
  key: "stockOnHand" | "stockReserved" | "reorderPoint",
) {
  return skus.find((sku) => sku.skuId === row.skuId)?.[key] ?? 0;
}

function computeIncoming(skuId: string): number {
  return purchaseOrders
    .filter((po) => po.status === "Confirmed" || po.status === "Partially Received")
    .flatMap((po) => po.lines)
    .filter((line) => line.skuId === skuId)
    .reduce((sum, line) => sum + (line.orderedQty - line.receivedQty), 0);
}

const SEARCH_FIELDS: {
  label: string;
  value: ProposalSearchField;
  getValue: (row: ReplenishmentProposal) => string;
}[] = [
  { label: "Proposal ID", value: "proposalId", getValue: (row) => row.proposalId },
  { label: "SKU", value: "skuId", getValue: (row) => row.skuId },
  { label: "Tên SKU", value: "variantLabel", getValue: skuLabel },
  { label: "Lý do", value: "reason", getValue: (row) => row.reason },
];

function computeStats(list: ReplenishmentProposal[]) {
  const total = list.length;
  const draft = list.filter((p) => p.status === "Draft Proposal").length;
  const reviewed = list.filter((p) => p.status === "Reviewed").length;
  const converted = list.filter((p) => p.status === "Converted").length;

  return [
    { label: "Tổng đề xuất", value: total.toString(), icon: ClipboardList },
    { label: "Đề xuất nháp", value: draft.toString(), icon: Clock },
    { label: "Đã xem xét", value: reviewed.toString(), icon: CheckCircle },
    { label: "Đã chuyển PO", value: converted.toString(), icon: RefreshCw },
  ];
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function shouldFlag(row: ReplenishmentProposal): boolean {
  const sku = skus.find((s) => s.skuId === row.skuId);
  if (!sku) return false;
  return sku.stockOnHand === 0 || sku.stockAvailable < sku.reorderPoint;
}

export default function ReplenishmentPage() {
  const { config, setConfig, updateConfig } = usePageConfig<ReplenishmentPageConfig>(
    STORAGE_KEY,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<ReplenishmentProposal | null>(null);

  const toggleStatus = (status: ProposalStatusFilter) => {
    updateConfig((current) => {
      if (status === "all") return { ...current, statuses: ["all"] };
      const withoutAll = current.statuses.filter((item) => item !== "all");
      const next = withoutAll.includes(status)
        ? withoutAll.filter((item) => item !== status)
        : [...withoutAll, status];
      return { ...current, statuses: next.length ? next : ["all"] };
    });
  };

  const toggleSearchField = (field: ProposalSearchField) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return { ...current, globalSearch: { ...current.globalSearch, fields } };
    });
  };

  const toggleTableColumn = (column: ProposalTableColumnKey) => {
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

  const updateColumnSearch = (key: ProposalColumnSearchKey, value: string) =>
    updateConfig((current) => ({
      ...current,
      columnSearch: { ...current.columnSearch, [key]: value },
    }));
  const clearColumnSearch = () => updateConfig((current) => ({ ...current, columnSearch: {} }));
  const resetAll = () => setConfig(DEFAULT_CONFIG);

  const filtered = useMemo(() => {
    let list = replenishmentProposals;
    if (!config.statuses.includes("all"))
      list = list.filter((proposal) => config.statuses.includes(proposal.status));

    const q = normalize(config.globalSearch.query);
    if (q && config.globalSearch.fields.length > 0) {
      const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
      list = list.filter((proposal) =>
        config.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(proposal) ?? "").includes(q),
        ),
      );
    }

    const skuQuery = normalize(config.columnSearch.skuId ?? "");
    if (skuQuery) list = list.filter((proposal) => normalize(proposal.skuId).includes(skuQuery));
    const variantQuery = normalize(config.columnSearch.variantLabel ?? "");
    if (variantQuery)
      list = list.filter((proposal) => normalize(skuLabel(proposal)).includes(variantQuery));
    const reasonQuery = normalize(config.columnSearch.reason ?? "");
    if (reasonQuery)
      list = list.filter((proposal) => normalize(proposal.reason).includes(reasonQuery));

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

  const handleConvertClick = (row: ReplenishmentProposal) => {
    setConvertTarget(row);
    setConfirmOpen(true);
  };

  const handleConfirmConvert = () => {
    toast.success("Mock action", "Đề xuất đã chuyển thành Draft PO (UI-only).");
    setConvertTarget(null);
  };

  const columns: (ColumnDef<ReplenishmentProposal> & { key: ProposalTableColumnKey })[] = [
    {
      key: "skuId",
      header: "SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.skuId ?? ""}
          label="SKU"
          placeholder="Lọc SKU"
          onChange={(value) => updateColumnSearch("skuId", value)}
        />
      ),
      cell: (row) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
          {row.skuId}
        </span>
      ),
    },
    {
      ...textCell<ReplenishmentProposal>("variantLabel", "Tên SKU", (row) => skuLabel(row) || "—", {
        sortable: true,
        compare: (a, b) => skuLabel(a).localeCompare(skuLabel(b)),
        color: "primary",
      }),
      key: "variantLabel",
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.variantLabel ?? ""}
          label="Tên SKU"
          placeholder="Lọc tên SKU"
          onChange={(value) => updateColumnSearch("variantLabel", value)}
        />
      ),
    },
    numberCell<ReplenishmentProposal>(
      "stockOnHand",
      "Tồn hiện tại",
      (row) => skuNumber(row, "stockOnHand"),
      {
        sortable: true,
        compare: (a, b) => skuNumber(a, "stockOnHand") - skuNumber(b, "stockOnHand"),
      },
    ) as ColumnDef<ReplenishmentProposal> & { key: ProposalTableColumnKey },
    {
      key: "incoming",
      header: "Hàng đang về",
      align: "right",
      sortable: true,
      compare: (a, b) => computeIncoming(a.skuId) - computeIncoming(b.skuId),
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {computeIncoming(row.skuId).toLocaleString("vi-VN")}
        </span>
      ),
    },
    numberCell<ReplenishmentProposal>(
      "stockReserved",
      "Hàng chờ xuất",
      (row) => skuNumber(row, "stockReserved"),
      {
        sortable: true,
        compare: (a, b) => skuNumber(a, "stockReserved") - skuNumber(b, "stockReserved"),
      },
    ) as ColumnDef<ReplenishmentProposal> & { key: ProposalTableColumnKey },
    numberCell<ReplenishmentProposal>(
      "reorderPoint",
      "Reorder point",
      (row) => skuNumber(row, "reorderPoint"),
      {
        sortable: true,
        compare: (a, b) => skuNumber(a, "reorderPoint") - skuNumber(b, "reorderPoint"),
      },
    ) as ColumnDef<ReplenishmentProposal> & { key: ProposalTableColumnKey },
    {
      key: "suggestedQty",
      header: "SL đề xuất",
      align: "right",
      sortable: true,
      compare: (a, b) => a.suggestedQty - b.suggestedQty,
      cell: (row) => (
        <span className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-bold tabular-nums">
          {row.suggestedQty.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      ...textCell<ReplenishmentProposal>("reason", "Lý do", (row) => row.reason, {
        color: "secondary",
      }),
      key: "reason",
      headerFilter: (
        <ColumnFilterButton
          value={config.columnSearch.reason ?? ""}
          label="Lý do"
          placeholder="Lọc lý do"
          onChange={(value) => updateColumnSearch("reason", value)}
        />
      ),
    },
    statusCell<ReplenishmentProposal>("status", "Trạng thái", (row) => row.status, "proposal", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<ReplenishmentProposal> & { key: ProposalTableColumnKey },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        if (row.status === "Reviewed") {
          return (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                handleConvertClick(row);
              }}
              className="border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 hover:text-accent rounded-[var(--r-sm)]"
            >
              <ArrowRightCircle className="size-3.5" />
              Convert
            </Button>
          );
        }
        if (row.status === "Converted" && row.convertedToPoId) {
          return (
            <Link
              href={`/admin/purchase-orders/${row.convertedToPoId}`}
              className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              {row.convertedToPoId}
            </Link>
          );
        }
        return null;
      },
    },
  ];

  const visibleColumns = columns.filter((column) => config.visibleColumns.includes(column.key));
  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: config.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Trạng thái",
      value: config.statuses
        .map((status) => STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status)
        .join(", "),
      active: hasStatusFilter,
      onClear: () => updateConfig((current) => ({ ...current, statuses: ["all"] })),
    },
    {
      label: "Search chính",
      value: hasGlobalSearch ? `“${config.globalSearch.query}”` : "Chưa dùng",
      active: hasGlobalSearch,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, query: "" },
        })),
    },
    {
      label: "Trường search",
      value:
        config.globalSearch.fields
          .map((field) => SEARCH_FIELDS.find((option) => option.value === field)?.label ?? field)
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
        })),
    },
    {
      label: "Search trong cột",
      value: activeColumnSearch.length
        ? activeColumnSearch
            .map(
              ([key, value]) =>
                `${COLUMN_SEARCH_LABELS[key as ProposalColumnSearchKey]} “${value}”`,
            )
            .join(", ")
        : "Chưa dùng",
      active: activeColumnSearch.length > 0,
      onClear: clearColumnSearch,
    },
    {
      label: "Cột hiển thị",
      value: `${visibleColumnCount}/${DEFAULT_VISIBLE_COLUMNS.length - 1}`,
      active: hasColumnConfig,
      onClear: () =>
        updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS })),
    },
  ];

  return (
    <>
      <PageHeader
        title="Đề xuất nhập hàng"
        subtitle="Theo dõi SKU dưới reorder point, hàng đang về và số lượng cần bổ sung."
        actions={
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
        }
      />

      <ListStatsPanel stats={stats} open={config.showStats} gridClassName="sm:grid-cols-4" />

      <ListToolbar
        search={config.globalSearch.query}
        onSearchChange={(value) =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, query: value },
          }))
        }
        searchPlaceholder="Tìm đề xuất theo SKU, tên SKU, lý do..."
        statusOptions={STATUS_OPTIONS}
        selectedStatuses={config.statuses}
        onToggleStatus={toggleStatus}
        onClearStatuses={() => updateConfig((current) => ({ ...current, statuses: ["all"] }))}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={SEARCH_FIELDS}
        selectedFields={config.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={toggleSearchField}
        onResetFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
          }))
        }
        onSelectAllFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: SEARCH_FIELDS.map((field) => field.value),
            },
          }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={DEFAULT_VISIBLE_COLUMNS.map((column) => ({
          label: TABLE_COLUMN_LABELS[column],
          value: column,
        }))}
        selectedColumns={config.visibleColumns}
        defaultColumns={DEFAULT_VISIBLE_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={toggleTableColumn}
        onResetColumns={() =>
          updateConfig((current) => ({ ...current, visibleColumns: DEFAULT_VISIBLE_COLUMNS }))
        }
        hasColumnConfig={hasColumnConfig}
        selectedCount={selectedKeys.size}
        onBulkDelete={() => {
          toast.info(
            "Xoá đề xuất",
            `Đã chọn ${selectedKeys.size} đề xuất nhập hàng. Chức năng này đang ở UI-only.`,
          );
          setSelectedKeys(new Set());
        }}
        onExport={() =>
          toast.success(
            "Xuất file mock",
            `Sẵn sàng xuất ${filtered.length} đề xuất nhập hàng đang hiển thị.`,
          )
        }
        summaryItems={summaryItems}
        onResetAll={resetAll}
        resetDisabled={!hasAnyConfig}
      />

      <DataTable
        data={filtered}
        columns={visibleColumns}
        rowKey={(row) => row.proposalId}
        caption={`Hiển thị ${filtered.length} đề xuất nhập hàng`}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        flagRow={shouldFlag}
        pageSize={15}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Chuyển thành Draft PO"
        description={`Xác nhận chuyển đề xuất ${convertTarget?.proposalId ?? ""} thành Draft PO?`}
        confirmLabel="Chuyển PO"
        variant="default"
        onConfirm={handleConfirmConvert}
      />
    </>
  );
}
