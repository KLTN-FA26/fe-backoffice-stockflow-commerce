export type ProductListEmptyState = "none" | "no-products" | "no-results" | "invalid-page";

export function getProductListEmptyState({
  itemCount,
  total,
  search,
  statusCount,
}: {
  itemCount: number;
  total: number;
  search: string;
  statusCount: number;
}): ProductListEmptyState {
  if (itemCount > 0) return "none";
  if (total > 0) return "invalid-page";
  return search.trim() || statusCount > 0 ? "no-results" : "no-products";
}
