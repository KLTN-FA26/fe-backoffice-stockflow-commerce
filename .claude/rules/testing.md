---
description: Vitest + RTL + MSW — test bắt buộc mỗi module, coverage target
globs:
  - "src/**/__tests__/**"
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/test/**"
  - "vitest.config.ts"
---

# Testing

Nguồn: `src/_design/PRODUCTION-FRONTEND-RULES.md` §11.

Chạy: `pnpm run test` · watch: `pnpm run test:watch` · coverage: `pnpm run coverage`

## Phân tầng

| Loại      | Phạm vi                                                           | Công cụ     |
| --------- | ----------------------------------------------------------------- | ----------- |
| Unit      | `selectors.ts`, `lifecycle.ts`, `format/*`, zod schemas           | Vitest      |
| Component | `StatusBadge`, `DataTable`, `ActionButton`, `ScanInput`           | RTL + jsdom |
| Feature   | List page (filter→URL→table), Detail (action-gating), Form wizard | RTL + MSW   |
| Contract  | Zod parse fixture JSON thật từ backend                            | Vitest      |
| E2E (sau) | PO→Receipt→Putaway, Order→Pick→Pack→Ship                          | Playwright  |

## Bắt buộc cho MỌI module — phần ăn điểm capstone

**1. Lifecycle test** — mọi trạng thái trong bảng docs phải có mặt, terminal state rỗng:

```ts
// features/purchase-order/__tests__/lifecycle.test.ts
describe("PO_TRANSITIONS (docs 02 §5)", () => {
  it("Draft → Pending Approval / Approved / Cancelled", () => {
    /* … */
  });
  it("Closed là terminal — không transition nào", () => {
    expect(PO_TRANSITIONS.Closed).toEqual([]);
  });
  it("BR-05: Confirmed không thể Cancelled khi đã có Receipt", () => {
    /* … */
  });
});
```

**2. Action-gating test** — ít nhất **3 role khác nhau**:

```ts
it("Pending Approval + role Procurement → không thấy nút Duyệt (chỉ Approver)", () => { … });
it("Closed → không render nút mutating nào", () => { … });
```

## Coverage target

- `lib/domain/*` và `features/*/{selectors,schemas,lifecycle}.ts`: **≥ 90%**
- Component: ≥ 70%
- **Không** đặt target cho `app/**/page.tsx`

## MSW

`src/test/mocks/handlers.ts` build **từ `mock-data.ts`** → fixture test và demo dùng chung
một nguồn, không lệch nhau. Render qua `src/test/render.tsx` (`renderWithProviders`) để có
sẵn QueryClient + nuqs + theme.

## Quy tắc viết test

- Test hành vi người dùng thấy, không test implementation detail.
- Query theo role/label (`getByRole`, `getByLabelText`), tránh `querySelector` và test-id
  trừ khi không còn cách nào.
- `userEvent` thay vì `fireEvent`.
- Mỗi test phải **fail được** — viết test đỏ trước khi code xanh (TDD).
- Không `any`, không `@ts-expect-error` để test qua cho nhanh.
