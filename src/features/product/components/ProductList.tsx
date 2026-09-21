"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "cn";
import {
  BarChart3,
  Eye,
  Package,
  Clock,
  CheckCircle,
  ShoppingBag,
  XCircle,
  Archive,
  Plus,
  Tag,
  Barcode,
} from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE, SKU_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters, useUrlTab } from "@/hooks/use-url-filters";
import { useCan } from "@/lib/auth/components/Can";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import {
  ColumnFilterButton,
  ListToolbar,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { numberCell, moneyCell, statusCell, textCell } from "@/components/shared/column-helpers";
import {
  computeSkuStats as computeSkuStatsSelector,
  formatVnd,
  isCapabilityUnavailable,
  productSkuCount,
  shouldFlagProductRow,
  shouldFlagSkuRow,
  useCategories,
  useProducts,
  useSkus,
} from "@/features/product";
import { PRODUCT_LIST_FILTER_STATUSES, type ProductListFilterStatus } from "@/features/product/api";
import { getProductListEmptyState } from "@/features/product/product-list-state";

import type { Category, Product, Sku } from "@/features/product";

type TabKey = "products" | "skus";
type ProductStatusFilter = "all" | ProductListFilterStatus;
type SkuStatusFilter = "all" | Sku["status"];
type ProductSearchField = "productId" | "name" | "category" | "type";
type SkuSearchField = "skuId" | "variantLabel" | "product" | "barcode";
type ProductColumnSearchKey = "productId" | "name" | "category";
type SkuColumnSearchKey = "skuId" | "variantLabel" | "product";
type ProductTableColumnKey =
  "productId" | "name" | "category" | "type" | "skuCount" | "status" | "actions";
type SkuTableColumnKey =
  | "skuId"
  | "variantLabel"
  | "productId"
  | "uom"
  | "stockOnHand"
  | "stockAvailable"
  | "cost"
  | "status"
  | "actions";

interface TabConfig<
  Status extends string,
  Field extends string,
  ColumnSearch extends string,
  Column extends string,
> {
  showStats: boolean;
  statuses: Status[];
  globalSearch: { query: string; fields: Field[] };
  columnSearch: Partial<Record<ColumnSearch, string>>;
  visibleColumns: Column[];
}

interface ProductsPageConfig {
  products: TabConfig<
    ProductStatusFilter,
    ProductSearchField,
    ProductColumnSearchKey,
    ProductTableColumnKey
  >;
  skus: TabConfig<SkuStatusFilter, SkuSearchField, SkuColumnSearchKey, SkuTableColumnKey>;
}

const PRODUCT_DEFAULT_COLUMNS: ProductTableColumnKey[] = [
  "productId",
  "name",
  "category",
  "type",
  "skuCount",
  "status",
  "actions",
];
const SKU_DEFAULT_COLUMNS: SkuTableColumnKey[] = [
  "skuId",
  "variantLabel",
  "productId",
  "uom",
  "stockOnHand",
  "stockAvailable",
  "cost",
  "status",
  "actions",
];
const DEFAULT_CONFIG: ProductsPageConfig = {
  products: {
    showStats: false,
    statuses: ["all"],
    globalSearch: { query: "", fields: ["productId", "name"] },
    columnSearch: {},
    visibleColumns: PRODUCT_DEFAULT_COLUMNS,
  },
  skus: {
    showStats: false,
    statuses: ["all"],
    globalSearch: { query: "", fields: ["skuId", "variantLabel", "barcode"] },
    columnSearch: {},
    visibleColumns: SKU_DEFAULT_COLUMNS,
  },
};

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: "products", label: "Sản phẩm", icon: Package },
  { key: "skus", label: "SKU", icon: Barcode },
];

const PRODUCT_STATUS_OPTIONS = ["all", ...PRODUCT_LIST_FILTER_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as ProductStatusFilter,
}));
const SKU_STATUS_OPTIONS = ["all", ...SKU_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (STATUS_LABEL_VI[value] ?? value),
  value: value as SkuStatusFilter,
}));

