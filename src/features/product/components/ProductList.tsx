"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import Link from "next/link";
import { cn } from "cn";
import { Eye, Package, Plus, XCircle } from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE, PRODUCT_PERMISSIONS, STORAGE_KEYS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { usePageConfig } from "@/hooks/use-page-config";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useCan } from "@/lib/auth/components/Can";
import { statusLabelVi } from "@/lib/status-map";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ListToolbar,
  TOOLBAR_ACTION_CLASS,
  type ListSummaryItem,
} from "@/components/shared/ListToolbar";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { CELL, statusCell, textCell } from "@/components/shared/column-helpers";
import { shouldFlagProductRow, useBrands, useCategories, useProducts } from "@/features/product";
import { withHeaderFilters } from "@/components/shared/ColumnHeaderFilter";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
import { matchesColumnSearch, productHeaderFilters } from "./product-header-filters";
import { PRODUCT_LIST_FILTER_STATUSES, type ProductListFilterStatus } from "@/features/product/api";
import { getProductListEmptyState } from "@/features/product/product-list-state";
import { toProductApiPage, toProductUiPage } from "@/features/product/pagination";

import { ProductListFacets } from "./ProductListFacets";

import type { Product } from "@/features/product";

/*
 * Chỉ danh sách sản phẩm. Biến thể / SKU và ảnh nằm trong trang từng sản phẩm
 * (BE PR #71 `/products/{id}/variants`); logistics và chính sách tồn của SKU ở trang Hồ sơ hàng tồn
 * (BE PR #119). BE không có danh sách SKU toàn hệ thống, nên tab "SKU" cũ (gọi `/skus` không tồn
 * tại) đã bỏ.
 */
type ProductStatusFilter = "all" | ProductListFilterStatus;
type ProductSearchField = "productId" | "name" | "category" | "type";
type ProductColumnSearchKey = "productId" | "name" | "category";
type ProductTableColumnKey = "productId" | "name" | "category" | "status" | "actions";

interface TabConfig<
  Status extends string,
  Field extends string,
  ColumnSearch extends string,
  Column extends string,
> {
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
}

const PRODUCT_DEFAULT_COLUMNS: ProductTableColumnKey[] = [
  "productId",
  "name",
  "category",
  "status",
  "actions",
];
const DEFAULT_CONFIG: ProductsPageConfig = {
  products: {
    statuses: ["all"],
    globalSearch: { query: "", fields: ["productId", "name"] },
    columnSearch: {},
    visibleColumns: PRODUCT_DEFAULT_COLUMNS,
  },
};

const PRODUCT_STATUS_OPTIONS = ["all", ...PRODUCT_LIST_FILTER_STATUSES].map((value) => ({
  label: value === "all" ? "Tất cả" : (statusLabelVi(value, "product") ?? value),
  value: value as ProductStatusFilter,
}));
const PRODUCT_COLUMN_LABELS: Record<ProductTableColumnKey, string> = {
  productId: "Mã SP",
  name: "Tên sản phẩm",
  category: "Danh mục",
  status: "Trạng thái",
  actions: "Thao tác",
};
function productCode(product: Product): string {
  return product.code ?? product.productId;
}

function categoryName(categoryId: string | null, categories: ReadonlyMap<string, string>): string {
  if (categoryId === null) return "Chưa chọn danh mục";
  return categories.get(categoryId) ?? "";
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
      // Bỏ cột đã gỡ (vd "type" — BE luôn CUSTOMIZABLE) khỏi cấu hình đã lưu
      visibleColumns: stored.products?.visibleColumns?.some((c) =>
        PRODUCT_DEFAULT_COLUMNS.includes(c),
      )
        ? stored.products.visibleColumns.filter((c) => PRODUCT_DEFAULT_COLUMNS.includes(c))
        : PRODUCT_DEFAULT_COLUMNS,
    },
  };
}

