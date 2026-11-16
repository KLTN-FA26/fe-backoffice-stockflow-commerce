import { useQuery } from "@tanstack/react-query";

import { QUARANTINE_QUERY_KEYS } from "@/constants/quarantine";

import { useAppStore } from "@/lib/store/use-app-store";

import { getCarton } from "./quarantine-api";

export const cartonKeys = {
  all: [QUARANTINE_QUERY_KEYS.carton] as const,
  detail: (lpn: string, warehouseId: string | null) =>
    [...cartonKeys.all, warehouseId, lpn] as const,
};

/** Chỉ tra khi đã có LPN; không tự thử lại 404 (LPN sai) — retry của QueryClient bỏ qua 4xx. */
export function useCarton(lpn: string) {
  const warehouseId = useAppStore((state) => state.warehouseId);
  return useQuery({
    queryKey: cartonKeys.detail(lpn, warehouseId),
    queryFn: ({ signal }) => getCarton(lpn, signal),
    enabled: Boolean(lpn),
  });
}
