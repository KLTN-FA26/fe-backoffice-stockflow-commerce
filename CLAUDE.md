# StockFlow UI — CLAUDE.md

## Phạm vi

Frontend production cho StockFlowCommerce. Nghiệp vụ lấy từ `D:\FPTU\Capstone\docs\docs\` (18 module).
Giai đoạn hiện tại: refactor từ UI-only sang kiến trúc production (data layer, validation, state, permission, test).
Backend chưa sẵn sàng → chạy `NEXT_PUBLIC_USE_MOCK=true`; component KHÔNG import mock trực tiếp.

**Stack:** Next.js App Router + TS strict · Tailwind v4 + shadcn/ui · TanStack Query + axios ·
zod + react-hook-form · zustand · nuqs · Framer Motion · lucide-react · Vitest + RTL + MSW.

## Luật chi tiết nằm ở `.claude/rules/` — tự nạp theo file đang sửa

| Rule                      | Áp dụng khi sửa                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| `design-tokens.md`        | mọi `.tsx`/`.css` — bảng màu, spacing, radius, z-index, dark mode, a11y |
| `mode-a-backoffice.md`    | `app/admin/**`, `components/backoffice/**` — Ink+Blue, action-gating    |
| `mode-b-storefront.md`    | `components/storefront/**` — Caramel, module 12–18                      |
| `data-table-mode-a.md`    | trang danh sách admin — toolbar, filter, pagination                     |
| `feature-architecture.md` | `features/**` — 7 file bắt buộc, import boundaries                      |
| `api-conventions.md`      | `lib/api/**`, `features/**` — query key, zod, error/loading/empty       |
| `state-persistence.md`    | ranh giới URL (nuqs) vs localStorage (`usePageConfig`) vs zustand       |
| `shared-components.md`    | `components/**` — tra trước khi viết component mới                      |
| `testing.md`              | `*.test.*` — lifecycle + action-gating test bắt buộc                    |

Tài liệu nguồn đầy đủ (bảng dài, phụ lục): `src/_design/FRONTEND-AI-RULES.md` và
`PRODUCTION-FRONTEND-RULES.md`. Style chuẩn: mở `src/_design/components-preview.html` trong browser.

**Xung đột:** nghiệp vụ → `docs/` thắng. Kỹ thuật → `PRODUCTION-FRONTEND-RULES.md` thắng.

## Luật không được vi phạm

- Component KHÔNG import `src/lib/mock-data.ts` — chỉ `lib/api/mock-adapter.ts` được phép.
- Giữ nguyên mọi field name trong mock-data.ts; status hiển thị **nguyên văn** union type trong docs.
- Không bịa record/ID/tên/số tiền. KPI derive từ data thật qua `selectors.ts`.
- Hai theme **tách biệt hoàn toàn**: caramel không lọt vào Mode A, blue không lọt vào Mode B.
  Không dùng màu hồng/magenta. Không hex trần, không `!important`, không `any`.
- Mọi `BR-xx` encode vào zod refine / transition table phải có comment cite docs.
- Không sửa `mock-data.ts`, `components/ui/*`, hai file `_design/*RULES.md` (hook đang chặn).

## Quy trình làm việc

Mỗi task = 1 module = 1 PR, theo Refactor Playbook §13 (9 bước) — dùng `/module <tên>`.
Route `/admin/*` cho Mode A, storefront cho Mode B. Tên feature folder theo Phụ lục B.

### BẮT BUỘC trước khi báo "xong"

Dự án dùng **pnpm** — KHÔNG `npm install` (crash trên cây symlink pnpm).

1. `pnpm run build` 2. `pnpm run lint` 3. `pnpm run typecheck` + `pnpm run test`
   (hoặc gộp `pnpm run validate`)

- **Chưa chạy đủ thì KHÔNG được nói task đã xong.** Không suy đoán "chắc là pass".
- Phải **dán output thật** làm bằng chứng.
- Còn lỗi → phân biệt **lỗi mình gây ra** với **lỗi có sẵn trên `main`** (kiểm chứng bằng
  `git stash` rồi chạy lại trên HEAD sạch, so số lượng trước/sau).
  Lỗi của mình → sửa xong mới báo. Lỗi có sẵn → báo người dùng, không tự sửa ngoài phạm vi task.

## Công cụ có sẵn

Commands: `/module <tên>` · `/validate` · `/design-check` · `/fix-lint`
Agents: `design-reviewer` · `architecture-reviewer`
Skills: `status-badge` (thêm trạng thái mới) · `zod-br-schema` (encode BR)

## Code style bắt buộc (§15 PRODUCTION-FRONTEND-RULES)

- **Import theo thứ tự:** `"use client"` → external → `@/constants` → `@/lib`/`@/hooks` → `@/features` → `@/components` → relative → `import type` (tách riêng, cuối) → side-effect. Nhóm cách nhau 1 dòng trống, trong nhóm sort alphabet.
- **Không hardcode string/số:** route → `ADMIN_ROUTES`, nhãn → `UI_LABELS`, status → `PO_STATUS`/`*_STATUS`, cột → `*_COLUMNS`, pageSize → `PAGE_SIZE`, ngưỡng/dung sai → `constants/numbers.ts` (cite docs), storage key → `STORAGE_KEYS`, query key → `queryKeys.*`, toast → `TOAST_MESSAGES`. Dùng lại ≥2 lần = phải vào constants.
- **`src/constants/` là tầng thấp nhất** — không import gì từ `src/` ngoài chính nó.
- **Không `any`** (tường minh lẫn ngầm), không `@ts-ignore`, không `as unknown as` không lý do, không `!` non-null. Chưa biết type → `unknown` + narrow/zod parse. `catch (e: unknown)` + type guard.
- Chuỗi status lấy nguyên văn từ `constants/statuses.ts` (nguồn cho zod enum + status-map + lifecycle) — không gõ tay lại.
