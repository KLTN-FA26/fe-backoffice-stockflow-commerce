---
description: Review PR theo CLAUDE.md, .claude/rules, docs nghiệp vụ và contract BE — chỉ báo lỗi chắc chắn
argument-hint: "[--comment] [--requested] <owner/repo/pull/N | số PR>"
allowed-tools: Read, Glob, Grep, Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr comment:*), Bash(gh pr list:*), Bash(gh issue view:*), Bash(gh search:*), Bash(git diff:*), Bash(git log:*), Bash(git blame:*), mcp__github_inline_comment__create_inline_comment
---

Review pull request: $ARGUMENTS

Khung lấy từ plugin `code-review` của Anthropic (lọc PR → nhiều agent song song → xác minh từng
phát hiện → chỉ đăng phát hiện chắc chắn). Khác plugin ở chỗ: plugin chỉ đọc file tên `CLAUDE.md`,
trong khi luật thật của repo này nằm ở `.claude/rules/*.md`; và plugin không biết docs nghiệp vụ
hay contract BE. Lệnh này thêm cả ba.

**Giả định cho mọi agent và subagent** (nói rõ với từng subagent được gọi):

- Mọi tool đều hoạt động. Không gọi thử, không gọi thăm dò. Mỗi lần gọi tool phải có mục đích rõ.
- Viết mọi kết quả và comment bằng **tiếng Việt**, ngắn gọn.

## Bước 0 — Xác định nguồn ngữ cảnh (tự làm, không gọi agent)

| Nguồn                                  | Tìm theo thứ tự                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `DOCS` — docs nghiệp vụ (repo `docs`)  | `.review-context/docs/docs/` (CI) → thư mục docs ghi trong `CLAUDE.md` (máy local) |
| `BE` — backend (repo `be-backoffice…`) | `.review-context/be/` (CI) → `../be-backoffice-stockflow-commerce/` (máy local)    |
| SHA để tạo link                        | `.review-context/refs.txt` (CI ghi sẵn, dòng `docs <sha>` và `be <sha>`)           |

Nguồn nào không tồn tại → ghi nhận, bỏ qua agent phụ thuộc nó, và **nói rõ trong tóm tắt cuối**
("Không đọc được docs — bỏ qua kiểm tra nghiệp vụ"). Không im lặng bỏ qua.

## Bước 1 — Lọc PR (agent haiku)

Dừng, không làm gì thêm, nếu một trong các điều sau đúng:

- PR đã đóng.
- Claude đã review **đúng commit HEAD hiện tại** của PR: trong `gh pr view <PR> --comments` có comment
  "## Code review" ghi `Commit đã review: <sha>` trùng HEAD. Review cho commit cũ hơn thì vẫn review
  tiếp — đó là trường hợp "@claude review" sau khi push thêm.
- **Chỉ khi KHÔNG có `--requested`** (chạy tự động lúc mở PR): PR là draft, hoặc không cần review
  (tự động, chỉ đổi lockfile/`.github/`/tài liệu, thay đổi nhỏ hiển nhiên đúng). Có `--requested`
  nghĩa là có người comment "@claude review" — họ muốn review, nên vẫn review dù PR nhỏ hay draft.

Có `--requested` và `--comment` mà phải dừng → đăng **một** comment ngắn bằng `gh pr comment` nói lý
do (ví dụ "Commit `abc1234` đã được review ở comment trên — push commit mới rồi gọi lại"). Người gọi
phải nhận được phản hồi, không được im lặng.

Vẫn review PR do Claude tạo.

## Bước 2 — Bản đồ ngữ cảnh (agent haiku)

Trả về **đường dẫn** (không trả nội dung), cho từng file bị sửa trong PR:

1. **CLAUDE.md**: `CLAUDE.md` ở gốc + mọi `CLAUDE.md` trong thư mục cha của file.
2. **Rules**: đọc frontmatter `globs` của từng `.claude/rules/*.md`; rule áp cho file khi một glob
   khớp đường dẫn file. Rule không có `globs` → áp cho mọi file.
3. **Module docs**: file trong `src/features/<feature>/` hoặc route admin tương ứng → tra
   "Phụ lục B — Mapping module docs ↔ feature ↔ route" trong
   `src/_design/PRODUCTION-FRONTEND-RULES.md` để ra `DOCS/warehouse/NN-<module>/README.md`
   (hoặc `DOCS/ecommerce/...`). Không có module docs → ghi "không có".