const PRODUCT_COLUMN_LABELS: Record<ProductTableColumnKey, string> = {
  productId: "Mã SP",
  name: "Tên sản phẩm",
  category: "Danh mục",
  type: "Loại",
  skuCount: "SKU",
  status: "Trạng thái",
  actions: "Thao tác",
};
const SKU_COLUMN_LABELS: Record<SkuTableColumnKey, string> = {
  skuId: "Mã SKU",
  variantLabel: "Biến thể",
  productId: "Sản phẩm",
  uom: "UoM",
  stockOnHand: "Tồn kho",
  stockAvailable: "Khả dụng",
  cost: "Giá vốn",
  status: "Trạng thái",
  actions: "Thao tác",
};
const SKU_COLUMN_SEARCH_LABELS: Record<SkuColumnSearchKey, string> = {
  skuId: "Mã SKU",
  variantLabel: "Biến thể",
  product: "Sản phẩm",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function productCode(product: Product): string {
  return product.code ?? product.productId;
}

function categoryName(categoryId: string | null, categories: readonly Category[]): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.find((category) => category.categoryId === categoryId)?.name.vi ?? "";
}

function categoryDisplay(
  categoryId: string | null,
  categories: readonly Category[],
  isLoading: boolean,
  error: unknown,
): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  if (isLoading) return "Đang tải danh mục...";
  if (error) {
    return isCapabilityUnavailable(error)
      ? "Danh mục chưa được backend hỗ trợ"
      : "Không tải được danh mục";
  }
  return categoryName(categoryId, categories) || "Không rõ danh mục";
}

function mergeStoredConfig(
  stored: Partial<ProductsPageConfig>,
  fallback: ProductsPageConfig,
): ProductsPageConfig {
  return {
    products: {
      ...fallback.products,
      ...stored.products,
      globalSearch: { ...fallback.products.globalSearch, ...stored.products?.globalSearch },
      columnSearch: stored.products?.columnSearch ?? {},
      visibleColumns: stored.products?.visibleColumns?.length
        ? stored.products.visibleColumns
        : PRODUCT_DEFAULT_COLUMNS,
    },
    skus: {
      ...fallback.skus,
      ...stored.skus,
      globalSearch: { ...fallback.skus.globalSearch, ...stored.skus?.globalSearch },
      columnSearch: stored.skus?.columnSearch ?? {},
      visibleColumns: stored.skus?.visibleColumns?.length
        ? stored.skus.visibleColumns
        : SKU_DEFAULT_COLUMNS,
    },
  };
}

