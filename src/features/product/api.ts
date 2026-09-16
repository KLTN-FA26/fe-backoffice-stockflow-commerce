import { api } from "@/lib/api/client";

import { productSchema } from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CreateProductInput } from "./schemas";
import type { Category, Product, Sku } from "./types";

export interface ListProductsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  sort?: string;
  [key: string]: unknown;
}

export interface ListSkusParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  productId?: string;
  sort?: string;
  [key: string]: unknown;
}

export interface TransitionProductInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

export interface TransitionSkuInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

export async function listProducts(
  params: ListProductsParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Product>> {
  const { data } = await api.get<PaginatedResponse<Product>>("/products", {
    params,
    signal,
  });
  return data;
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`, {
    signal,
  });
  return data;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await api.post<Product>("/products", input);
  return productSchema.parse(data);
}

export async function updateProduct(
  input: { id: string } & Partial<CreateProductInput>,
): Promise<Product> {
  const { id, ...body } = input;
  const { data } = await api.put<Product>(`/products/${id}`, body);
  return data;
}

export async function transitionProduct(input: TransitionProductInput): Promise<Product> {
  const { id, ...body } = input;
  const { data } = await api.patch<Product>(`/products/${id}/status`, body);
  return data;
}

export async function listSkus(
  params: ListSkusParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Sku>> {
  const { data } = await api.get<PaginatedResponse<Sku>>("/skus", {
    params,
    signal,
  });
  return data;
}

export async function getSku(id: string, signal?: AbortSignal): Promise<Sku> {
  const { data } = await api.get<Sku>(`/skus/${id}`, {
    signal,
  });
  return data;
}

export async function transitionSku(input: TransitionSkuInput): Promise<Sku> {
  const { id, ...body } = input;
  const { data } = await api.patch<Sku>(`/skus/${id}/status`, body);
  return data;
}

export async function listCategories(signal?: AbortSignal): Promise<PaginatedResponse<Category>> {
  const { data } = await api.get<PaginatedResponse<Category>>("/categories", {
    signal,
  });
  return data;
}