4. **BE**: với feature bị sửa, tìm trong `BE/src/main/java/com/stockflow/<module>/`:
   enum `*Status.java` (`api/` hoặc `internal/domain/`) và DTO
   `internal/controller/dto/*.java` mà `features/<feature>/api.ts` gọi tới. Mã quyền gán cho role
   nằm trong migration `BE/src/main/resources/db/migration/`; thông báo lỗi trong
   `BE/src/main/resources/i18n/`.

## Bước 3 — Tóm tắt thay đổi (agent sonnet)

Xem PR (`gh pr view`, `gh pr diff`) và tóm tắt thay đổi. Kết quả này cùng tiêu đề + mô tả PR được
đưa cho mọi agent ở bước 4 để hiểu ý định tác giả.

## Bước 4 — Review song song

Mỗi agent trả về danh sách issue; mỗi issue gồm: file, dòng, mô tả, lý do (`rule`, `bug`,
`nghiệp vụ`, `contract`) và **trích nguyên văn** nguồn chứng minh (dòng luật, đoạn docs, dòng BE).

**Agent 1 + 2 — Tuân thủ luật (sonnet, chạy độc lập).** Đối chiếu diff với CLAUDE.md **và các rule
khớp glob** ở bước 2. Chỉ dùng rule áp cho đúng file đó. Trọng tâm: tách theme Mode A/B, hex trần,
gradient, `!important`, `any`/`@ts-ignore`/`!`, import boundary (feature ↔ feature, shared ↔ feature,
component ↔ `mock-data`), hardcode string/route/status thay vì constants, status không qua
`<StatusBadge>`, action-gating rải if/else trong JSX thay vì `allowedActions`, filter/search lưu
localStorage thay vì URL, BR encode vào zod/transition mà thiếu comment cite docs, giới hạn số dòng file.

**Agent 3 — Bug trong diff (opus).** Chỉ nhìn diff. Chỉ báo bug lớn kiểm chứng được ngay trong diff.

**Agent 4 — Logic & bảo mật trong code mới (opus).** Logic sai, bảo mật (lộ token/secret, XSS qua
`dangerouslySetInnerHTML`, tin quyền ở client mà không có `// Backend phải re-check`), xử lý lỗi nuốt
lỗi im lặng. Chỉ trong code được thêm/sửa.

**Agent 5 — Nghiệp vụ (opus)** — chỉ chạy khi PR sửa `src/features/**`, `src/constants/statuses.ts`
hoặc route admin, và có `DOCS`:

- Mỗi comment `BR-xx` mới/sửa: BR đó **có tồn tại** trong module docs được cite không, và code có
  làm **đúng** điều BR nói không.
- `lifecycle.ts`: transition so với bảng "Chuyển tiếp cho phép" của docs; terminal state phải `[]`.
- Action-gating: role được phép theo docs/permission code có khớp không.
- **Quy ước đã chốt: tên status và transition lấy BE làm chuẩn, docs chỉ tham khảo.** Nếu FE khớp BE
  mà lệch docs → KHÔNG báo. Chỉ báo khi FE lệch cả BE, hoặc lệch docs ở chỗ BE không có thông tin.

**Agent 6 — Contract BE (sonnet)** — chỉ chạy khi PR sửa `schemas.ts`, `api.ts` hoặc
`constants/statuses.ts`, và có `BE`:

- Zod DTO so với Java DTO/record: tên field, nullable/optional, kiểu, giá trị enum (nguyên văn).
- URL + method trong `api.ts` so với controller BE.
- Chỉ báo lệch **chắc chắn** — field FE đọc mà BE không trả, enum FE có mà BE không có, sai tên field.

**CHỈ báo issue TÍN HIỆU CAO.** Báo khi:

- Code sẽ không compile/parse (lỗi type, thiếu import, tham chiếu không tồn tại).
- Code chắc chắn cho kết quả sai bất kể input.
- Vi phạm luật rõ ràng, trích được nguyên văn dòng luật, và luật đó áp cho file này.
- Lệch nghiệp vụ/contract trích được nguyên văn đoạn docs hoặc dòng BE.