export function ProductList() {
  const router = useRouter();
  const canCreateProduct = useCan("product.create");
  const [activeTab, setActiveTab] = useUrlTab("tab", ["products", "skus"] as const, "products");
  const productFilters = useUrlFilters(PRODUCT_LIST_FILTER_STATUSES, {
    keys: { page: "productPage", q: "productQ", status: "productStatus" },
  });
  const skuFilters = useUrlFilters(SKU_STATUSES, {
    keys: { q: "skuQ", status: "skuStatus" },
  });
  const { config, setConfig } = usePageConfig<ProductsPageConfig>(
    STORAGE_KEYS.adminProductsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [prodSelectedKeys, setProdSelectedKeys] = useState<Set<string>>(new Set());
  const [skuSelectedKeys, setSkuSelectedKeys] = useState<Set<string>>(new Set());
  const [productPageSize, setProductPageSize] = useState<number>(PAGE_SIZE.md);

  const productsQuery = useProducts({
    page: Math.max(1, productFilters.page),
    pageSize: productPageSize,
    q: productFilters.debouncedQ.trim() || undefined,
    status: productFilters.status.length > 0 ? productFilters.status : undefined,
  });
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });
  const categoriesQuery = useCategories({});

  const rawProducts = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);
  const rawSkus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const isLoading = productsQuery.isLoading;
  const loadError = productsQuery.error;
  const skuUnavailable = Boolean(skusQuery.error);
  const productPage = productsQuery.data;
  const productPageNumber = productFilters.page;
  const setProductPage = productFilters.setPage;

  useEffect(() => {
    if (!productPage) return;
    const lastPage = Math.max(1, productPage.totalPages ?? 1);
    if (productPageNumber > lastPage) void setProductPage(lastPage);
  }, [productPage, productPageNumber, setProductPage]);

  const productConfig = useMemo<ProductsPageConfig["products"]>(
    () => ({
      ...config.products,
      statuses: productFilters.status.length > 0 ? productFilters.status : ["all"],
      globalSearch: { ...config.products.globalSearch, query: productFilters.q },
    }),
    [config.products, productFilters.q, productFilters.status],
  );

  const skuConfig = useMemo<ProductsPageConfig["skus"]>(
    () => ({
      ...config.skus,
      statuses: skuFilters.status.length > 0 ? skuFilters.status : ["all"],
      globalSearch: { ...config.skus.globalSearch, query: skuFilters.q },
    }),
    [config.skus, skuFilters.q, skuFilters.status],
  );

  const productNameMap = useMemo(
    () => new Map<string, string>(rawProducts.map((product) => [product.productId, product.name])),
    [rawProducts],
  );

  const skuSearchFields = useMemo(
    () => [
      { label: "Mã SKU", value: "skuId" as const, getValue: (row: Sku) => row.skuId },
      {
        label: "Biến thể",
        value: "variantLabel" as const,
        getValue: (row: Sku) => row.variantLabel,
      },
      {
        label: "Sản phẩm",
        value: "product" as const,
        getValue: (row: Sku) => productNameMap.get(row.productId) ?? row.productId,
      },
      { label: "Barcode", value: "barcode" as const, getValue: (row: Sku) => row.barcode },
    ],
    [productNameMap],
  );

  const updateProductsConfig = (
    updater: (current: ProductsPageConfig["products"]) => ProductsPageConfig["products"],
  ) => setConfig((current) => ({ ...current, products: updater(current.products) }));
  const updateSkusConfig = (
    updater: (current: ProductsPageConfig["skus"]) => ProductsPageConfig["skus"],
  ) => setConfig((current) => ({ ...current, skus: updater(current.skus) }));
  const navigateToDetail = useCallback(
    (product: Product) => router.push(ADMIN_ROUTES.products.detail(product.productId)),
    [router],
  );
  const navigateToSkuDetail = useCallback(
    (sku: Sku) => router.push(ADMIN_ROUTES.products.skuDetail(sku.skuId)),
    [router],
  );

  const filteredSkus = useMemo(() => {
    let list = rawSkus;
    const pageConfig = skuConfig;
    if (!pageConfig.statuses.includes("all"))
      list = list.filter((sku) => pageConfig.statuses.includes(sku.status));
    const q = normalize(pageConfig.globalSearch.query);
    if (q && pageConfig.globalSearch.fields.length > 0) {
      const fieldMap = new Map(skuSearchFields.map((field) => [field.value, field.getValue]));
      list = list.filter((sku) =>
        pageConfig.globalSearch.fields.some((field) =>
          normalize(fieldMap.get(field)?.(sku) ?? "").includes(q),
        ),
      );
    }
    const skuQuery = normalize(pageConfig.columnSearch.skuId ?? "");
    if (skuQuery) list = list.filter((sku) => normalize(sku.skuId).includes(skuQuery));
    const variantQuery = normalize(pageConfig.columnSearch.variantLabel ?? "");
    if (variantQuery)
      list = list.filter((sku) => normalize(sku.variantLabel).includes(variantQuery));
    const productQuery = normalize(pageConfig.columnSearch.product ?? "");
    if (productQuery)
      list = list.filter((sku) =>
        normalize(productNameMap.get(sku.productId) ?? sku.productId).includes(productQuery),
      );
    return list;
  }, [skuConfig, productNameMap, rawSkus, skuSearchFields]);

  const productStats = useMemo(
    () => [
      {
        label: "Tổng kết quả",
        value: (productPage?.total ?? 0).toLocaleString("vi-VN"),
        icon: Package,
      },
    ],
    [productPage?.total],
  );

  const skuStats = useMemo(() => {
    if (skuUnavailable) {
      return [{ label: "SKU", value: "Chưa khả dụng", icon: Barcode }];
    }
    const stats = computeSkuStatsSelector(filteredSkus);

    return [
      { label: "Tổng SKU", value: stats.total.toString(), icon: Tag },
      { label: "Active", value: stats.active.toString(), icon: CheckCircle },
      { label: "Blocked", value: stats.blocked.toString(), icon: XCircle },
      { label: "Obsolete", value: stats.obsolete.toString(), icon: Archive },
      { label: "Tồn kho", value: stats.totalStock.toLocaleString("vi-VN"), icon: Package },
      { label: "Khả dụng", value: stats.available.toLocaleString("vi-VN"), icon: ShoppingBag },
      { label: "Sắp hết", value: stats.lowStock.toString(), icon: Clock },
    ];
  }, [filteredSkus, skuUnavailable]);

  const productEmptyState = getProductListEmptyState({
    itemCount: rawProducts.length,
    total: productPage?.total ?? 0,
    search: productFilters.q,
    statusCount: productFilters.status.length,
  });

  const toggleProductStatus = (status: ProductStatusFilter) => {
    if (status === "all") {
      productFilters.setStatus([]);
      return;
    }
    const next = productFilters.status.includes(status)
      ? productFilters.status.filter((item) => item !== status)
      : [...productFilters.status, status];
    productFilters.setStatus(next);
  };
  const toggleSkuStatus = (status: SkuStatusFilter) => {
    if (status === "all") {
      skuFilters.setStatus([]);
      return;
    }
    const next = skuFilters.status.includes(status)
      ? skuFilters.status.filter((item) => item !== status)
      : [...skuFilters.status, status];
    skuFilters.setStatus(next);
  };

  const productColumns: (ColumnDef<Product> & { key: ProductTableColumnKey })[] = [
    {
      key: "productId",
      header: "Mã SP",
      sortable: true,
      compare: (a, b) => productCode(a).localeCompare(productCode(b)),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.detail(row.productId)}
          onClick={(e) => e.stopPropagation()}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {productCode(row)}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Tên sản phẩm",
      sortable: true,
      compare: (a, b) => a.name.localeCompare(b.name),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.detail(row.productId)}
          onClick={(e) => e.stopPropagation()}
          className="text-ink-primary hover:text-accent text-[0.8125rem] font-medium hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      ...textCell<Product>(
        "category",
        "Danh mục",
        (row) =>
          categoryDisplay(
            row.categoryId,
            categories,
            categoriesQuery.isLoading,
            categoriesQuery.error,
          ),
        {
          sortable: true,
          compare: (a, b) =>
            categoryDisplay(
              a.categoryId,
              categories,
              categoriesQuery.isLoading,
              categoriesQuery.error,
            ).localeCompare(
              categoryDisplay(
                b.categoryId,
                categories,
                categoriesQuery.isLoading,
                categoriesQuery.error,
              ),
            ),
          color: "secondary",
        },
      ),
      key: "category",
    },
    {
      key: "type",
      header: "Loại",
      sortable: true,
      compare: (a, b) => a.type.localeCompare(b.type),
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem]">
          {row.type === "Customizable" ? "Tùy chỉnh" : "Tiêu chuẩn"}
        </span>
      ),
    },
    {
      key: "skuCount",
      header: "SKU",
      align: "right",
      sortable: true,
      compare: (a, b) =>
        skuUnavailable
          ? 0
          : productSkuCount(a.productId, rawSkus) - productSkuCount(b.productId, rawSkus),
      cell: (row) => (
        <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium tabular-nums">
          {skuUnavailable ? "—" : productSkuCount(row.productId, rawSkus)}
        </span>
      ),
    },
    statusCell<Product>("status", "Trạng thái", (row) => row.status, "product", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<Product> & { key: ProductTableColumnKey },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.detail(row.productId)}
          onClick={(e) => e.stopPropagation()}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-7 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
          aria-label="Xem chi tiết"
        >
          <Eye className="size-3.5" />
        </Link>
      ),
    },
  ];

  const skuColumns: (ColumnDef<Sku> & { key: SkuTableColumnKey })[] = [
    {
      key: "skuId",
      header: "Mã SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      headerFilter: (
        <ColumnFilterButton
          value={skuConfig.columnSearch.skuId ?? ""}
          label="Mã SKU"
          placeholder="Lọc SKU"
          onChange={(value) =>
            updateSkusConfig((current) => ({
              ...current,
              columnSearch: { ...current.columnSearch, skuId: value },
            }))
          }
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.skuDetail(row.skuId)}
          onClick={(e) => e.stopPropagation()}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {row.skuId}
        </Link>
      ),
    },
    {
      ...textCell<Sku>("variantLabel", "Biến thể", (row) => row.variantLabel, {
        sortable: true,
        compare: (a, b) => a.variantLabel.localeCompare(b.variantLabel),
        color: "primary",
      }),
      key: "variantLabel",
      headerFilter: (
        <ColumnFilterButton
          value={skuConfig.columnSearch.variantLabel ?? ""}
          label="Biến thể"
          placeholder="Lọc biến thể"
          onChange={(value) =>
            updateSkusConfig((current) => ({
              ...current,
              columnSearch: { ...current.columnSearch, variantLabel: value },
            }))
          }
        />
      ),
    },
    {
      key: "productId",
      header: "Sản phẩm",
      sortable: true,
      compare: (a, b) => a.productId.localeCompare(b.productId),
      headerFilter: (
        <ColumnFilterButton
          value={skuConfig.columnSearch.product ?? ""}
          label="Sản phẩm"
          placeholder="Lọc sản phẩm"
          onChange={(value) =>
            updateSkusConfig((current) => ({
              ...current,
              columnSearch: { ...current.columnSearch, product: value },
            }))
          }
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.detail(row.productId)}
          onClick={(e) => e.stopPropagation()}
          className="text-ink-secondary hover:text-accent text-[0.8125rem] hover:underline"
        >
          {productNameMap.get(row.productId) ?? row.productId}
        </Link>
      ),
    },
    textCell<Sku>("uom", "UoM", (row) => row.uom, { color: "secondary" }) as ColumnDef<Sku> & {
      key: SkuTableColumnKey;
    },
    numberCell<Sku>("stockOnHand", "Tồn kho", (row) => row.stockOnHand, {
      sortable: true,
      compare: (a, b) => a.stockOnHand - b.stockOnHand,
    }) as ColumnDef<Sku> & { key: SkuTableColumnKey },
    numberCell<Sku>("stockAvailable", "Khả dụng", (row) => row.stockAvailable, {
      sortable: true,
      compare: (a, b) => a.stockAvailable - b.stockAvailable,
    }) as ColumnDef<Sku> & { key: SkuTableColumnKey },
    moneyCell<Sku>("cost", "Giá vốn", (row) => row.cost, formatVnd, {
      sortable: true,
      compare: (a, b) => a.cost - b.cost,
    }) as ColumnDef<Sku> & { key: SkuTableColumnKey },
    statusCell<Sku>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<Sku> & { key: SkuTableColumnKey },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.products.skuDetail(row.skuId)}
          onClick={(e) => e.stopPropagation()}
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-7 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
          aria-label="Xem chi tiết"
        >
          <Eye className="size-3.5" />
        </Link>
      ),
    },
  ];

  const renderToolbar = () => {
    if (activeTab === "products") {
      const pageConfig = productConfig;
      const hasStatusFilter = !pageConfig.statuses.includes("all");
      const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
      const visibleColumnCount = pageConfig.visibleColumns.filter(
        (column) => column !== "actions",
      ).length;
      const hasColumnConfig = visibleColumnCount !== PRODUCT_DEFAULT_COLUMNS.length - 1;
      const hasAnyConfig =
        hasStatusFilter || hasGlobalSearch || pageConfig.showStats || hasColumnConfig;
      const summaryItems: ListSummaryItem[] = [
        { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
        {
          label: "Trạng thái",
          value: pageConfig.statuses
            .map(
              (status) =>
                PRODUCT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status,
            )
            .join(", "),
          active: hasStatusFilter,
          onClear: () => productFilters.setStatus([]),
        },
        {
          label: "Search chính",
          value: hasGlobalSearch ? `“${pageConfig.globalSearch.query}”` : "Chưa dùng",
          active: hasGlobalSearch,
          onClear: () => productFilters.setQ(""),
        },
        {
          label: "Cột hiển thị",
          value: `${visibleColumnCount}/${PRODUCT_DEFAULT_COLUMNS.length - 1}`,
          active: hasColumnConfig,
          onClear: () =>
            updateProductsConfig((current) => ({
              ...current,
              visibleColumns: PRODUCT_DEFAULT_COLUMNS,
            })),
        },
      ];
      return (
        <ListToolbar
          search={pageConfig.globalSearch.query}
          onSearchChange={productFilters.setQ}
          searchPlaceholder="Tìm sản phẩm theo mã hoặc tên..."
          statusOptions={PRODUCT_STATUS_OPTIONS}
          selectedStatuses={pageConfig.statuses}
          onToggleStatus={toggleProductStatus}
          onClearStatuses={() => productFilters.setStatus([])}
          hasStatusFilter={hasStatusFilter}
          columnOptions={PRODUCT_DEFAULT_COLUMNS.map((column) => ({
            label: PRODUCT_COLUMN_LABELS[column],
            value: column,
          }))}
          selectedColumns={pageConfig.visibleColumns}
          defaultColumns={PRODUCT_DEFAULT_COLUMNS}
          lockedColumns={["actions"]}
          visibleColumnCount={visibleColumnCount}
          onToggleColumn={(column) =>
            column !== "actions" &&
            updateProductsConfig((current) => ({
              ...current,
              visibleColumns: current.visibleColumns.includes(column)
                ? current.visibleColumns.filter((item) => item !== column)
                : [...current.visibleColumns, column],
            }))
          }
          onResetColumns={() =>
            updateProductsConfig((current) => ({
              ...current,
              visibleColumns: PRODUCT_DEFAULT_COLUMNS,
            }))
          }
          hasColumnConfig={hasColumnConfig}
          selectedCount={prodSelectedKeys.size}
          onBulkDelete={() => {
            toast.info(
              "Xoá sản phẩm",
              `Đã chọn ${prodSelectedKeys.size} sản phẩm. Chức năng này đang ở UI-only.`,
            );
            setProdSelectedKeys(new Set());
          }}
          onExport={() =>
            toast.success(
              "Xuất file mock",
              `Sẵn sàng xuất ${rawProducts.length} sản phẩm trên trang hiện tại.`,
            )
          }
          summaryItems={summaryItems}
          onResetAll={() => {
            updateProductsConfig(() => DEFAULT_CONFIG.products);
            productFilters.reset();
          }}
          resetDisabled={!hasAnyConfig}
        />
      );
    }

    const pageConfig = skuConfig;
    const hasStatusFilter = !pageConfig.statuses.includes("all");
    const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
    const activeColumnSearch = Object.entries(pageConfig.columnSearch).filter(([, value]) =>
      value?.trim(),
    );
    const hasFieldConfig =
      pageConfig.globalSearch.fields.length !== DEFAULT_CONFIG.skus.globalSearch.fields.length ||
      pageConfig.globalSearch.fields.some(
        (field) => !DEFAULT_CONFIG.skus.globalSearch.fields.includes(field),
      );
    const visibleColumnCount = pageConfig.visibleColumns.filter(
      (column) => column !== "actions",
    ).length;
    const hasColumnConfig = visibleColumnCount !== SKU_DEFAULT_COLUMNS.length - 1;
    const hasAnyConfig =
      hasStatusFilter ||
      hasGlobalSearch ||
      hasFieldConfig ||
      activeColumnSearch.length > 0 ||
      pageConfig.showStats ||
      hasColumnConfig;
    const summaryItems: ListSummaryItem[] = [
      { label: "Stats", value: pageConfig.showStats ? "Đang hiện" : "Đang ẩn" },
      {
        label: "Trạng thái",
        value: pageConfig.statuses
          .map(
            (status) =>
              SKU_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status,
          )
          .join(", "),
        active: hasStatusFilter,
        onClear: () => skuFilters.setStatus([]),
      },
      {
        label: "Search chính",
        value: hasGlobalSearch ? `“${pageConfig.globalSearch.query}”` : "Chưa dùng",
        active: hasGlobalSearch,
        onClear: () => skuFilters.setQ(""),
      },
      {
        label: "Trường search",
        value:
          pageConfig.globalSearch.fields
            .map(
              (field) => skuSearchFields.find((option) => option.value === field)?.label ?? field,
            )
            .join(", ") || "Chưa chọn",
        active: hasFieldConfig,
        onClear: () =>
          updateSkusConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: DEFAULT_CONFIG.skus.globalSearch.fields,
            },
          })),
      },
      {
        label: "Search trong cột",
        value: activeColumnSearch.length
          ? activeColumnSearch
              .map(
                ([key, value]) =>
                  `${SKU_COLUMN_SEARCH_LABELS[key as SkuColumnSearchKey]} “${value}”`,
              )
              .join(", ")
          : "Chưa dùng",
        active: activeColumnSearch.length > 0,
        onClear: () => updateSkusConfig((current) => ({ ...current, columnSearch: {} })),
      },
      {
        label: "Cột hiển thị",
        value: `${visibleColumnCount}/${SKU_DEFAULT_COLUMNS.length - 1}`,
        active: hasColumnConfig,
        onClear: () =>
          updateSkusConfig((current) => ({ ...current, visibleColumns: SKU_DEFAULT_COLUMNS })),
      },
    ];
    return (
      <ListToolbar
        search={pageConfig.globalSearch.query}
        onSearchChange={skuFilters.setQ}
        searchPlaceholder="Tìm SKU theo mã, biến thể, barcode..."
        statusOptions={SKU_STATUS_OPTIONS}
        selectedStatuses={pageConfig.statuses}
        onToggleStatus={toggleSkuStatus}
        onClearStatuses={() => skuFilters.setStatus([])}
        hasStatusFilter={hasStatusFilter}
        fieldOptions={skuSearchFields}
        selectedFields={pageConfig.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.skus.globalSearch.fields}
        onToggleField={(field) =>
          updateSkusConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: current.globalSearch.fields.includes(field)
                ? current.globalSearch.fields.filter((item) => item !== field)
                : [...current.globalSearch.fields, field],
            },
          }))
        }
        onResetFields={() =>
          updateSkusConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: DEFAULT_CONFIG.skus.globalSearch.fields,
            },
          }))
        }
        onSelectAllFields={() =>
          updateSkusConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: skuSearchFields.map((field) => field.value),
            },
          }))
        }
        hasFieldConfig={hasFieldConfig}
        columnOptions={SKU_DEFAULT_COLUMNS.map((column) => ({
          label: SKU_COLUMN_LABELS[column],
          value: column,
        }))}
        selectedColumns={pageConfig.visibleColumns}
        defaultColumns={SKU_DEFAULT_COLUMNS}
        lockedColumns={["actions"]}
        visibleColumnCount={visibleColumnCount}
        onToggleColumn={(column) =>
          column !== "actions" &&
          updateSkusConfig((current) => ({
            ...current,
            visibleColumns: current.visibleColumns.includes(column)
              ? current.visibleColumns.filter((item) => item !== column)
              : [...current.visibleColumns, column],
          }))
        }
        onResetColumns={() =>
          updateSkusConfig((current) => ({ ...current, visibleColumns: SKU_DEFAULT_COLUMNS }))
        }
        hasColumnConfig={hasColumnConfig}
        selectedCount={skuSelectedKeys.size}
        onBulkDelete={() => {
          toast.info(
            "Xoá SKU",
            `Đã chọn ${skuSelectedKeys.size} SKU. Chức năng này đang ở UI-only.`,
          );
          setSkuSelectedKeys(new Set());
        }}
        onExport={() =>
          skuUnavailable
            ? toast.info("Xuất SKU", "Dữ liệu SKU chưa được backend hỗ trợ.")
            : toast.success(
                "Xuất file mock",
                `Sẵn sàng xuất ${filteredSkus.length} SKU đang hiển thị.`,
              )
        }
        summaryItems={summaryItems}
        onResetAll={() => {
          updateSkusConfig(() => DEFAULT_CONFIG.skus);
          skuFilters.reset();
        }}
        resetDisabled={!hasAnyConfig}
      />
    );
  };

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Sản phẩm & SKU" subtitle="Quản lý sản phẩm, biến thể và SKU bán hàng." />
        <EmptyState
          icon={<XCircle className="size-8" />}
          title="Không tải được dữ liệu sản phẩm"
          description="Load error khác với danh sách trống. Hãy thử tải lại hoặc kiểm tra kết nối API."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void productsQuery.refetch();
                void skusQuery.refetch();
                void categoriesQuery.refetch();
              }}
              className="rounded-[var(--r-sm)]"
            >
              Thử lại
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sản phẩm & SKU"
        subtitle="Quản lý sản phẩm, biến thể và SKU bán hàng."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={
                (activeTab === "products" ? productConfig.showStats : skuConfig.showStats)
                  ? "secondary"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                activeTab === "products"
                  ? updateProductsConfig((current) => ({
                      ...current,
                      showStats: !current.showStats,
                    }))
                  : updateSkusConfig((current) => ({ ...current, showStats: !current.showStats }))
              }
              className={cn(
                "rounded-[var(--r-sm)]",
                (activeTab === "products" ? productConfig.showStats : skuConfig.showStats) &&
                  "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
              )}
            >
              <BarChart3 className="size-3.5" />
              {(activeTab === "products" ? productConfig.showStats : skuConfig.showStats)
                ? "Ẩn thống kê"
                : "Hiện thống kê"}
            </Button>
            {activeTab === "products" ? (
              <Button
                variant="default"
                type="button"
                size="sm"
                onClick={() => canCreateProduct && router.push(ADMIN_ROUTES.products.create)}
                disabled={!canCreateProduct}
                title={
                  canCreateProduct ? "Tạo sản phẩm" : "Role hiện tại không có quyền product.create"
                }
                className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
              >
                <Plus className="size-3.5" />
                Tạo sản phẩm
              </Button>
            ) : (
              <span className="border-border-default bg-bg-subtle text-ink-tertiary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-xs">
                SKU tự sinh từ tổ hợp biến thể
              </span>
            )}
          </div>
        }
      />

      <div className="border-border-default mb-4 flex gap-0 border-b">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              type="button"
              variant="ghost"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "hover:bg-bg-muted/60 h-auto rounded-none border-b-2 bg-transparent px-4 py-2 text-[0.8125rem] font-medium transition-colors",
                isActive
                  ? "border-brand text-brand hover:text-brand"
                  : "text-ink-tertiary hover:text-ink-primary border-transparent",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                  isActive ? "bg-brand text-ink-inverse" : "bg-bg-muted text-ink-tertiary",
                )}
              >
                {tab.key === "products"
                  ? (productPage?.total ?? 0)
                  : skuUnavailable
                    ? "—"
                    : rawSkus.length}
              </span>
            </Button>
          );
        })}
      </div>

      {activeTab === "products" ? (
        <>
          <ListStatsPanel
            stats={productStats}
            open={productConfig.showStats}
            gridClassName="sm:grid-cols-1"
          />
          {renderToolbar()}
          {productEmptyState === "none" ? (
            <DataTable
              data={rawProducts}
              columns={productColumns.filter((column) =>
                productConfig.visibleColumns.includes(column.key),
              )}
              rowKey={(row) => row.productId}
              caption={`Hiển thị ${rawProducts.length} sản phẩm`}
              flagRow={shouldFlagProductRow}
              onRowClick={navigateToDetail}
              selectable
              selectedKeys={prodSelectedKeys}
              onSelectionChange={setProdSelectedKeys}
              pageSize={productPageSize}
              serverPagination={{
                page: productPage?.page ?? productFilters.page,
                pageSize: productPage?.pageSize ?? productPageSize,
                total: productPage?.total ?? 0,
                totalPages: productPage?.totalPages ?? 0,
                hasNext: productPage?.hasNext ?? false,
                hasPrevious: productPage?.hasPrevious ?? false,
                onPageChange: (page) => void productFilters.setPage(page),
                onPageSizeChange: (pageSize) => {
                  setProductPageSize(pageSize);
                  void productFilters.setPage(1);
                },
              }}
            />
          ) : productEmptyState === "no-products" ? (
            <EmptyState
              icon={<Package className="size-8" />}
              title="Chưa có sản phẩm"
              description="Môi trường hiện tại chưa có Product record nào. Đây là trạng thái dữ liệu trống, không phải lỗi tải."
              action={
                canCreateProduct ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => router.push(ADMIN_ROUTES.products.create)}
                    className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
                  >
                    <Plus className="size-3.5" />
                    Tạo sản phẩm đầu tiên
                  </Button>
                ) : undefined
              }
            />
          ) : productEmptyState === "no-results" ? (
            <EmptyState
              icon={<Package className="size-8" />}
              title="Không tìm thấy kết quả"
              description="Có dữ liệu sản phẩm, nhưng bộ lọc hoặc từ khoá hiện tại không khớp bản ghi nào."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateProductsConfig(() => DEFAULT_CONFIG.products);
                    productFilters.reset();
                  }}
                  className="rounded-[var(--r-sm)]"
                >
                  Bỏ bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Package className="size-8" />}
              title="Trang không còn dữ liệu"
              description="Trang hiện tại nằm ngoài phạm vi kết quả. Hệ thống sẽ quay về trang hợp lệ gần nhất."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void productFilters.setPage(1)}
                  className="rounded-[var(--r-sm)]"
                >
                  Về trang đầu
                </Button>
              }
            />
          )}
        </>
      ) : (
        <>
          <ListStatsPanel
            stats={skuStats}
            open={skuConfig.showStats}
            gridClassName="lg:grid-cols-4 xl:grid-cols-7"
          />
          {renderToolbar()}
          {skusQuery.error ? (
            <EmptyState
              title={
                isCapabilityUnavailable(skusQuery.error)
                  ? "SKU chưa được backend hỗ trợ"
                  : "Không tải được SKU"
              }
              description={
                isCapabilityUnavailable(skusQuery.error)
                  ? "Backend hiện chưa có API đọc SKU."
                  : "Không thể tải dữ liệu SKU."
              }
              action={
                <Button type="button" variant="outline" onClick={() => void skusQuery.refetch()}>
                  Thử lại
                </Button>
              }
            />
          ) : filteredSkus.length > 0 ? (
            <DataTable
              data={filteredSkus}
              columns={skuColumns.filter((column) => skuConfig.visibleColumns.includes(column.key))}
              rowKey={(row) => row.skuId}
              caption={`Hiển thị ${filteredSkus.length} SKU`}
              flagRow={shouldFlagSkuRow}
              onRowClick={navigateToSkuDetail}
              selectable
              selectedKeys={skuSelectedKeys}
              onSelectionChange={setSkuSelectedKeys}
              pageSize={15}
            />
          ) : rawSkus.length === 0 ? (
            <EmptyState
              icon={<Barcode className="size-8" />}
              title="Chưa có SKU"
              description="Môi trường hiện tại chưa có SKU nào. SKU được sinh từ tổ hợp biến thể khi tạo sản phẩm."
            />
          ) : (
            <EmptyState
              icon={<Barcode className="size-8" />}
              title="Không tìm thấy SKU"
              description="Có dữ liệu SKU, nhưng bộ lọc hoặc từ khoá hiện tại không khớp bản ghi nào."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateSkusConfig(() => DEFAULT_CONFIG.skus);
                    skuFilters.reset();
                  }}
                  className="rounded-[var(--r-sm)]"
                >
                  Bỏ bộ lọc
                </Button>
              }
            />
          )}
        </>
      )}
    </>
  );
}
