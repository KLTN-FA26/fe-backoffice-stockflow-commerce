# Refactor Module Tracker

> Tạo: 2026-09-11 | Branch gốc: `feat/phase0a-structure-deps`
> Hạ tầng đã xong: auth, query factory, mock routes, feature template (PO mẫu).
> Mỗi module = 1 PR, theo đúng Refactor Playbook §13 (9 bước).

---

## Thứ tự ưu tiên

### Ưu tiên cao (nhiều BR + transition)

| #   | Module              | Feature folder             | 9 bước                                                                                                                                                                                                                                                                           | PR  |
| --- | ------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 1   | 02 — Purchase Order | `features/purchase-order/` | Bước 1–9 xong. schemas/lifecycle/api/queries/mutations/selectors/components/action-gating/loading-error/URL filters qua `useUrlFilters` (search+status)/a11y(aria-label, htmlFor)/validate pass. localStorage giữ layout prefs (showStats, columns, columnSearch, searchFields). | —   |
| 2   | 03 — Receipt        | `features/receipt/`        | UI list/detail đã dựng. api/queries/selectors/components/URL filters qua `useUrlFilters` (search+status) đã có. Chưa encode đủ schemas/lifecycle/mutations/action-gating/test theo 9 bước production.                                                                            | —   |
| 3   | 04 — Invoice        | `features/invoice/`        | Chưa bắt đầu                                                                                                                                                                                                                                                                     | —   |
| 4   | 09 — Shipping       | `features/shipping/`       | Chưa bắt đầu                                                                                                                                                                                                                                                                     | —   |

### Ưu tiên trung bình

| #   | Module        | Feature folder       | 9 bước                                                                                                                                                                                                                                                                                             | PR  |
| --- | ------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 5   | 01 — Product  | `features/product/`  | Bước 1–9 xong. schemas/lifecycle/api/queries/mutations/selectors/components/list/detail/create/variants/action-gating/loading-error/URL filters(search+status)/a11y(htmlFor variants + create form)/validate pass. localStorage giữ layout prefs (showStats, columns, columnSearch, searchFields). | —   |
| 6   | 07 — Picking  | `features/picking/`  | Chưa bắt đầu                                                                                                                                                                                                                                                                                       | —   |
| 7   | 08 — Packing  | `features/packing/`  | Chưa bắt đầu                                                                                                                                                                                                                                                                                       | —   |
| 8   | 05 — Putaway  | `features/putaway/`  | Chưa bắt đầu                                                                                                                                                                                                                                                                                       | —   |
| 9   | 10 — Transfer | `features/transfer/` | Chưa bắt đầu                                                                                                                                                                                                                                                                                       | —   |
| 10  | 11 — Move     | `features/move/`     | Chưa bắt đầu                                                                                                                                                                                                                                                                                       | —   |

### Ưu tiên thấp (chỉ-đọc / dashboard)

| #   | Module              | Feature folder                                | 9 bước       | PR  |
| --- | ------------------- | --------------------------------------------- | ------------ | --- |
| 11  | 06 — Warehouse Map  | `features/warehouse-map/`                     | Chưa bắt đầu | —   |
| 12  | Dashboard/Inventory | `features/dashboard/` + `features/inventory/` | Chưa bắt đầu | —   |
| 13  | 14 — Orders         | (trong `app/admin/orders/`)                   | Chưa bắt đầu | —   |

---

## 9 bước cho mỗi module

| Bước  | Việc                                                      | File tạo/sửa                                                            | Kiểm chứng                   |
| ----- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| **1** | Tạo `schemas.ts` — zod + BR-xx comment                    | `features/<mod>/schemas.ts`                                             | `npm run typecheck`          |
| **2** | Tạo `lifecycle.ts` — transition table + test              | `features/<mod>/lifecycle.ts`                                           | `vitest related` pass        |
| **3** | Tạo `api.ts` + `queries.ts` + `mutations.ts` + mock route | `features/<mod>/api.ts`, `queries.ts`, `mutations.ts`                   | Mock mode chạy đúng          |
| **4** | Tách page: logic → `selectors.ts`, JSX → `components/`    | `features/<mod>/selectors.ts`, `components/*.tsx`, `page.tsx` ≤ 60 dòng | Page render đúng             |
| **5** | Action-gating: `allowedActions(status, role)` + `<Can>`   | `features/<mod>/lifecycle.ts`, action buttons                           | Test action-gating theo role |
| **6** | Thêm `loading.tsx`, `error.tsx`, EmptyState               | `app/admin/<route>/loading.tsx`, `error.tsx`                            | Tắt mạng → thấy UI đúng      |
| **7** | Filter URL: xóa localStorage → nuqs                       | Dùng `use-url-filters` hook                                             | F5 + copy URL giữ state      |
| **8** | Accessibility pass                                        | aria, focus-visible, contrast, keyboard nav                             | axe DevTools 0 violation     |
| **9** | Validate + đối chiếu                                      | `npm run validate` + browser check `components-preview.html`            | Build pass, screenshot       |

---

## Template tham khảo

Module Purchase Order (`features/purchase-order/`) đã có:

- `types.ts` — re-export từ mock-data
- `api.ts` — axios calls (list, detail, create, update, transition)
- `queries.ts` — React Query hooks dùng factory
- `mutations.ts` — mutation hooks dùng factory
- `index.ts` — barrel export

Các module khác copy cấu trúc này rồi bổ sung schemas, selectors, components.

---

## Ghi chú

- **Không sửa** `mock-data.ts`, `FRONTEND-AI-RULES.md`, `PRODUCTION-FRONTEND-RULES.md`
- **Không đổi** field name, status name, token màu
- **Không gộp** 2 module vào 1 feature
- Lifecycle transition table cho 12 domain đã có sẵn trong `src/lib/domain/lifecycle.ts`
- Permission map (40+ entries, 10 roles) đã có trong `src/lib/auth/permissions.ts`
- Mock routes cho tất cả module đã đăng ký trong `src/lib/api/mock-routes.ts`
