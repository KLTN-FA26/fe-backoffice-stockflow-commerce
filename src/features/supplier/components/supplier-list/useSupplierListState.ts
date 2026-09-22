import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, STORAGE_KEYS, SUPPLIER_STATUSES } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useSuppliers } from "@/features/supplier/queries";

import { DEFAULT_CONFIG, mergeStoredConfig } from "./constants";
import { deriveFilterFlags, filterSuppliers } from "./helpers";

import type { SupplierDto, SupplierStatus } from "@/features/supplier/types";
import type { SupplierPageConfig } from "./constants";

export function useSupplierListState() {
  const router = useRouter();
  const filters = useUrlFilters(SUPPLIER_STATUSES);
  const { config, updateConfig } = usePageConfig<SupplierPageConfig>(
    STORAGE_KEYS.adminSuppliersConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  const suppliersQuery = useSuppliers({ page: 1, pageSize: 500 });
  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);

  const pageConfig = useMemo(
    () => ({
      ...config,
      statuses: filters.status.length > 0 ? filters.status : [],
      globalSearch: { ...config.globalSearch, query: filters.q },
    }),
    [config, filters.q, filters.status],
  );

  const navigateToDetail = useCallback(
    (s: SupplierDto) => router.push(`${ADMIN_ROUTES.suppliers}/${s.supplierId}`),
    [router],
  );
  const toggleStatus = useCallback(
    (status: SupplierStatus) =>
      filters.setStatus(
        filters.status.includes(status)
          ? filters.status.filter((x) => x !== status)
          : [...filters.status, status],
      ),
    [filters],
  );
  const toggleSearchField = useCallback(
    (field: string) =>
      updateConfig((c) => {
        const fields = c.globalSearch.fields.includes(field)
          ? c.globalSearch.fields.filter((x) => x !== field)
          : [...c.globalSearch.fields, field];
        return { ...c, globalSearch: { ...c.globalSearch, fields } };
      }),
    [updateConfig],
  );
  const toggleTableColumn = useCallback(
    (column: string) => {
      if (column === "actions") return;
      updateConfig((c) => {
        const vc = c.visibleColumns.includes(column)
          ? c.visibleColumns.filter((x) => x !== column)
          : [...c.visibleColumns, column];
        return { ...c, visibleColumns: vc.includes("actions") ? vc : [...vc, "actions"] };
      });
    },
    [updateConfig],
  );
  const updateColumnSearch = useCallback(
    (key: "supplierId" | "name" | "taxCode", value: string) =>
      updateConfig((c) => ({ ...c, columnSearch: { ...c.columnSearch, [key]: value } })),
    [updateConfig],
  );
  const clearColumnSearch = useCallback(
    () => updateConfig((c) => ({ ...c, columnSearch: {} })),
    [updateConfig],
  );

  const filtered = useMemo(() => filterSuppliers(suppliers, pageConfig), [suppliers, pageConfig]);
  const flags = deriveFilterFlags(pageConfig);

  return {
    suppliersQuery,
    pageConfig,
    filtered,
    flags,
    filters,
    updateConfig,
    navigateToDetail,
    toggleStatus,
    toggleSearchField,
    toggleTableColumn,
    updateColumnSearch,
    clearColumnSearch,
  };
}
