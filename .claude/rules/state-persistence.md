---
description: Ranh giới state — cái gì lên URL (nuqs), cái gì vào localStorage (usePageConfig), cái gì vào zustand
globs:
  - "src/hooks/**"
  - "src/lib/store/**"
  - "src/app/**"
  - "src/features/**/components/**"
---

# State — lưu ở đâu

## Bảng ranh giới (nguồn: PRODUCTION-FRONTEND-RULES §5)

| Loại state                          | Công cụ                            | Ví dụ                                                         |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Server state                        | **React Query**                    | danh sách PO, detail order, KPI                               |
| Filter / sort / page / tab / search | **URL (`nuqs`)**                   | `?status=Draft,Confirmed&q=PO-2026&page=2&sort=-expectedDate` |
| Sở thích hiển thị của page          | **`usePageConfig`** (localStorage) | cột ẩn/hiện, density, showStats, page size                    |
| UI state toàn cục                   | **zustand**                        | `warehouseId`, sidebar collapsed, theme, locale               |
| UI state cục bộ                     | `useState`                         | dialog mở/đóng, row đang expand                               |
| Form state                          | react-hook-form                    | —                                                             |

## ⚠️ Hai file nguồn mâu thuẫn nhau — đây là phân định đã chốt

- `PRODUCTION-FRONTEND-RULES.md` §5 nói filter/sort/page phải lên URL, "không rác localStorage".
- `FRONTEND-AI-RULES.md` §4.2.1 nói config page (gồm cả search và status facet) lưu
  localStorage key `stockflow:<route>:config`.

**Phân định:** ranh giới là **"người khác mở link này có thấy cùng thứ không?"**

- **Có** → thuộc về URL. Filter, search query, status facet, sort, page number.
  Đây là dữ liệu người dùng muốn chia sẻ và quay lại được (back/forward, F5, gửi link đồng nghiệp).
- **Không** → thuộc về localStorage. Cột nào đang hiện, density, có bung stats không,
  bao nhiêu dòng mỗi trang. Đây là sở thích cá nhân trên máy đó, không ai muốn nhận qua link.

Khi sửa code cũ: phần search/status đang nằm trong `usePageConfig` nên chuyển dần sang
`nuqs`. Không cần làm ngay trong task không liên quan, nhưng **code mới phải theo ranh giới trên**.

## URL — `nuqs`

Dùng `useListFilters` trong `src/hooks/use-url-filters.ts`:

```ts
const { status, setStatus, q, page, setPage, sort, setSort, reset } =
  useListFilters(PO_STATUS_VALUES);
```

- Đổi filter → `setPage(1)` tự động.
- Search debounce 300ms.
- Lợi ích: link gửi được, F5 giữ nguyên, back/forward đúng.

## localStorage — `usePageConfig`

`src/hooks/use-page-config.ts`. Đã có 7 test pass, **đừng viết lại pattern cũ**:

```ts
const { config, updateConfig } = usePageConfig(
  "stockflow:admin:orders:config", // key format: stockflow:<route>:config
  DEFAULT_CONFIG,
  (stored, fallback) => ({ ...fallback, ...stored }), // merge để schema đổi không vỡ
);
```

Ba điều hook này đã xử lý sẵn — **không tự làm lại**:

1. **Merge với default** — config cũ thiếu field mới sẽ không làm vỡ page.
2. **Không ghi đè lúc mount** — chỉ ghi khi setter được gọi.
3. **`initializeWithValue: false`** — tránh hydration mismatch giữa SSR và client.

Pattern cũ (`useState` + `useEffect` đọc + cờ `mounted` + `useEffect` ghi ngược) vi phạm
`react-hooks/set-state-in-effect` và nhấp nháy 1 frame. Thấy pattern đó ở đâu thì thay bằng hook.

## zustand

- `use-app-store.ts` — `warehouseId`, sidebar, theme, locale.
- **Warehouse selector ảnh hưởng toàn app**: đổi kho → `queryClient.invalidateQueries()`
  toàn bộ list queries (vì header `X-Warehouse-Id` đổi). Persist `warehouseId` qua middleware.

## Cấm

- Filter/search/status chỉ sống trong `useState` — mất khi F5, không share được link.
- Dùng localStorage cho server data — đó là việc của React Query.
- Viết lại logic đọc/ghi localStorage thay vì dùng `usePageConfig`.