export function ProductList() {
  const router = useRouter();
  const canCreateProduct = useCan(PRODUCT_PERMISSIONS.create);
  const productFilters = useUrlFilters(PRODUCT_LIST_FILTER_STATUSES, {
    keys: { page: "productPage", q: "productQ", status: "productStatus" },
  });
  const { config, setConfig } = usePageConfig<ProductsPageConfig>(
    STORAGE_KEYS.adminProductsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const [prodSelectedKeys, setProdSelectedKeys] = useState<Set<string>>(new Set());
  const [productPageSize, setProductPageSize] = useState<number>(PAGE_SIZE.md);
  const [productSort, setProductSort] = useState<{
    key: "code" | "name" | "status";
    direction: "asc" | "desc";
  }>({ key: "code", direction: "asc" });

  // Lọc danh mục / thương hiệu (BE `GET /products?categoryId=&brandId=`) — trên URL như các lọc khác
  const [categoryFilter, setCategoryFilter] = useQueryState("productCategory", parseAsString);
  const [brandFilter, setBrandFilter] = useQueryState("productBrand", parseAsString);
  const changeFacet = (set: (value: string | null) => unknown) => (value: string | null) => {
    void set(value);
    void productFilters.setPage(1);
  };
  // Ô lọc trên header cột Mã SP / Tên — tách khỏi ô tìm chính (`productQ`), mỗi cột một khoá URL.
  const [codeFilter, setCodeFilter] = useQueryState("productCode", parseAsString.withDefault(""));
  const [nameFilter, setNameFilter] = useQueryState("productName", parseAsString.withDefault(""));
  const debouncedCode = useDebouncedValue(codeFilter, 300).trim();
  const debouncedName = useDebouncedValue(nameFilter, 300).trim();
  const brandsQuery = useBrands();

  const productsQuery = useProducts({
    // URL pages are human-facing/one-based; the shared API contract is backend/zero-based.
    page: toProductApiPage(productFilters.page),
    size: productPageSize,
    // BE chỉ có một `q` (khớp mã HOẶC tên): ô tìm chính ưu tiên; không có thì gửi chữ của ô lọc cột
    // để thu hẹp, rồi lọc đúng theo cột ở dưới (`matchesColumnSearch`).
    q: productFilters.debouncedQ.trim() || debouncedCode || debouncedName || undefined,
    status: productFilters.status.length > 0 ? productFilters.status : undefined,
    categoryId: categoryFilter ?? undefined,
    brandId: brandFilter ?? undefined,
    sort: `${productSort.key},${productSort.direction}`,
  });
  const categoriesQuery = useCategories({});

  const rawProducts = useMemo(
    () =>
      (productsQuery.data?.items ?? []).filter((product) =>
        matchesColumnSearch(product, productCode(product), {
          code: debouncedCode,
          name: debouncedName,
        }),
      ),
    [productsQuery.data, debouncedCode, debouncedName],
  );
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const isLoading = productsQuery.isLoading || categoriesQuery.isLoading;
  const loadError = productsQuery.error ?? categoriesQuery.error;
  const productPage = productsQuery.data;
  const productPageNumber = productFilters.page;
  const setProductPage = productFilters.setPage;

  useEffect(() => {
    if (!productPage) return;
    const lastPage = Math.max(1, productPage.totalPages);
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

  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.categoryId, category.name.vi])),
    [categories],
  );

  const updateProductsConfig = (
    updater: (current: ProductsPageConfig["products"]) => ProductsPageConfig["products"],
  ) => setConfig((current) => ({ ...current, products: updater(current.products) }));
  const navigateToDetail = useCallback(
    (product: Product) => router.push(ADMIN_ROUTES.products.detail(product.productId)),
    [router],
  );
  const productEmptyState = getProductListEmptyState({
    itemCount: rawProducts.length,
    total: productPage?.totalElements ?? 0,
    search: productFilters.q,
    statusCount:
      productFilters.status.length +
      (categoryFilter ? 1 : 0) +
      (brandFilter ? 1 : 0) +
      (debouncedCode ? 1 : 0) +
      (debouncedName ? 1 : 0),
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
          className={`${CELL.code} hover:underline`}
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
          className={`${CELL.name} hover:text-accent-text hover:underline`}
        >
          {row.name}
        </Link>
      ),
    },
    {
      ...textCell<Product>(
        "category",
        "Danh mục",
        (row) => categoryName(row.categoryId, categoryNameMap) || "—",
        {
          color: "secondary",
        },
      ),
      key: "category",
    },
    statusCell<Product>("status", "Trạng thái", (row) => row.status, "product", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }) as ColumnDef<Product> & { key: ProductTableColumnKey },
    {
      key: "actions",
      header: "Thao tác",
      cell: (row) => (
        <RowActionsMenu
          label={`Thao tác — ${row.name}`}
          actions={[
            {
              label: "Xem chi tiết",
              icon: Eye,
              href: ADMIN_ROUTES.products.detail(row.productId),
            },
          ]}
        />
      ),
    },
  ];

  // Nút lọc trên header từng cột — ghi vào cùng URL state với toolbar (q / danh mục / trạng thái).
  const headerFilters = productHeaderFilters({
    code: codeFilter,
    onCodeChange: (value) => {
      void setCodeFilter(value || null);
      void productFilters.setPage(1);
    },
    name: nameFilter,
    onNameChange: (value) => {
      void setNameFilter(value || null);
      void productFilters.setPage(1);
    },
    categoryId: categoryFilter,
    categoryOptions: categories
      .filter((category) => category.active !== false)
      .map((category) => ({ value: category.categoryId, label: category.name.vi })),
    onCategoryChange: changeFacet(setCategoryFilter),
    statuses: productFilters.status,
    statusOptions: PRODUCT_STATUS_OPTIONS.filter((option) => option.value !== "all"),
    onToggleStatus: (value) => {
      const status = PRODUCT_LIST_FILTER_STATUSES.find((s) => s === value);
      if (status) toggleProductStatus(status);
    },
    onClearStatuses: () => productFilters.setStatus([]),
  });

  const renderToolbar = () => {
    const pageConfig = productConfig;
    const hasStatusFilter = !pageConfig.statuses.includes("all");
    const hasGlobalSearch = Boolean(pageConfig.globalSearch.query.trim());
    const visibleColumnCount = pageConfig.visibleColumns.filter(
      (column) => column !== "actions",
    ).length;
    const hasColumnConfig = visibleColumnCount !== PRODUCT_DEFAULT_COLUMNS.length - 1;
    const hasFacet = Boolean(categoryFilter || brandFilter);
    const hasColumnSearch = Boolean(codeFilter || nameFilter);
    const hasAnyConfig =
      hasStatusFilter || hasGlobalSearch || hasFacet || hasColumnConfig || hasColumnSearch;
    const brands = brandsQuery.data ?? [];
    const summaryItems: ListSummaryItem[] = [
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
        label: "Danh mục",
        value: categoryFilter ? categoryNameMap.get(categoryFilter) || categoryFilter : "Tất cả",
        active: Boolean(categoryFilter),
        onClear: () => changeFacet(setCategoryFilter)(null),
      },
      {
        label: "Thương hiệu",
        value: brandFilter
          ? (brands.find((b) => b.brandId === brandFilter)?.name ?? brandFilter)
          : "Tất cả",
        active: Boolean(brandFilter),
        onClear: () => changeFacet(setBrandFilter)(null),
      },
      {
        label: "Tìm kiếm chính",
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
        // Cột "Thao tác" luôn hiện (không ẩn được) nên không đưa vào danh sách ẩn hiện cột
        columnOptions={PRODUCT_DEFAULT_COLUMNS.filter((column) => column !== "actions").map(
          (column) => ({ label: PRODUCT_COLUMN_LABELS[column], value: column }),
        )}
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
          void setCategoryFilter(null);
          void setBrandFilter(null);
          void setCodeFilter(null);
          void setNameFilter(null);
        }}
        hasPanelFilter={hasFacet}
        onClearPanelFilters={() => {
          changeFacet(setCategoryFilter)(null);
          changeFacet(setBrandFilter)(null);
        }}
        filterPanel={
          <ProductListFacets
            categories={categories}
            brands={brands.filter((b) => b.active || b.brandId === brandFilter)}
            categoryId={categoryFilter}
            brandId={brandFilter}
            onCategoryChange={changeFacet(setCategoryFilter)}
            onBrandChange={changeFacet(setBrandFilter)}
          />
        }
        resetDisabled={!hasAnyConfig}
        controlsIn="summary"
      />
    );
  };

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (loadError) {
    return (
      <>
        <h1 className="sr-only">Sản phẩm</h1>
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
    // Giao diện kiểu Vercel: khối bo tròn hơn, vạch kẻ bảng mờ (globals.css `.surface-soft`)
    <div className="surface-soft">
      {/* Không hiện title/subtitle — tên trang nằm ở breadcrumb topbar; h1 giữ cho screen reader */}
      <h1 className="sr-only">Sản phẩm</h1>

      {/* Nút chính của trang nằm trên thanh breadcrumb (kiểu Vercel) */}
      <HeaderActions>
        <HeaderCreateButton
          onClick={() => canCreateProduct && router.push(ADMIN_ROUTES.products.create)}
          disabled={!canCreateProduct}
          aria-label="Tạo mới sản phẩm"
          tooltip={canCreateProduct ? "Tạo sản phẩm" : PERMISSION_UI.productCreateDenied}
        />
      </HeaderActions>
      {renderToolbar()}
      {/* Bảng luôn giữ header; không có dữ liệu / không khớp lọc thì thông báo nằm trong thân bảng. */}
      <DataTable
        data={rawProducts}
        columns={withHeaderFilters(
          productColumns.filter((column) => productConfig.visibleColumns.includes(column.key)),
          headerFilters,
        )}
        rowKey={(row) => row.productId}
        caption={`Hiển thị ${rawProducts.length} sản phẩm`}
        flagRow={shouldFlagProductRow}
        onRowClick={navigateToDetail}
        selectable
        stickyHeader
        selectedKeys={prodSelectedKeys}
        onSelectionChange={setProdSelectedKeys}
        pageSize={productPageSize}
        serverPagination={{
          page: productPage?.page ?? toProductApiPage(productFilters.page),
          size: productPage?.size ?? productPageSize,
          totalElements: productPage?.totalElements ?? 0,
          totalPages: productPage?.totalPages ?? 0,
          hasNext: productPage?.hasNext ?? false,
          hasPrevious: productPage?.hasPrevious ?? false,
          onPageChange: (page) => void productFilters.setPage(toProductUiPage(page)),
          onPageSizeChange: (pageSize) => {
            setProductPageSize(pageSize);
            void productFilters.setPage(1);
          },
        }}
        serverSorting={{
          key: productSort.key === "code" ? "productId" : productSort.key,
          direction: productSort.direction,
          onChange: (key, direction) => {
            const backendKey = key === "productId" ? "code" : key;
            if (backendKey === "code" || backendKey === "name" || backendKey === "status") {
              setProductSort({ key: backendKey, direction });
              void productFilters.setPage(1);
            }
          },
        }}
        emptyState={
          productEmptyState === "no-products" ? (
            <EmptyState
              className="rounded-none border-0 bg-transparent py-10 whitespace-normal"
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
                    className={cn(
                      "bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse",
                      TOOLBAR_ACTION_CLASS,
                    )}
                  >
                    <Plus className="size-3.5" />
                    Tạo sản phẩm đầu tiên
                  </Button>
                ) : undefined
              }
            />
          ) : productEmptyState === "no-results" ? (
            <EmptyState
              className="rounded-none border-0 bg-transparent py-10 whitespace-normal"
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
                    void setCodeFilter(null);
                    void setNameFilter(null);
                  }}
                  className="rounded-[var(--r-sm)]"
                >
                  Bỏ bộ lọc
                </Button>
              }
            />
          ) : productEmptyState === "none" ? undefined : (
            <EmptyState
              className="rounded-none border-0 bg-transparent py-10 whitespace-normal"
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
          )
        }
      />
    </div>
  );
}
