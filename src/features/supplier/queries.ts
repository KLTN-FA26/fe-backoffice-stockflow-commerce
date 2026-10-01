import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getSupplier, listSuppliers } from "./api";

import type { LegacyPaginatedResponse } from "@/lib/api/query-factory";
import type { SupplierDto } from "./types";
import type { ListSupplierParams } from "./api";

export const supplierKeys = createQueryKeys<ListSupplierParams>("suppliers");

export const useSuppliers = createListQuery<
  SupplierDto,
  ListSupplierParams,
  LegacyPaginatedResponse<SupplierDto>
>(supplierKeys, listSuppliers);

export const useSupplier = createDetailQuery<SupplierDto>(supplierKeys, getSupplier);
