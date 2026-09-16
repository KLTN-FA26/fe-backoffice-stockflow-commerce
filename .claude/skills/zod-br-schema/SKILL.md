---
name: zod-br-schema
description: Use when writing zod schemas or lifecycle transition tables for a StockFlow module — encodes business rules (BR-xx) from docs with traceable citations, the two-layer DTO/Input split, and the tests that prove each rule.
---

# Zod schema & BR traceable

Mọi business rule (`BR-xx`) trong docs phải được encode vào code **và cite được nguồn**.
Đây là phần chứng minh nghiệp vụ khi bảo vệ capstone — BR không cite được coi như chưa làm.

## Hai lớp schema — KHÔNG trộn

| Lớp   | Tên             | Mô tả                            | BR refine?                 |
| ----- | --------------- | -------------------------------- | -------------------------- |
| DTO   | `PoDto`         | Hình dạng dữ liệu backend trả về | Không — chỉ validate shape |
| Input | `PoCreateInput` | Dữ liệu form gửi đi              | **Có** — BR sống ở đây     |

`types.ts` chỉ `z.infer`, không khai `interface` tay:

```ts
export type PoDto = z.infer<typeof PoDto>;
export type PoCreateInput = z.infer<typeof PoCreateInput>;
```

Khai type tay sẽ lệch với schema khi một trong hai đổi — compiler không bắt được.

## Cite docs — bắt buộc

Mỗi refine phải có comment nói rõ **BR nào, docs nào, mục nào**:

```ts
// BR-05 (docs 02-purchase-order §4): PO đã có Receipt thì không được huỷ
.refine((po) => !(po.status === "Confirmed" && po.hasReceipt), {
  message: "PO đã có phiếu nhận hàng, không thể huỷ",
  path: ["status"],
})
```

Comment kiểu `// validate status` là vô dụng — người review không truy ngược được về docs.

Nếu docs chưa chốt, đánh dấu rõ ràng thay vì đoán bừa:

```ts
// ASSUMPTION (open-question Q3): docs chưa nói rõ có cho phép huỷ khi Partially Received
```

## Quy trình viết schema một module

**1. Lấy union type trạng thái từ `src/lib/mock-data.ts`** (chỉ đọc, không sửa).
Field name và tên trạng thái phải giữ **nguyên văn** — không rename, không dịch.

**2. Đọc bảng BR trong docs module** tại `D:\FPTU\Capstone\docs\docs\`.
Liệt kê hết BR-xx trước khi viết, để không bỏ sót.

**3. Viết DTO trước, Input sau.** DTO phản ánh backend; Input phản ánh form.

**4. Dùng lại primitives** từ `src/lib/validation/primitives.ts`:
`vnd`, `vndAmount`, `isoDate`, `futureDate`, `barcode`, `locationCode`.
Đừng viết regex tiền/ngày riêng cho từng feature — lệch định dạng là bug thầm lặng.

**5. Parse tại biên** — gọi `.parse()` một lần ở lớp `api.ts`, không rải trong component.

## Transition table — lifecycle.ts

Chép bảng "Chuyển tiếp cho phép" từ docs, giữ nguyên tên trạng thái:

```ts
// docs 02-purchase-order §5 — bảng Chuyển tiếp cho phép
export const PO_TRANSITIONS = {
  Draft: ["Pending Approval", "Cancelled"],
  "Pending Approval": ["Approved", "Rejected", "Draft"],
  Approved: ["Confirmed", "Cancelled"],
  Confirmed: ["Partially Received", "Closed"],
  Closed: [], // terminal — không transition nào
} as const satisfies Record<string, readonly string[]>;
```

**Terminal state phải là `[]`.** Và nơi nào có terminal state thì không được render nút
mutating nào — đây là lỗi hay gặp nhất khi review.

Dùng `ts-pattern` `match()` để compiler bắt thiếu nhánh khi union status đổi.

## Test — mỗi BR một test

```ts
describe("PO_TRANSITIONS (docs 02 §5)", () => {
  it("Draft → Pending Approval / Cancelled", () => {
    expect(PO_TRANSITIONS.Draft).toEqual(["Pending Approval", "Cancelled"]);
  });

  it("Closed là terminal — không transition nào", () => {
    expect(PO_TRANSITIONS.Closed).toEqual([]);
  });

  it("BR-05: Confirmed không thể Cancelled khi đã có Receipt", () => {
    const result = PoCreateInput.safeParse({ status: "Confirmed", hasReceipt: true /* … */ });
    expect(result.success).toBe(false);
  });
});
```

Mỗi trạng thái trong bảng docs phải xuất hiện trong test. Coverage
`features/*/{schemas,lifecycle}.ts` ≥ 90%.

## Checklist trước khi coi schema là xong

- [ ] Mọi BR-xx trong docs có mặt trong refine hoặc transition table
- [ ] Mọi refine có comment cite `docs <module> §<mục>`
- [ ] DTO và Input tách bạch, không dùng chung một schema
- [ ] `types.ts` chỉ `z.infer`, không interface tay
- [ ] Dùng primitives thay vì regex tự viết
- [ ] Terminal state `=== []` và có test chứng minh
- [ ] Field name và tên trạng thái khớp nguyên văn `mock-data.ts` + docs
- [ ] Giả định chưa chốt đánh dấu `// ASSUMPTION (open-question Xn)`