KHÔNG báo: style, gợi ý chủ quan, vấn đề phụ thuộc input cụ thể. Không chắc thì không báo.

## Bước 5 — Xác minh từng issue

Với mỗi issue ở bước 4, chạy song song một subagent xác minh (biết tiêu đề + mô tả PR + mô tả issue):

- Bug/logic/nghiệp vụ → opus. Rule/contract → sonnet.
- Rule: glob của rule có thật sự khớp file không, và dòng code có thật sự vi phạm không.
- Nghiệp vụ/contract: mở lại đúng đoạn docs / file BE và kiểm tra trích dẫn có đúng không.

## Bước 6 — Lọc

Bỏ mọi issue không được xác minh ở bước 5. Còn lại là danh sách cuối.

Những thứ sau là **false positive — không báo**:

- Lỗi có sẵn trước PR (không nằm trong dòng được thêm/sửa).
- Thứ trông như bug nhưng đúng.
- Bắt bẻ vụn mà senior engineer không nêu.
- Lỗi mà typecheck/lint/test sẽ bắt — workflow `ci` đã chạy chúng (đừng tự chạy để kiểm).
- Code quality chung (thiếu test, bảo mật chung chung) trừ khi CLAUDE.md/rules bắt buộc rõ.
- Vi phạm đã được tắt có chủ đích trong code (comment ignore có lý do).
- Status/transition khớp BE nhưng lệch docs (xem agent 5).

## Bước 7 — Kết quả

In tóm tắt ra terminal: danh sách issue (một dòng mỗi issue), hoặc
"Không phát hiện vấn đề. Đã kiểm tra bug, CLAUDE.md + rules, nghiệp vụ, contract BE."
Kèm dòng nguồn ngữ cảnh đã dùng/bị thiếu (bước 0).

Không có `--comment` → dừng ở đây, không đăng gì lên GitHub.

Có `--comment` và có issue → làm bước 8 trước, rồi quay lại đăng comment tóm tắt dưới đây.

Có `--comment` → **luôn** đăng đúng một comment tóm tắt bằng `gh pr comment`, có hay không có issue.
Dòng `Commit đã review` là thứ bước 1 dùng để biết commit nào đã review, nên không được thiếu:

---

## Code review

<Không có issue: "Không phát hiện vấn đề. Đã kiểm tra bug, CLAUDE.md + rules, nghiệp vụ (docs) và
contract BE." — Có issue: "Phát hiện N vấn đề, xem comment trên từng dòng." kèm danh sách một dòng mỗi issue>

Commit đã review: `<full sha HEAD của PR>`
<dòng nguồn ngữ cảnh — ví dụ: docs @ `abc1234`, BE develop @ `def5678`>

---

## Bước 8 — Đăng comment inline

Tự lập danh sách comment định đăng (không đăng danh sách này). Rồi đăng từng issue bằng
`mcp__github_inline_comment__create_inline_comment` với `confirmed: true`:

- Mô tả ngắn issue và **link nguồn**: rule/CLAUDE.md trong repo này, đoạn docs, hoặc file BE.
- Fix nhỏ, tự đủ → kèm khối suggestion commit được. Fix lớn (≥ 6 dòng, đổi cấu trúc, nhiều chỗ) →
  mô tả cách sửa, không kèm suggestion. Không kèm suggestion nếu commit nó chưa sửa hết lỗi.
- **Mỗi issue chỉ MỘT comment.** Không lặp.

Xong bước 8 → quay lại bước 7 đăng comment tóm tắt.

## Định dạng link

Luôn dùng full SHA, có `#L<start>-L<end>`, lấy rộng hơn 1 dòng mỗi phía:

- Repo này: `https://github.com/<owner>/<repo>/blob/<full-sha-HEAD-của-PR>/<path>#L4-L7`
- Docs: `https://github.com/KLTN-FA26/docs/blob/<sha docs trong refs.txt>/docs/<path>#L10-L14`
- BE: `https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/blob/<sha be trong refs.txt>/<path>#L20-L24`

Không viết `$(git rev-parse HEAD)` trong link — comment render Markdown nguyên văn.
Dùng `gh` cho mọi thao tác GitHub, không dùng web fetch.
