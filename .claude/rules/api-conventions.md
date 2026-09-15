---
description: axios client, query key factory, invalidation, zod parse tại biên, mock adapter
globs:
  - "src/lib/api/**"
  - "src/features/**/{api,queries,mutations,schemas}.ts"
  - "src/lib/validation/**"
---

# Data layer conventions

Nguồn: `src/_design/PRODUCTION-FRONTEND-RULES.md` §2–§4.

## axios (§2.1)

Một instance duy nhất: `lib/api/client.ts` — baseURL từ `NEXT_PUBLIC_API_URL`, interceptor
gắn JWT và parse lỗi thành `ApiError` (`lib/api/error.ts`). Component **không** gọi axios
trực tiếp; luôn qua `features/<module>/api.ts`.

## Mock adapter (§2.4)

Khi `NEXT_PUBLIC_USE_MOCK=true`, request đi qua `lib/api/mock-adapter.ts`.
Đây là **file duy nhất** được import `src/lib/mock-data.ts`. Thêm feature mới → thêm route
vào adapter, không để component chạm mock.

## Query convention (§2.2)

Query key factory theo feature, không viết key chuỗi tay:

```ts
export const poKeys = {
  all: ["purchase-orders"] as const,
  lists: () => [...poKeys.all, "list"] as const,
  list: (params: PoListParams) => [...poKeys.lists(), params] as const,
  details: () => [...poKeys.all, "detail"] as const,
  detail: (id: string) => [...poKeys.details(), id] as const,
};
```

## Mutation + invalidation (§2.3)

Mỗi mutation khai báo rõ nó invalidate cái gì, theo liên kết module trong docs.
Ví dụ: confirm receipt → invalidate cả `receiptKeys` lẫn `poKeys` lẫn `inventoryKeys`,
vì nhận hàng đổi cả tồn kho và trạng thái PO.

## Zod — hai lớp schema, KHÔNG trộn (§3.1)

| Lớp   | Tên                            | Việc                                   |
| ----- | ------------------------------ | -------------------------------------- |
| DTO   | `XDto`                         | Hình dạng dữ liệu **từ backend** về    |
| Input | `XCreateInput`, `XUpdateInput` | Dữ liệu **form gửi đi**, kèm BR refine |

`types.ts` chỉ `z.infer` từ schemas — không khai báo interface tay, tránh lệch.

## Parse tại biên (§3.2)

Parse **một lần** ở lớp api, ngay khi nhận response. Không parse rải rác trong component.
Dữ liệu đi vào React Query đã là kiểu đã validate.

## BR traceable — bắt buộc

Mọi `BR-xx` encode vào zod refine hoặc transition table **phải có comment cite docs**:

```ts
// BR-05 (docs 02-purchase-order §4): không huỷ PO đã có Receipt
.refine((po) => !(po.status === "Confirmed" && po.hasReceipt), {
  message: "PO đã có phiếu nhận hàng, không thể huỷ",
})
```

Đây là phần chứng minh nghiệp vụ khi bảo vệ đề tài — thiếu cite là mất điểm.

## Validation primitives (§3.3)

Dùng lại `lib/validation/primitives.ts`: `vnd`, `vndAmount`, `isoDate`, `futureDate`,
`barcode`, `locationCode`. Không viết regex tiền/ngày riêng ở từng feature.

## Forms (§4)

- react-hook-form + `zodResolver`, luôn dùng Input schema ở trên.
- Form động (PO lines, receipt lines, package lines) → `useFieldArray`.
- Wizard nhiều bước → validate từng bước bằng schema con.
- Lỗi từ server map về field qua `ApiError.fieldErrors` (§4.4).
- Scan input (module 03/05/07/08/10/11) → `use-scan-input`.

## Mọi trạng thái đều có UI (§8)

| Trạng thái                | Xử lý                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| Loading lần đầu           | `<Skeleton>` **đúng shape layout** — không spinner giữa trang trắng      |
| Refetch nền               | `isFetching` → thanh progress mảnh dưới topbar, không che nội dung       |
| Empty (chưa có data)      | `<EmptyState>` + CTA: "Chưa có PO — Tạo đơn đầu tiên"                    |
| Empty (filter không khớp) | `<EmptyState>` **khác**: "Không tìm thấy kết quả" + nút "Bỏ bộ lọc"      |
| Error 4xx                 | message server + nút "Thử lại"; 403 → "Bạn không có quyền"               |
| Error 5xx / network       | `error.tsx`: "Không kết nối được máy chủ" + traceId + Retry              |
| Zod parse fail            | "Dữ liệu trả về không đúng định dạng" — bug contract, log + traceId      |
| Mutating pending          | Nút disabled + spinner, **chặn double-submit**                           |
| Offline                   | `navigator.onLine` false → banner "Mất kết nối — thay đổi chưa được lưu" |

Hai loại empty là **hai component khác nhau** — đừng gộp làm một.

Mỗi route nhóm bắt buộc có `error.tsx`, `not-found.tsx`, `loading.tsx`.
`QueryClient` default: `retry: 2` (backoff), **không retry 4xx**.

## Format tiền / ngày / số — MỘT chỗ (§10)

Không định nghĩa `formatUSD`, `formatCompactVND`, `supplierName` trong page.

```ts
// lib/format/money.ts
formatMoney(amount, currency); // Intl.NumberFormat, vi-VN / en-US
formatCompact(amount, currency); // tỷ ₫ / tr ₫

// lib/format/date.ts — LUÔN explicit timezone, không để lệch ngày
formatDate(iso); // Intl.DateTimeFormat "vi-VN", timeZone: "Asia/Ho_Chi_Minh"
isOverdue(iso); // BR-06 (docs 02): cảnh báo, KHÔNG chặn

// lib/references/index.ts — lookup có cache, không .find() O(n) mỗi render
useSupplierName(id); // query master data, staleTime 10m
```

Quy tắc:

- Tiền tệ **luôn lấy từ field `currency` của record** — PO có thể là USD (BR-07 docs 02).
  Đừng hardcode VND.
- Số lượng luôn kèm `uom`.
- Số trong bảng: `tabular-nums` + căn phải.
- Ngày: timezone `Asia/Ho_Chi_Minh`, format `vi-VN`.

## Performance (§9)

1. **RSC mặc định.** `page.tsx` là Server Component; chỉ `"use client"` cho file thật sự
   cần (table có sort/filter, form, chart). Fetch lần đầu ở server → không waterfall.
2. **Không import `mock-data.ts` (3366 dòng) vào client bundle** — chỉ adapter dùng,
   và adapter nên `dynamic(() => import(...))`.
3. Code-split theo route; `next/dynamic` cho `WarehouseMap`, `LivePreview3D`, chart.
4. `useMemo`/`useCallback` **chỉ khi có bằng chứng** từ profiler, hoặc khi prop là
   dependency của `useEffect`/`useMemo` khác. Không memo phòng thân.
5. Ảnh: `next/image`, `sizes` đúng, AVIF/WebP, placeholder blur cho PDP.
6. Debounce search 300ms; abort query cũ bằng `AbortSignal`.
7. Ngân sách: LCP < 2.5s (storefront mobile 4G), INP < 200ms, bundle route đầu < 200KB gzip.
