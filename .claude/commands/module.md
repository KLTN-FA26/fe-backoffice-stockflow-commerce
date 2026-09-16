---
description: Refactor một module theo đúng 9 bước Refactor Playbook §13
argument-hint: <tên-feature> (vd purchase-order, receipt, invoice)
---

Refactor module `$1` sang chuẩn production, theo **Refactor Playbook §13** của
`src/_design/PRODUCTION-FRONTEND-RULES.md`.

## Trước khi bắt đầu

1. Đọc `src/_design/PRODUCTION-FRONTEND-RULES.md` §13 và §14 (checklist production-ready).
2. Tra Phụ lục B để biết `$1` ứng với module docs nào, route nào, transition table nào.
3. Đọc docs nghiệp vụ của module đó trong `D:\FPTU\Capstone\docs\docs\` — lấy đúng
   **union type trạng thái**, **field name**, và danh sách **BR-xx**. Không bịa.
4. Xem `src/lib/mock-data.ts` để biết field name thật (chỉ đọc, không sửa).

## 9 bước — thứ tự bắt buộc, mỗi bước có kiểm chứng

| Bước | Việc                                                                                                    | Kiểm chứng                            |
| ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1    | `features/$1/schemas.ts` — zod từ union type mock-data, mỗi BR có comment cite docs                     | `pnpm run typecheck`                  |
| 2    | `lifecycle.ts` — chép bảng "Chuyển tiếp cho phép" từ docs + viết test                                   | `pnpm exec vitest related --run` pass |
| 3    | `api.ts` + `queries.ts` + `mutations.ts`; thêm route vào `lib/api/mock-adapter.ts`                      | chạy với `NEXT_PUBLIC_USE_MOCK=true`  |
| 4    | Tách page: filter/stats/format → `selectors.ts` + `lib/format` + `use-url-filters`; JSX → `components/` | `page.tsx` ≤ 60 dòng                  |
| 5    | Nối action: `allowedActions(status, role)` + `<ActionButton>` + `<ReasonCodePicker>`                    | test action-gating ≥ 3 role           |
| 6    | `loading.tsx`, `error.tsx`, EmptyState 2 loại                                                           | sửa API URL sai → thấy UI đúng        |
| 7    | Xoá localStorage filter → URL; column-prefs giữ ở zustand persist                                       | F5 + copy URL sang tab khác giữ state |
| 8    | A11y: focus-visible, aria, contrast, keyboard nav bảng                                                  | axe DevTools 0 violation              |
| 9    | `pnpm run validate` + đối chiếu `components-preview.html`                                               | build pass                            |

## Ràng buộc

- **Cấm** đổi tên field mock-data, đổi tên trạng thái, đổi token màu, sửa `components/ui/*`,
  gộp 2 module vào 1 feature.
- Giả định chưa chốt → comment `// ASSUMPTION (open-question Xn)` ngay tại code.
- Theo `.claude/rules/feature-architecture.md` cho cấu trúc, `.claude/rules/api-conventions.md`
  cho data layer, `.claude/rules/testing.md` cho test.
- Mode A hay B tuỳ module — xem `.claude/rules/mode-a-backoffice.md` / `mode-b-storefront.md`.

## Kết thúc

Chạy `/validate`. Chỉ báo xong khi có output thật và không còn lỗi do mình gây ra.
Một module = một PR.
